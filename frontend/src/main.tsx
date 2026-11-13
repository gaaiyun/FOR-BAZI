/**
 * Application entry point.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { applyTheme, watchSystemTheme } from "@/lib/theme";
import App from "./App";
import "./index.css";

// 主题：首帧由 index.html 的内联脚本定好，这里负责之后的切换。
applyTheme(useSettingsStore.getState().theme);
useSettingsStore.subscribe((s, prev) => {
  if (s.theme !== prev.theme) applyTheme(s.theme);
});
watchSystemTheme(() => applyTheme(useSettingsStore.getState().theme));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </BrowserRouter>
  </StrictMode>
);
