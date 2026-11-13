/**
 * 昼夜主题。
 *
 * 三档：跟随系统 / 昼 / 夜。实际生效的是 <html> 上有没有 .dark。
 * index.html 里另有一段内联脚本在首帧之前做同样的事，避免先白后黑的闪烁；
 * 两处的存储键和判断逻辑必须一致。
 */

export type ThemeMode = "system" | "light" | "dark";

const media =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return media?.matches ? "dark" : "light";
  return mode;
}

export function applyTheme(mode: ThemeMode): void {
  const dark = resolveTheme(mode) === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0e1014" : "#f4f5f7");
}

/** 跟随系统时，系统切换昼夜要即时响应。返回取消监听的函数。 */
export function watchSystemTheme(onChange: () => void): () => void {
  if (!media) return () => {};
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
