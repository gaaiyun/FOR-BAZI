/**
 * Chat page (问事) – interactive AI consultation.
 *
 * Layout:
 *   - Left: chart summary sidebar (if chart loaded)
 *   - Right: ChatPanel
 *
 * On first load with a chart, auto-sends a greeting.
 * Uses useChatStore for message persistence.
 * Uses useChatSSE hook for streaming.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore, generateId } from "@/stores/useChatStore";
import { useBaziStore } from "@/stores/useBaziStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useChatSSE } from "@/hooks/useChatSSE";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ELEMENT_COLORS } from "@/lib/wuxing-colors";
import type { ChatMessage } from "@/types/bazi";

// ── Chart Summary Sidebar ──────────────────────────────────────────────

function ChartSummarySidebar() {
  const reading = useBaziStore((s) => s.reading);

  if (!reading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
        <span className="text-3xl text-muted-foreground">☷</span>
        <p className="text-sm text-muted-foreground">尚未排盘</p>
        <p className="text-xs text-muted-foreground/60">
          请先在排盘页面输入出生信息
        </p>
      </div>
    );
  }

  const { chart, element_balance, favorable_elements, summary } = reading;

  return (
    <div className="flex flex-col gap-4 p-4 text-sm">
      {/* Title */}
      <h2 className="font-heading text-base font-semibold text-gold">
        命盘摘要
      </h2>

      {/* Four Pillars */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {(
          ["year_pillar", "month_pillar", "day_pillar", "hour_pillar"] as const
        ).map((key) => {
          const pillar = chart[key];
          const labels = ["年柱", "月柱", "日柱", "时柱"];
          const idx = [
            "year_pillar",
            "month_pillar",
            "day_pillar",
            "hour_pillar",
          ].indexOf(key);
          return (
            <div key={key} className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">{labels[idx]}</span>
              <span className="text-lg font-heading text-foreground">
                {pillar.stem}
              </span>
              <span className="text-lg font-heading text-foreground">
                {pillar.branch}
              </span>
            </div>
          );
        })}
      </div>

      {/* Day Master */}
      <div className="rounded-lg border border-border bg-card p-3">
        <span className="text-xs text-muted-foreground">日主</span>
        <p className="font-heading text-lg text-foreground">
          {chart.day_master}{" "}
          <span className="text-sm text-muted-foreground">
            ({chart.day_master_element})
          </span>
        </p>
      </div>

      {/* Element Balance */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">五行分布</h3>
        <div className="flex gap-1">
          {Object.entries(element_balance).map(([el, count]) => {
            const color = ELEMENT_COLORS[el] ?? "#e6edf3";
            const total = Object.values(element_balance).reduce(
              (a, b) => a + b,
              0
            );
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={el} className="flex flex-col items-center flex-1 gap-1">
                <div className="relative w-full h-16 rounded bg-background overflow-hidden">
                  <div
                    className="absolute bottom-0 w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(pct, 5)}%`,
                      backgroundColor: color,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color }}>
                  {el}
                </span>
                <span className="text-xs text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Favorable Elements */}
      {favorable_elements.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-1">喜用神</h3>
          <div className="flex flex-wrap gap-1">
            {favorable_elements.map((el) => (
              <span
                key={el}
                className="rounded px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: `${ELEMENT_COLORS[el] ?? "#e6edf3"}20`,
                  color: ELEMENT_COLORS[el] ?? "#e6edf3",
                }}
              >
                {el}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-1">概述</h3>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6">
            {summary}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Chat Page ──────────────────────────────────────────────────────────

export default function Chat() {
  const reading = useBaziStore((s) => s.reading);
  const provider = useSettingsStore((s) => s.ai_provider);
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);

  // Track whether we've already sent the auto-greeting.
  const greetingSentRef = useRef(false);

  // ── SSE hook ──────────────────────────────────────────────────────

  const handleComplete = useCallback(
    (msg: ChatMessage) => {
      addMessage(msg);
    },
    [addMessage]
  );

  const {
    isStreaming,
    tokens,
    status,
    toolCalls,
    error,
    sendMessage,
  } = useChatSSE({
    provider,
    chartData: reading,
    history: messages,
    onComplete: handleComplete,
  });

  // ── Auto-greeting on first load with chart ────────────────────────

  useEffect(() => {
    if (!reading || greetingSentRef.current || messages.length > 0) return;
    greetingSentRef.current = true;

    const greeting =
      "你好，玄冥大师。我已经排好了命盘，请您先简单介绍一下这个命盘的基本格局。";

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content: greeting,
      timestamp: Date.now(),
    };
    addMessage(userMsg);
    sendMessage(greeting);
  }, [reading, messages.length, addMessage, sendMessage]);

  // ── Send handler ──────────────────────────────────────────────────

  const [localError, setLocalError] = useState<string | null>(null);

  const handleSend = useCallback(
    (text: string) => {
      setLocalError(null);

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      addMessage(userMsg);
      sendMessage(text);
    },
    [addMessage, sendMessage]
  );

  const handleRetry = useCallback(() => {
    // Re-send the last user message.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      sendMessage(lastUser.content);
    }
  }, [messages, sendMessage]);

  // ── Combine errors ────────────────────────────────────────────────

  const displayError = localError ?? error;

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in flex h-[calc(100vh-80px)] gap-4">
      {/* Sidebar: chart summary */}
      <aside className="hidden w-64 shrink-0 lg:block rounded-xl border border-border bg-background overflow-y-auto">
        <ChartSummarySidebar />
      </aside>

      {/* Main chat panel */}
      <div className="flex-1 min-w-0">
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          status={status}
          streamingTokens={tokens}
          streamingToolCalls={toolCalls}
          error={displayError}
          hasChart={!!reading}
          onSend={handleSend}
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
}
