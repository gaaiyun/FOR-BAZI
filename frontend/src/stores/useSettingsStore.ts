/**
 * Zustand store for application settings.
 * Persists AI provider config, theme, and language preferences.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIProviderConfig, AppSettings } from "@/types/bazi";

interface SettingsState extends AppSettings {
  /** Whether the settings dialog is open. */
  settingsOpen: boolean;
}

interface SettingsActions {
  /** Update the AI provider configuration. */
  setAIProvider: (config: Partial<AIProviderConfig>) => void;
  /** Set the theme. */
  setTheme: (theme: AppSettings["theme"]) => void;
  /** Set the language. */
  setLanguage: (lang: "zh" | "en") => void;
  /** Toggle settings dialog. */
  toggleSettings: () => void;
  /** Set settings dialog open state. */
  setSettingsOpen: (open: boolean) => void;
}

const DEFAULT_SETTINGS: SettingsState = {
  ai_provider: {
    provider: "cloudflare",
    api_key: "",
    model: "deepseek-flash",
    base_url: "",
    streaming: true,
  },
  theme: "system",
  language: "zh",
  settingsOpen: false,
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      // State
      ...DEFAULT_SETTINGS,

      // Actions
      setAIProvider: (config) =>
        set((state) => ({
          ai_provider: { ...state.ai_provider, ...config },
        })),

      setTheme: (theme) => set({ theme }),

      setLanguage: (language) => set({ language }),

      toggleSettings: () =>
        set((state) => ({ settingsOpen: !state.settingsOpen })),

      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    }),
    {
      name: "settings-storage",
      // v1：站内默认模型从 Workers AI 的 glm-4.7-flash 换成 DeepSeek。
      // 旧版存下的还是 glm，不迁移的话老用户会一直绕开 DeepSeek。
      version: 1,
      migrate: (persisted, from) => {
        const st = (persisted ?? {}) as Partial<SettingsState>;
        if (from < 1 && st.ai_provider?.provider === "cloudflare" && st.ai_provider.model === "@cf/zai-org/glm-4.7-flash") {
          st.ai_provider = { ...st.ai_provider, model: "deepseek-flash" };
        }
        return st as SettingsState & SettingsActions;
      },
      partialize: (state) => ({
        ai_provider: state.ai_provider,
        theme: state.theme,
        language: state.language,
      }),
    }
  )
);
