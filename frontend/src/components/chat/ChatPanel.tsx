/**
 * ChatPanel – full chat interface combining message list, tool call status,
 * input area, and empty state.
 *
 * Features:
 * - Scrollable message list with auto-scroll on new messages
 * - ChatInput at bottom
 * - ToolCallStatus panels between messages
 * - Empty state: "请先排盘，然后向玄冥大师提问"
 * - Status bar showing current streaming status
 */

import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChatMessageBubble } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import type { ChatMessage, ToolCallInfo } from "@/types/bazi";

// ── Component ──────────────────────────────────────────────────────────

interface ChatPanelProps {
  /** All messages in the conversation. */
  messages: ChatMessage[];
  /** Whether a stream is currently in progress. */
  isStreaming: boolean;
  /** Current streaming status text. */
  status?: string;
  /** Current streaming tokens (partial assistant response). */
  streamingTokens?: string;
  /** Tool calls from the current stream. */
  streamingToolCalls?: ToolCallInfo[];
  /** Error message to display. */
  error?: string | null;
  /** Whether the chart has been loaded (enables input). */
  hasChart: boolean;
  /** Called when the user sends a message. */
  onSend: (message: string) => void;
  /** Called when the user clicks the retry button after an error. */
  onRetry?: () => void;
  className?: string;
}

export function ChatPanel({
  messages,
  isStreaming,
  status,
  streamingTokens,
  streamingToolCalls,
  error,
  hasChart,
  onSend,
  onRetry,
  className,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll to bottom ──────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingTokens, scrollToBottom]);

  // ── Build the streaming preview message ────────────────────────────

  const streamingMessage: ChatMessage | null =
    isStreaming
      ? {
          id: "streaming_preview",
          role: "assistant",
          content: streamingTokens ?? "",
          timestamp: Date.now(),
          tool_calls:
            streamingToolCalls && streamingToolCalls.length > 0
              ? streamingToolCalls
              : undefined,
        }
      : null;

  // ── Empty state ────────────────────────────────────────────────────

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border border-[#30363d] bg-[#0d1117] overflow-hidden",
        className
      )}
    >
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {isEmpty ? (
          <EmptyState hasChart={hasChart} />
        ) : (
          <>
            {/* History messages */}
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming preview */}
            {streamingMessage && (
              <ChatMessageBubble
                message={streamingMessage}
                isStreaming
              />
            )}
          </>
        )}

        {/* Error banner */}
        {error && (
          <div className="mx-auto max-w-md rounded-lg border border-[#e94560]/40 bg-[#e94560]/10 px-4 py-3 text-sm text-[#e94560]">
            <p className="font-medium mb-1">请求出错</p>
            <p className="text-xs text-[#e94560]/80">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-xs text-[#d4af37] hover:underline"
              >
                重试
              </button>
            )}
          </div>
        )}

        {/* Invisible anchor for auto-scroll */}
        <div ref={bottomRef} />
      </div>

      {/* Status bar */}
      {isStreaming && status && (
        <div className="border-t border-[#30363d] bg-[#161b22] px-4 py-1.5">
          <p className="text-xs text-[#8b949e] animate-pulse">{status}</p>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[#30363d] bg-[#161b22] p-3">
        <ChatInput
          onSend={onSend}
          disabled={isStreaming || !hasChart}
        />
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────

function EmptyState({ hasChart }: { hasChart: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-center">
      {/* Brand mark — static halo, entrance only. */}
      <div className="relative grid place-items-center">
        <div
          aria-hidden
          className="absolute h-28 w-28 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgb(212 175 55 / 0.10) 0%, transparent 68%)",
          }}
        />
        <span className="relative text-5xl text-[#d4af37]/90">☰</span>
      </div>

      {hasChart ? (
        <>
          <h3 className="font-heading text-lg text-[#d4af37]">
            向玄冥大师提问
          </h3>
          <p className="max-w-sm text-sm text-[#8b949e]">
            命盘已排好，请输入您想了解的问题，玄冥大师将为您解答。
          </p>
        </>
      ) : (
        <>
          <h3 className="font-heading text-lg text-[#d4af37]">
            请先排盘
          </h3>
          <p className="max-w-sm text-sm text-[#8b949e]">
            请先在排盘页面输入出生信息，然后向玄冥大师提问。
          </p>
        </>
      )}
    </div>
  );
}

export default ChatPanel;
