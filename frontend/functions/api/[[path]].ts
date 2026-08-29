/**
 * FOR-BAZI AI 网关（Pages Function，与站点同源）。
 *
 * 唯一职责：在不暴露站长 Cloudflare 凭据的前提下，把聊天请求转发给模型。
 * 排盘、工具执行和古籍检索全部在浏览器完成，这里不碰命理逻辑。
 *
 * 三种访问模式：
 *   1. 自带 provider key（X-Provider-Key + X-Provider-Base-Url）
 *      -> 转发到对方自己的服务商，用对方额度，不限次；顺带解决浏览器直连的 CORS。
 *   2. 持访问密钥（X-Access-Key 命中 ACCESS_KEYS）-> 用站长的 Workers AI，不限次。
 *   3. 匿名 -> 用站长的 Workers AI，按 IP 每日限次（RATE_LIMIT_KV）。
 *
 * 同源部署，因此不需要 CORS 头。
 */

interface Env {
  AI: { run: (model: string, input: unknown) => Promise<unknown> };
  RATE_LIMIT_KV: KVNamespace;
  ACCESS_KEYS?: string;
  ANON_DAILY_LIMIT?: string;
  DEFAULT_MODEL?: string;
}

const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";
const DEFAULT_ANON_LIMIT = 5;

/** 只允许转发到已知服务商，避免网关变成任意 URL 的开放代理。 */
const ALLOWED_PROVIDER_HOSTS = [
  "api.openai.com", "api.anthropic.com", "api.deepseek.com",
  "dashscope.aliyuncs.com", "api.minimaxi.com", "open.bigmodel.cn",
  "api.moonshot.cn", "generativelanguage.googleapis.com",
  "api.cloudflare.com", "xiaomimimo.com",
];

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });

const todayKey = (ip: string) => `anon:${new Date().toISOString().slice(0, 10)}:${ip}`;

async function checkQuota(env: Env, ip: string) {
  const limit = Number(env.ANON_DAILY_LIMIT ?? DEFAULT_ANON_LIMIT);
  const key = todayKey(ip);
  const used = Number((await env.RATE_LIMIT_KV.get(key)) ?? "0");
  return { limit, used, remaining: Math.max(0, limit - used), key };
}

function isAllowedProvider(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== "https:") return false;
    return ALLOWED_PROVIDER_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const keys = (env.ACCESS_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const accessKey = request.headers.get("X-Access-Key") ?? "";
  const hasKey = accessKey !== "" && keys.includes(accessKey);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

  // 额度查询：供设置页展示，不消耗次数。
  if (request.method === "GET" && url.pathname === "/api/quota") {
    if (hasKey) return json({ mode: "key", unlimited: true });
    const q = await checkQuota(env, ip);
    return json({ mode: "anonymous", limit: q.limit, used: q.used, remaining: q.remaining });
  }

  if (request.method !== "POST" || url.pathname !== "/api/chat") {
    return json({ error: "Not found" }, 404);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求体不是合法 JSON" }, 400);
  }

  // ── 模式 1：自带 provider key ──
  const providerKey = request.headers.get("X-Provider-Key") ?? "";
  const providerBase = request.headers.get("X-Provider-Base-Url") ?? "";
  if (providerKey && providerBase) {
    if (!isAllowedProvider(providerBase)) {
      return json(
        { error: "不支持该服务商地址。为避免网关成为开放代理，只允许已知的 OpenAI 兼容服务商。" },
        400
      );
    }
    const upstream = await fetch(`${providerBase.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${providerKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
        "X-Bazi-Mode": "byo-key",
      },
    });
  }

  // ── 模式 2 / 3：用站长的 Workers AI ──
  let quotaHeaders: Record<string, string> = {};
  let quotaKey = "";
  let quotaUsed = 0;

  if (!hasKey) {
    const q = await checkQuota(env, ip);
    if (q.remaining <= 0) {
      return json(
        {
          error: "今日免费次数已用完。",
          detail:
            "可以在「设置」页填入访问密钥解除限制，或改用自己的 AI 服务商 Key（用你自己的额度，不限次）。",
          limit: q.limit,
          used: q.used,
        },
        429
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
  const { model: _drop, ...rest } = body;

  try {
    const result = await env.AI.run(model, rest);
    // 计数放在成功之后：上游失败不该扣掉用户的免费次数。
    if (!hasKey && quotaKey) {
      await env.RATE_LIMIT_KV.put(quotaKey, String(quotaUsed + 1), { expirationTtl: 60 * 60 * 48 });
    }
    const mode = hasKey ? "key" : "anonymous";
    if (result instanceof ReadableStream) {
      return new Response(result, {
        status: 200,
        headers: {
          ...quotaHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Bazi-Mode": mode,
        },
      });
    }
    return json(result, 200, { ...quotaHeaders, "X-Bazi-Mode": mode });
  } catch (err) {
    return json(
      { error: "模型调用失败", detail: err instanceof Error ? err.message : String(err) },
      502
    );
  }
};
