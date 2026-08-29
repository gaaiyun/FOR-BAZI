/**
 * 浏览器端 ReAct 循环 —— agent/react_agent.py 的移植。
 *
 * 模型补全走 Worker 网关（密钥/限次在那边把关），**工具在浏览器本地执行**：
 * 排盘、五行、格局、古籍全部是本地计算与本地数据，没必要绕服务器，
 * 网关因此可以保持成一个纯粹的 LLM 代理，不碰任何命理逻辑。
 *
 * 事件协议与原后端 SSE 一致（status / token / tool_call / done / error），
 * 所以 useChatSSE、ChatPanel、ToolCallStatus 这些组件不用改。
 */

import type { BaziChart } from "@/engine/bazi";
import { TOOL_SCHEMAS, dispatchTool } from "@/engine/tools";
import { buildSystemPrompt } from "@/engine/prompt";

export interface AgentEvent {
  type: "status" | "token" | "tool_call" | "done" | "error";
  payload: Record<string, unknown>;
}

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

export interface GatewayConfig {
  /** Worker 网关地址。 */
  endpoint: string;
  /** 我的访问密钥；有则不限次。 */
  accessKey?: string;
  /** 自带服务商 key —— 走对方额度，不消耗默认额度。 */
  providerKey?: string;
  providerBaseUrl?: string;
  model?: string;
}

const MAX_STEPS = 8;

/** 从模型答复里抓「某年 + 干支」的搭配，收尾时反查历法。 */
const GANZHI_RE =
  /(1[89]\d{2}|20\d{2}|21\d{2})\s*年[^。；\n]{0,8}?([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/g;

async function runFactCheck(text: string): Promise<Array<Record<string, unknown>>> {
  const { factCheckGanzhi } = await import("@/engine/tools");
  const results: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(GANZHI_RE)) {
    const key = `${m[1]}:${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = factCheckGanzhi(m[2], Number(m[1]));
    if (!r.match) results.push(r as unknown as Record<string, unknown>);
  }
  return results;
}

async function callGateway(
  cfg: GatewayConfig,
  messages: ChatMsg[],
  signal?: AbortSignal
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.providerKey && cfg.providerBaseUrl) {
    headers["X-Provider-Key"] = cfg.providerKey;
    headers["X-Provider-Base-Url"] = cfg.providerBaseUrl;
  } else if (cfg.accessKey) {
    headers["X-Access-Key"] = cfg.accessKey;
  }

  const res = await fetch(`${cfg.endpoint.replace(/\/+$/, "")}/api/chat`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: cfg.model,
      messages,
      tools: TOOL_SCHEMAS,
      tool_choice: "auto",
      max_tokens: 2048,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data as Record<string, unknown>;
    const detail = [d.error, d.detail].filter(Boolean).join(" ");
    throw new Error(detail || `网关返回 ${res.status}`);
  }
  return data as Record<string, unknown>;
}

/**
 * 跑一轮完整对话。以异步生成器逐个吐出事件，调用方可实时渲染。
 */
export async function* runReactLoop(
  opts: {
    message: string;
    chart: BaziChart | null;
    history: Array<{ role: string; content: string }>;
    gateway: GatewayConfig;
    signal?: AbortSignal;
  }
): AsyncGenerator<AgentEvent> {
  const { message, chart, history, gateway, signal } = opts;

  let systemPrompt: string;
  try {
    systemPrompt = await buildSystemPrompt(chart);
  } catch {
    systemPrompt = "你是一位专业的命理大师。";
  }

  const working: ChatMsg[] = [{ role: "system", content: systemPrompt }];
  for (const h of history) {
    if (h.role === "user" || h.role === "assistant") {
      working.push({ role: h.role, content: h.content });
    }
  }
  working.push({ role: "user", content: message });

  let finalContent = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    let data: Record<string, unknown>;
    try {
      data = await callGateway(gateway, working, signal);
    } catch (err) {
      if (signal?.aborted) return;
      yield { type: "error", payload: { message: err instanceof Error ? err.message : String(err) } };
      return;
    }

    const choice = ((data.choices as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
    const msg = (choice?.message ?? {}) as Record<string, unknown>;
    const toolCalls = (msg.tool_calls ?? []) as Array<{
      id: string; type: string; function: { name: string; arguments: string };
    }>;
    const content = typeof msg.content === "string" ? msg.content : "";

    if (!toolCalls.length) {
      finalContent = content.trim() || "天机不可泄露。";
      // 一次性把最终答复作为 token 吐出：网关这条路径是非流式的，
      // 但事件协议保持一致，UI 无需区分。
      yield { type: "token", payload: { content: finalContent } };
      break;
    }

    working.push({ role: "assistant", content: content || "", tool_calls: toolCalls });

    for (const tc of toolCalls) {
      const name = tc.function?.name ?? "";
      const rawArgs = tc.function?.arguments || "{}";
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(rawArgs);
      } catch {
        args = {};
      }

      yield { type: "status", payload: { message: `正在调用工具 ${name}...` } };
      yield {
        type: "tool_call",
        payload: { id: tc.id, name, arguments: rawArgs, result: null, status: "calling" },
      };

      // 单个工具出错不该中断整条流：把错误回传给模型，让它自己决定怎么办。
      let resultText: string;
      let status: "done" | "error" = "done";
      try {
        resultText = JSON.stringify(await dispatchTool(name, args, chart));
      } catch (err) {
        status = "error";
        resultText = JSON.stringify({
          error: `工具 ${name} 执行失败：${err instanceof Error ? err.message : String(err)}`,
        });
      }

      yield {
        type: "tool_call",
        payload: { id: tc.id, name, arguments: rawArgs, result: resultText, status },
      };
      working.push({ role: "tool", tool_call_id: tc.id, name, content: resultText });
    }
  }

  const factChecks = finalContent ? await runFactCheck(finalContent) : [];
  yield { type: "done", payload: { content: finalContent, fact_checks: factChecks } };
}
