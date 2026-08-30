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

/** 一次完整解读可能要连查十几个工具，8 轮不够 */
const MAX_STEPS = 14;
/** 单轮输出上限。推理模型的 reasoning 也吃这个预算，给足才不会半路截断。 */
const MAX_TOKENS = 8192;

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

interface GatewayTurn {
  content: string;
  toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  finishReason: string;
}

/**
 * 调用网关并解析 SSE 流。
 *
 * 必须走流式：非流式请求在生成较长内容时会被上游断连
 * （实测 max_tokens ≥ 4096 即 RemoteDisconnected）。而且 GLM-4.7-flash 是
 * 推理模型，reasoning 内容同样消耗 max_tokens——2048 的预算里可见正文
 * 只剩几百字，`finish_reason` 会是 "length"，解读到一半就断。
 *
 * @param onDelta 每个正文增量片段的回调，供 UI 实时渲染
 */
async function callGateway(
  cfg: GatewayConfig,
  messages: ChatMsg[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
  /** 收尾轮传 false：只要结论，不再给工具 */
  withTools = true
): Promise<GatewayTurn> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.providerKey && cfg.providerBaseUrl) {
    headers["X-Provider-Key"] = cfg.providerKey;
    headers["X-Provider-Base-Url"] = cfg.providerBaseUrl;
  } else if (cfg.accessKey) {
    headers["X-Access-Key"] = cfg.accessKey;
  }

  const base = cfg.endpoint.replace(/\/+$/, "");
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: cfg.model,
      messages,
      ...(withTools ? { tools: TOOL_SCHEMAS, tool_choice: "auto" } : {}),
      stream: true,
      max_tokens: MAX_TOKENS,
    }),
  });

  if (!res.ok || !res.body) {
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const detail = [d.error, d.detail].filter(Boolean).join(" ");
    throw new Error(detail || `网关返回 ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason = "";
  // 工具调用的参数在流里是分片到达的，按 index 累积
  const toolAcc = new Map<number, { id: string; name: string; args: string }>();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE 帧以空行分隔；先归一化 CRLF，最后一段可能不完整，留在缓冲区
    const parts = buffer.replace(/\r\n/g, "\n").split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let d: Record<string, unknown>;
        try {
          d = JSON.parse(payload);
        } catch {
          continue;
        }
        const ch = ((d.choices as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
        if (!ch) continue;
        if (ch.finish_reason) finishReason = String(ch.finish_reason);

        const delta = (ch.delta ?? {}) as Record<string, unknown>;
        if (typeof delta.content === "string" && delta.content) {
          content += delta.content;
          onDelta(delta.content);
        }
        const tcs = delta.tool_calls as Array<Record<string, unknown>> | undefined;
        if (tcs) {
          for (const tc of tcs) {
            const idx = Number(tc.index ?? 0);
            const cur = toolAcc.get(idx) ?? { id: "", name: "", args: "" };
            if (tc.id) cur.id = String(tc.id);
            const fn = (tc.function ?? {}) as Record<string, unknown>;
            if (fn.name) cur.name = String(fn.name);
            if (typeof fn.arguments === "string") cur.args += fn.arguments;
            toolAcc.set(idx, cur);
          }
        }
      }
    }
  }

  const toolCalls = [...toolAcc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => ({
      id: v.id || `tc_${v.name}`,
      type: "function",
      function: { name: v.name, arguments: v.args || "{}" },
    }));

  return { content, toolCalls, finishReason };
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
  let truncated = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    let turn: GatewayTurn;
    // 正文增量直接转成 token 事件，UI 得以逐字显示
    const emitted: string[] = [];
    try {
      turn = await callGateway(gateway, working, (d) => emitted.push(d), signal);
    } catch (err) {
      if (signal?.aborted) return;
      yield { type: "error", payload: { message: err instanceof Error ? err.message : String(err) } };
      return;
    }
    for (const d of emitted) yield { type: "token", payload: { content: d } };

    if (!turn.toolCalls.length) {
      finalContent = turn.content.trim() || "天机不可泄露。";

      // 被 max_tokens 截断时明确告知，而不是把半截解读当成完整结果交出去。
      if (turn.finishReason === "length") {
        truncated = true;
        const note = "\n\n---\n\n> ⚠️ 本次输出达到长度上限被截断，以上解读并不完整。可以点「重新分析」再试，或就某一节单独提问。";
        finalContent += note;
        yield { type: "token", payload: { content: note } };
      }
      break;
    }

    working.push({ role: "assistant", content: turn.content || "", tool_calls: turn.toolCalls });

    for (const tc of turn.toolCalls) {
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

  // 步数耗尽而模型仍在调工具时，若不做收尾就只剩一堆中间过程、没有结论。
  // 这里强制再要一次不带工具的答复，保证一定有可读的最终解读。
  if (!finalContent) {
    yield { type: "status", payload: { message: "正在汇总…" } };
    working.push({
      role: "user",
      content: "工具查询到此为止。请基于以上全部工具结果，给出完整的最终解读，不要再调用工具。",
    });
    const wrapDeltas: string[] = [];
    try {
      const wrap = await callGateway(
        gateway,
        working,
        (d) => wrapDeltas.push(d),
        signal,
        /* withTools */ false
      );
      for (const d of wrapDeltas) yield { type: "token", payload: { content: d } };
      finalContent = wrap.content.trim() || "天机不可泄露。";
      if (wrap.finishReason === "length") {
        truncated = true;
        const note = "\n\n---\n\n> ⚠️ 本次输出达到长度上限被截断，以上解读并不完整。";
        finalContent += note;
        yield { type: "token", payload: { content: note } };
      }
    } catch (err) {
      if (signal?.aborted) return;
      yield {
        type: "error",
        payload: { message: err instanceof Error ? err.message : String(err) },
      };
      return;
    }
  }

  const factChecks = finalContent ? await runFactCheck(finalContent) : [];
  yield { type: "done", payload: { content: finalContent, fact_checks: factChecks, truncated } };
}
