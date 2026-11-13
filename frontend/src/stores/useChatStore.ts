/**
 * Zustand store for AI chat / consultation messages.
 * Persists chat history to localStorage.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "@/types/bazi";

interface ChatState {
  /** All messages in the current conversation. */
  messages: ChatMessage[];
  /** Whether an AI response is being generated. */
  isStreaming: boolean;
  /** Error from the last failed message. */
  error: string | null;
  /** 这段对话属于哪一份命盘（BaziReading.id） */
  chartId: string | null;
}

interface ChatActions {
  /** Append a message to the conversation. */
  addMessage: (message: ChatMessage) => void;
  /** Update the content of an existing message (for streaming). */
  updateMessage: (id: string, content: string) => void;
  /** Set streaming state. */
  setStreaming: (streaming: boolean) => void;
  /** Set error. */
  setError: (error: string | null) => void;
  /** Clear all messages. */
  clearMessages: () => void;
  /** 记下这段对话对应的命盘 */
  setChartId: (id: string | null) => void;
}

let messageCounter = 0;

/** Generate a unique message ID. */
function generateId(): string {
  messageCounter += 1;
  return `msg_${Date.now()}_${messageCounter}`;
}

export const useChatStore = create<ChatState & ChatActions>()(
  persist(
    (set) => ({
      // State
      messages: [],
      isStreaming: false,
      error: null,
      chartId: null,

      // Actions
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, { ...message, id: message.id || generateId() }],
        })),

      updateMessage: (id, content) =>
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, content } : msg
          ),
        })),

      setStreaming: (isStreaming) => set({ isStreaming }),

      setError: (error) => set({ error, isStreaming: false }),

      clearMessages: () => set({ messages: [], error: null, chartId: null }),
      setChartId: (chartId) => set({ chartId }),
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({
        messages: state.messages,
        chartId: state.chartId,
      }),
    }
  )
);

export { generateId };
