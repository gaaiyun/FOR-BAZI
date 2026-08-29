/**
 * FOR-BAZI AI 网关。
 *
 * 唯一职责：在不暴露我的 Cloudflare 凭据的前提下，把聊天请求转发给模型。
 * 排盘、工具执行和古籍检索全部在浏览器里完成，这里不碰命理逻辑。
 *
 * 三种访问模式：
 *
 *   1. 自带 provider key（`X-Provider-Key` + `X-Provider-Base-Url`）
 *      -> 直接转发到对方自己的服务商，用的是对方的额度，不限次，也不消耗我的。
 *         同时解决浏览器直连第三方 API 的 CORS 问题。
 *
 *   2. 持我的访问密钥（`X-Access-Key` 命中 ACCESS_KEYS）
 *      -> 用我的 Workers AI，不限次。
 *
 *   3. 匿名
 *      -> 用我的 Workers AI，但按 IP 每日限次（RATE_LIMIT_KV），
 *         额度用完返回 429 并说明可以自带 key 继续用。
 *
 * 绑定与机密见 wrangler.toml；ACCESS_KEYS 用 `wrangler secret put` 设置，
 * 绝不写进仓库。
 */

export interface Env {
  AI: Ai;
  RATE_LIMIT_KV: KVNamespace;
  /** 逗号分隔的访问密钥；持有任一即可无限使用我的额度。 */
  ACCESS_KEYS?: string;
  /** 匿名每日免费次数，默认 5。 */
  ANON_DAILY_LIMIT?: string;
  /** 允许的前端来源，逗号分隔；未设置则回退为 "*"。 */
  ALLOWED_ORIGINS?: string;
  DEFAULT_MODEL?: string;
}

const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";
const DEFAULT_ANON_LIMIT = 5;

/** 只允许转发到已知的 OpenAI 兼容服务商，避免网关被当成任意 URL 的开放代理。 */
const ALLOWED_PROVIDER_HOSTS = [
  "api.openai.com",
  "api.anthropic.com",
  "api.deepseek.com",
  "dashscope.aliyuncs.com",
  "api.minimaxi.com",
  "open.bigmodel.cn",
  "api.moonshot.cn",
  "generativelanguage.googleapis.com",
  "api.cloudflare.com",
];

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowOrigin =
    allowed.length === 0 ? "*" : origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "Content-Type, X-Access-Key, X-Provider-Key, X-Provider-Base-Url, X-Provider-Model",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

/** 当天的 UTC 日期键；配合 KV 的 expirationTtl 自然滚动，无需清理任务。 */
function todayKey(ip: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return `anon:${d}:${ip}`;
}

async function checkAnonQuota(env: Env, ip: string) {
  const limit = Number(env.ANON_DAILY_LIMIT ?? DEFAULT_ANON_LIMIT);
  const key = todayKey(ip);
  const used = Number((await env.RATE_LIMIT_KV.get(key)) ?? "0");
  return { limit, used, remaining: Math.max(0, limit - used), key };
}

async function bumpAnonQuota(env: Env, key: string, used: number) {
  // 48 小时 TTL：跨过 UTC 零点后旧键自然过期，不需要额外清理。
  await env.RATE_LIMIT_KV.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
}

function isAllowedProvider(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== "https:") return false;
    return ALLOWED_PROVIDER_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`)
    );
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(env, origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    // 让前端能显示"今天还剩几次"，不消耗额度。
    if (request.method === "GET" && url.pathname === "/api/quota") {
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const accessKey = request.headers.get("X-Access-Key") ?? "";
      const keys = (env.ACCESS_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      if (accessKey && keys.includes(accessKey)) {
        return json({ mode: "key", unlimited: true }, 200, cors);
      }
      const q = await checkAnonQuota(env, ip);
      return json(
        { mode: "anonymous", limit: q.limit, used: q.used, remaining: q.remaining },
        200,
        cors
      );
    }

    if (request.method !== "POST" || url.pathname !== "/api/chat") {
      return json({ error: "Not found" }, 404, cors);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ error: "请求体不是合法 JSON" }, 400, cors);
    }

    const providerKey = request.headers.get("X-Provider-Key") ?? "";
    const providerBase = request.headers.get("X-Provider-Base-Url") ?? "";

    // ── 模式 1：自带 provider key，转发到对方的服务商 ──
    if (providerKey && providerBase) {
      if (!isAllowedProvider(providerBase)) {
        return json(
          { error: "不支持该服务商地址。为避免网关成为开放代理，只允许已知的 OpenAI 兼容服务商。" },
          400,
          cors
        );
      }
      const target = `${providerBase.replace(/\/+$/, "")}/chat/completions`;
      const upstream = await fetch(target, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${providerKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          ...cors,
          "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
          "X-Bazi-Mode": "byo-key",
        },
      });
    }

    // ── 模式 2 / 3：用我的 Workers AI ──
    const accessKey = request.headers.get("X-Access-Key") ?? "";
    const keys = (env.ACCESS_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const hasKey = accessKey !== "" && keys.includes(accessKey);

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    let quotaHeaders: Record<string, string> = {};
    let quotaKey = "";
    let quotaUsed = 0;

    if (!hasKey) {
      const q = await checkAnonQuota(env, ip);
      if (q.remaining <= 0) {
        return json(
          {
            error: "今日免费次数已用完。",
            detail:
              "可以在「设置」页填入自己的 AI 服务商 Key 继续使用（用你自己的额度，不限次），" +
              "或向站长索取访问密钥。",
            limit: q.limit,
            used: q.used,
          },
          429,
          cors
        );
      }
      quotaKey = q.key;
      quotaUsed = q.used;
      quotaHeaders = {
        "X-Quota-Limit": String(q.limit),
        "X-Quota-Remaining": String(q.remaining - 1),
      };
    }

    const model = String(body.model ?? env.DEFAULT_MODEL ?? DEFAULT_MODEL);
    const { model: _ignored, ...rest } = body;

    try {
      const result = await env.AI.run(model as never, rest as never);

      // 计数放在成功之后：上游失败不该扣掉用户的免费次数。
      if (!hasKey && quotaKey) await bumpAnonQuota(env, quotaKey, quotaUsed);

      // env.AI.run 在 stream:true 时返回 ReadableStream，否则是对象。
      if (result instanceof ReadableStream) {
        return new Response(result, {
          status: 200,
          headers: {
            ...cors,
            ...quotaHeaders,
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Bazi-Mode": hasKey ? "key" : "anonymous",
          },
        });
      }
      return json(result, 200, { ...cors, ...quotaHeaders, "X-Bazi-Mode": hasKey ? "key" : "anonymous" });
    } catch (err) {
      return json(
        { error: "模型调用失败", detail: err instanceof Error ? err.message : String(err) },
        502,
        cors
      );
    }
  },
};
