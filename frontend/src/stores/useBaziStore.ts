/**
 * Zustand store for Bazi calculation state.
 * Persists the latest reading and input to localStorage.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BaziInput, BaziReading } from "@/types/bazi";
import { calculateBazi } from "@/lib/api";

interface BaziState {
  /** The current input form data. */
  input: BaziInput;
  /** The latest calculated Bazi reading. */
  reading: BaziReading | null;
  /** Whether a calculation request is in flight. */
  isLoading: boolean;
  /** Error message from the last failed request. */
  error: string | null;
  /** History of past readings (for comparison). */
  history: BaziReading[];
}

interface BaziActions {
  /** Update the input form fields. */
  setInput: (input: Partial<BaziInput>) => void;
  /** Set the calculated reading. */
  setReading: (reading: BaziReading | null) => void;
  /** Set loading state. */
  setLoading: (loading: boolean) => void;
  /** Set error message. */
  setError: (error: string | null) => void;
  /** Add a reading to history. */
  addToHistory: (reading: BaziReading) => void;
  /**
   * Calculate Bazi from current input.
   * Returns the reading on success, null on failure.
   * Caller is responsible for navigation after success.
   */
  calculate: () => Promise<BaziReading | null>;
  /** 切换到历史里的某份命盘，并把表单同步成它的出生信息。 */
  openFromHistory: (id: string) => void;
  /** 从历史里删除一份命盘。 */
  removeFromHistory: (id: string) => void;
  /** Clear all state. */
  reset: () => void;
}

const DEFAULT_INPUT: BaziInput = {
  birth_date: "",
  birth_time: "",
  gender: "male",
  time_known: true,
  calendar_type: "solar",
  lunar_leap: false,
  true_solar: false,
  longitude: null,
  place: "",
  name: "",
};

/** 同一份命盘（同一排盘时刻与性别）只留最新一条，最多 20 条。 */
function pushHistory(history: BaziReading[], reading: BaziReading): BaziReading[] {
  const rest = reading.id ? history.filter((h) => h.id !== reading.id) : history;
  return [reading, ...rest].slice(0, 20);
}

export const useBaziStore = create<BaziState & BaziActions>()(
  persist(
    (set, get) => ({
      // State
      input: DEFAULT_INPUT,
      reading: null,
      isLoading: false,
      error: null,
      history: [],

      // Actions
      setInput: (partial) =>
        set((state) => ({
          input: { ...state.input, ...partial },
        })),

      setReading: (reading) => set({ reading, error: null }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error, isLoading: false }),

      addToHistory: (reading) =>
        set((state) => ({
          history: pushHistory(state.history, reading),
        })),

      calculate: async () => {
        const { input } = get();
        if (!input.birth_date || !input.birth_time) {
          set({ error: "请填写完整的出生日期和时间。" });
          return null;
        }
        set({ isLoading: true, error: null });
        try {
          const reading = await calculateBazi(input);
          set((state) => ({
            reading,
            isLoading: false,
            error: null,
            history: pushHistory(state.history, reading),
          }));
          return reading;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "计算失败，请重试。";
          set({ error: message, isLoading: false });
          return null;
        }
      },

      openFromHistory: (id) =>
        set((state) => {
          const hit = state.history.find((h) => h.id === id);
          if (!hit) return {};
          const b = hit.birth;
          return {
            reading: hit,
            error: null,
            input: b
              ? {
                  ...state.input,
                  birth_date: b.input_date,
                  birth_time: b.input_time,
                  gender: b.gender,
                  calendar_type: b.calendar,
                  lunar_leap: Boolean(b.lunar_leap),
                  true_solar: typeof b.longitude === "number",
                  longitude: b.longitude ?? null,
                  place: b.place ?? "",
                  name: b.name ?? "",
                }
              : state.input,
          };
        }),

      removeFromHistory: (id) =>
        set((state) => ({
          history: state.history.filter((h) => h.id !== id),
          reading: state.reading?.id === id ? null : state.reading,
        })),

      reset: () =>
        set({
          input: DEFAULT_INPUT,
          reading: null,
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: "bazi-storage",
      // 旧版本存下的 input 缺少新字段，合并时用默认值补齐。
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BaziState>;
        return { ...current, ...p, input: { ...DEFAULT_INPUT, ...(p.input ?? {}) } };
      },
      partialize: (state) => ({
        input: state.input,
        reading: state.reading,
        history: state.history,
      }),
    }
  )
);
