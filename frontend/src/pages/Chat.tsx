/**
 * 问事页（/chat）。
 *
 * 版面是一列问答记录，输入框钉在底部。进来不会自动替你发一句开场白
 * （旧版会，白白耗掉一次免费额度）；空白时列出几个可以直接点的问题。
 *
 * 对话记着自己属于哪份命盘：换了命盘再进来，会先问要不要开新对话，
 * 免得拿上一个人的问答接着聊。
 */

import { useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useChatStore, generateId } from "@/stores/useChatStore";
import { useBaziStore } from "@/stores/useBaziStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useChatSSE } from "@/hooks/useChatSSE";
import { ChatMessageBubble } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { CopyChartButton } from "@/components/bazi/CopyChart";
import { getCharColor } from "@/lib/wuxing-colors";
import type { ChatMessage } from "@/types/bazi";

const THIS_YEAR = new Date().getFullYear();

const SUGGESTIONS = [
  "先概括一下这个命盘的格局和性格特点",
  `${THIS_YEAR + 1} 年事业上要留意什么`,
  "我适合哪一类工作，打工还是自己做",
  "感情和婚姻方面有什么特点",
  "现在这步大运的重点是什么",
];

export default function Chat() {
  const reading = useBaziStore((s) => s.reading);
  const provider = useSettingsStore((s) => s.ai_provider);
  const { messages, addMessage, clearMessages, chartId, setChartId } = useChatStore();

  const onComplete = useCallback((msg: ChatMessage) => addMessage(msg), [addMessage]);
  const { isStreaming, tokens, status, toolCalls, error, sendMessage, abort } = useChatSSE({
    provider,
    chartData: reading,
    history: messages,
    onComplete,
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, tokens, isStreaming]);

  const readingId = reading?.id ?? null;
  // 旧版本存下的对话没有 chartId，视为属于当前命盘
  const stale = messages.length > 0 && chartId !== null && readingId !== null && chartId !== readingId;

  const send = useCallback(
    (text: string) => {
      if (!reading) return;
      if (chartId !== readingId) setChartId(readingId);
      addMessage({ id: generateId(), role: "user", content: text, timestamp: Date.now() });
      void sendMessage(text);
    },
    [reading, chartId, readingId, setChartId, addMessage, sendMessage]
  );

  const retry = useCallback(() => {
    const last = [...messages].reverse().find((m) => m.role === "user");
    if (last) void sendMessage(last.content);
  }, [messages, sendMessage]);

  const c = reading?.chart;
  const pillars = c ? [c.year_pillar, c.month_pillar, c.day_pillar, c.hour_pillar] : [];
  const empty = messages.length === 0 && !isStreaming;

  return (
    <div className="animate-fade-in flex min-h-0 flex-1 flex-col">
      {/* ── 顶部：标题 + 当前命盘 ─────────────────────────────── */}
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-foreground pb-4">
        <div className="flex items-end gap-5">
          <h1 className="font-heading text-[2rem] font-semibold leading-none tracking-tight sm:text-[2.5rem]">问事</h1>
          {pillars.length > 0 && (
            <Link to="/chart" className="glyph mb-0.5 flex gap-2 text-lg" title="查看命盘">
              {pillars.map((p, i) => (
                <span key={i}>
                  <span style={{ color: getCharColor(p.stem) }}>{p.stem}</span>
                  <span style={{ color: getCharColor(p.branch) }}>{p.branch}</span>
                </span>
              ))}
            </Link>
          )}
        </div>
        {messages.length > 0 && !isStreaming && (
          <button type="button" className="link text-sm" onClick={clearMessages}>
            清空对话
          </button>
        )}
      </header>

      {/* ── 记录 ─────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto py-6">
        {!reading ? (
          <div>
            <p className="font-heading text-xl font-semibold">还没有命盘</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              问事需要先有一份命盘，AI 才有东西可依据。
            </p>
            <Link to="/" className="btn btn-primary mt-6">
              去排盘
            </Link>
          </div>
        ) : stale ? (
          <div>
            <p className="font-heading text-xl font-semibold">这段对话属于另一份命盘</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              你已经换了命盘。接着聊会把两个人的内容混在一起。
            </p>
            <button type="button" className="btn btn-primary mt-6" onClick={clearMessages}>
              开始新对话
            </button>
          </div>
        ) : empty ? (
          <div>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              AI 会基于已经算好的命盘回答；引用流年干支和古籍原文时，会先调用本地工具核对。
            </p>
            <ul className="mt-6 max-w-xl">
              {SUGGESTIONS.map((q) => (
                <li key={q} className="border-b border-rule last:border-b-0">
                  <button
                    type="button"
                    onClick={() => send(q)}
                    className="group flex w-full items-baseline justify-between gap-4 py-3.5 text-left"
                  >
                    <span className="font-heading text-[1.0625rem] transition-colors group-hover:text-primary">{q}</span>
                    <span className="text-faint transition-colors group-hover:text-primary" aria-hidden>
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-muted-foreground">更想用自己的 AI？把命盘整份带走：</p>
            <CopyChartButton compact className="mt-3" />
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((m) => (
              <ChatMessageBubble key={m.id} message={m} />
            ))}
            {isStreaming && (
              <ChatMessageBubble
                isStreaming
                status={status}
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: tokens,
                  timestamp: 0,
                  tool_calls: toolCalls.length ? toolCalls : undefined,
                }}
              />
            )}
          </div>
        )}

        {error && !isStreaming && (
          <div role="alert" className="mt-6 border-l border-destructive pl-4">
            <p className="text-sm text-destructive">{error}</p>
            <p className="mt-2 flex gap-4 text-sm">
              <button type="button" className="link" onClick={retry}>
                重试
              </button>
              <Link to="/settings" className="link">
                检查 AI 设置
              </Link>
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── 输入 ─────────────────────────────────────────────── */}
      <ChatInput
        onSend={send}
        busy={isStreaming}
        onStop={abort}
        disabled={!reading || stale}
        className="shrink-0 pb-3 lg:pb-8"
      />
    </div>
  );
}
