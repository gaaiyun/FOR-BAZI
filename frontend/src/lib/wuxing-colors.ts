/**
 * 五行配色。
 *
 * 颜色值是 CSS 变量而不是十六进制：昼夜两套主题下同一个五行要用不同的
 * 明度才看得清，交给样式表决定。因此这里返回的字符串只能用在 color / fill /
 * stroke / background 上，不能再往后拼透明度后缀——要半透明请用 color-mix。
 */

import { elementOf } from "./ganzhi";

export const ELEMENT_COLORS: Record<string, string> = {
  木: "var(--wx-wood)",
  火: "var(--wx-fire)",
  土: "var(--wx-earth)",
  金: "var(--wx-metal)",
  水: "var(--wx-water)",
};

/** 干支字 → 五行色。未知字符退回正文色。 */
export function getCharColor(char: string, fallback = "var(--foreground)"): string {
  return ELEMENT_COLORS[elementOf(char)] ?? fallback;
}

/** 五行名 → 五行色。 */
export function getElementColor(element: string, fallback = "var(--foreground)"): string {
  return ELEMENT_COLORS[element] ?? fallback;
}

/** 某个五行色的半透明版本。 */
export function tint(color: string, percent: number): string {
  return `color-mix(in oklab, ${color} ${percent}%, transparent)`;
}

/** 兼容旧引用：逐字查色。 */
export const WUXING_CHAR_COLORS: Record<string, string> = new Proxy(
  {},
  { get: (_t, key) => (typeof key === "string" ? ELEMENT_COLORS[elementOf(key)] : undefined) }
) as Record<string, string>;
