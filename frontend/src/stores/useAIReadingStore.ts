/**
 * AI 解读结果的本地存档。
 *
 * 解读一次要几十秒，还占一次额度；旧版刷新页面或切走再回来就没了。
 * 这里按「命盘 + 主题」存下最近的结果，回到解读页直接能看。
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ToolCallInfo } from "@/types/bazi";

export interface SavedReading {
  content: string;
  toolCalls: ToolCallInfo[];
  at: number;
  model: string;
}

interface State {
  /** key = `${chartId}::${topicId}` */
  saved: Record<string, SavedReading>;
  save: (key: string, value: SavedReading) => void;
  remove: (key: string) => void;
}

const MAX = 24;

export const useAIReadingStore = create<State>()(
  persist(
    (set) => ({
      saved: {},
      save: (key, value) =>
        set((s) => {
          const next = { ...s.saved, [key]: value };
          // 只留最近的若干份，避免 localStorage 越积越大
          const keys = Object.keys(next).sort((a, b) => next[b].at - next[a].at);
          for (const k of keys.slice(MAX)) delete next[k];
          return { saved: next };
        }),
      remove: (key) =>
        set((s) => {
          const next = { ...s.saved };
          delete next[key];
          return { saved: next };
        }),
    }),
    { name: "ai-reading-storage" }
  )
);
