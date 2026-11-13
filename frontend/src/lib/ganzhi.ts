/**
 * 干支基础表与小工具。
 *
 * 展示层此前各页各抄一份天干五行、地支藏干表，这里收成一份。
 * 十神与藏干直接取 lunar-typescript 的表，和排盘引擎同源，不会两边漂移。
 */

import { LunarUtil } from "lunar-typescript";

export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export const BRANCHES = [
  "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
] as const;

export const ELEMENTS = ["木", "火", "土", "金", "水"] as const;
export type Element = (typeof ELEMENTS)[number];

export const STEM_ELEMENT: Record<string, Element> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

export const BRANCH_ELEMENT: Record<string, Element> = {
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
};

export const HIDDEN_STEMS = LunarUtil.ZHI_HIDE_GAN as Record<string, string[]>;
const SHI_SHEN = LunarUtil.SHI_SHEN as Record<string, string>;

/** 相生：木→火→土→金→水→木 */
export const SHENG: Record<Element, Element> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
/** 相克：木→土→水→火→金→木 */
export const KE: Record<Element, Element> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };

export function elementOf(char: string): Element | "" {
  return STEM_ELEMENT[char] ?? BRANCH_ELEMENT[char] ?? "";
}

export function isYang(char: string): boolean {
  const s = STEMS.indexOf(char as (typeof STEMS)[number]);
  if (s >= 0) return s % 2 === 0;
  const b = BRANCHES.indexOf(char as (typeof BRANCHES)[number]);
  return b >= 0 && b % 2 === 0;
}

/** 日主对某天干的十神。 */
export function tenGod(dayMaster: string, stem: string): string {
  return SHI_SHEN[dayMaster + stem] ?? "";
}

/** 日主对某地支的十神，按本气取。 */
export function tenGodOfBranch(dayMaster: string, branch: string): string {
  const main = HIDDEN_STEMS[branch]?.[0];
  return main ? tenGod(dayMaster, main) : "";
}

/** 十神归入五类，用于分布统计。 */
export const TEN_GOD_GROUP: Record<string, string> = {
  比肩: "比劫", 劫财: "比劫",
  食神: "食伤", 伤官: "食伤",
  偏财: "财星", 正财: "财星",
  七杀: "官杀", 正官: "官杀",
  偏印: "印星", 正印: "印星",
};
export const TEN_GOD_GROUPS = ["比劫", "食伤", "财星", "官杀", "印星"] as const;

/** 公历年对应的干支（以 1984 甲子为基准；立春前出生者的年柱以引擎为准）。 */
export function yearGanzhi(year: number): string {
  const s = (((year - 1984) % 10) + 10) % 10;
  const b = (((year - 1984) % 12) + 12) % 12;
  return STEMS[s] + BRANCHES[b];
}

/** 六十甲子纳音。 */
export function nayinOf(ganzhi: string): string {
  return (LunarUtil.NAYIN as Record<string, string>)[ganzhi] ?? "";
}
