/**
 * useChatSSE – custom React hook for SSE streaming chat.
 *
 * Manages the full lifecycle of a streaming chat request:
 *   1. Opens a POST connection to /api/v1/chat/stream
 *   2. Parses incoming SSE events (token, status, tool_call, done, error)
 *   3. Accumulates tokens into the response content
 *   4. Tracks tool call information
 *   5. Handles errors and abort on unmount
 */

import { useCallback, useRef, useState } from "react";
import { chatStream } from "@/lib/api";
import type {
  BaziReading,
  ChatMessage,
  AIProviderConfig,
  ToolCallInfo,
} from "@/types/bazi";

// ── Return type ────────────────────────────────────────────────────────

export interface UseChatSSEReturn {
  /** Whether a stream is currently in progress. */
  isStreaming: boolean;
  /** Tokens accumulated so far during the current stream. */
  tokens: string;
  /** Status text from the server (e.g. "Thinking...", "Searching..."). */
  status: string;
  /** Tool calls invoked during the current stream. */
  toolCalls: ToolCallInfo[];
  /** Error message if the last stream failed. */
  error: string | null;
  /**
   * Open an SSE connection and start accumulating tokens.
   * Returns a promise that resolves when the stream completes.
   */
  sendMessage: (message: string) => Promise<ChatMessage | null>;
  /** Abort the current stream. */
  abort: () => void;
}

// ── Hook ───────────────────────────────────────────────────────────────

interface UseChatSSEOptions {
  /** AI provider configuration from settings. */
  provider: AIProviderConfig;
  /** Current Bazi reading for context (optional). */
  chartData: BaziReading | null;
  /** Existing conversation history. */
  history: ChatMessage[];
  /** Called when a full assistant message is ready (stream done). */
  onComplete?: (message: ChatMessage) => void;
}

export function useChatSSE(options: UseChatSSEOptions): UseChatSSEReturn {
  const { provider, chartData, history, onComplete } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [tokens, setTokens] = useState("");
  const [status, setStatus] = useState("");
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  /** AbortController ref for cancellation. */
  const abortRef = useRef<AbortController | null>(null);
  /** Ref to track accumulated tool calls within a single stream (avoids stale closure). */
  const toolCallsRef = useRef<ToolCallInfo[]>([]);

  // ── Abort ──────────────────────────────────────────────────────────

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  // ── Send message ───────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (message: string): Promise<ChatMessage | null> => {
      // Abort any existing stream.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Reset state.
      setIsStreaming(true);
      setTokens("");
      setStatus("");
      setToolCalls([]);
      setError(null);
      toolCallsRef.current = [];

      let accumulated = "";

      // The transport is always SSE — the backend exposes no non-streaming
      // chat route. This flag controls whether partial tokens are *rendered*
      // as they arrive, matching the settings copy ("启用后AI回复将实时显示").
      const renderLive = provider.streaming !== false;

      try {
        await chatStream(
          {
            message,
            bazi_context: chartData,
            provider,
            history,
          },
          // onToken
          (token: string) => {
            accumulated += token;
            if (renderLive) setTokens(accumulated);
          },
          // onStatus
          (statusText: string) => {
            setStatus(statusText);
          },
          // onToolCall
          (data) => {
            setToolCalls((prev) => {
              const existing = prev.findIndex((tc) => tc.id === data.id);
              const updated: ToolCallInfo = {
                id: data.id,
                name: data.name,
                arguments: data.arguments,
                result: data.result,
                status: data.status,
              };
              let next: ToolCallInfo[];
              if (existing >= 0) {
                next = [...prev];
                next[existing] = updated;
              } else {
                next = [...prev, updated];
              }
              toolCallsRef.current = next;
              return next;
            });
          },
          // onDone
          () => {
            // Stream completed.
          },
          // onError
          (errMsg: string) => {
            setError(errMsg);
          },
          controller.signal
        );
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }

      // Build the assistant message if we got content.
      if (accumulated) {
        const finalToolCalls = toolCallsRef.current;
        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: "assistant",
          content: accumulated,
          timestamp: Date.now(),
          tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
        };
        onComplete?.(assistantMsg);
        return assistantMsg;
      }

      return null;
    },
    [provider, chartData, history, onComplete]
  );

  return {
    isStreaming,
    tokens,
    status,
    toolCalls,
    error,
    sendMessage,
    abort,
  };
}

export default useChatSSE;
