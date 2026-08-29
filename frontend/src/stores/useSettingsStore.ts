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
  setTheme: (theme: "dark" | "light") => void;
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
    model: "@cf/zai-org/glm-4.7-flash",
    base_url: "",
    streaming: true,
  },
  theme: "dark",
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
      partialize: (state) => ({
        ai_provider: state.ai_provider,
        theme: state.theme,
        language: state.language,
      }),
    }
  )
);
