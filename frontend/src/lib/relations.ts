/**
 * 一组外来干支（大运或流年）与原局四柱的关系。
 *
 * 引擎的 xingchong 只算原局四柱内部；看某一年时还需要「这一年冲了谁、合了谁」，
 * 这里按同一套表另算一遍。只报事实，不下吉凶判断。
 */

import { STEM_ELEMENT, KE } from "./ganzhi";

export interface Relation {
  /** 作用在哪一柱：年 / 月 / 日 / 时 */
  pillar: string;
  /** 关系类别 */
  kind: "伏吟" | "反吟" | "干合" | "干克" | "六冲" | "六合" | "相害" | "相破" | "相刑" | "半三合";
  /** 可直接展示的一句话 */
  text: string;
}

const GAN_HE: Array<[string, string, string]> = [
  ["甲", "己", "土"], ["乙", "庚", "金"], ["丙", "辛", "水"], ["丁", "壬", "木"], ["戊", "癸", "火"],
];
const CHONG: Array<[string, string]> = [
  ["子", "午"], ["丑", "未"], ["寅", "申"], ["卯", "酉"], ["辰", "戌"], ["巳", "亥"],
];
const LIU_HE: Array<[string, string]> = [
  ["子", "丑"], ["寅", "亥"], ["卯", "戌"], ["辰", "酉"], ["巳", "申"], ["午", "未"],
];
const HAI: Array<[string, string]> = [
  ["子", "未"], ["丑", "午"], ["寅", "巳"], ["卯", "辰"], ["申", "亥"], ["酉", "戌"],
];
const PO: Array<[string, string]> = [
  ["子", "酉"], ["卯", "午"], ["辰", "丑"], ["戌", "未"], ["寅", "亥"], ["巳", "申"],
];
const XING: Array<[string, string]> = [
  ["子", "卯"], ["寅", "巳"], ["巳", "申"], ["寅", "申"], ["丑", "戌"], ["戌", "未"], ["丑", "未"],
];
const ZI_XING = ["辰", "午", "酉", "亥"];
const HALF_HE: Array<[string, string, string]> = [
  ["申", "子", "水"], ["子", "辰", "水"], ["巳", "酉", "金"], ["酉", "丑", "金"],
  ["寅", "午", "火"], ["午", "戌", "火"], ["亥", "卯", "木"], ["卯", "未", "木"],
];

function pair(table: Array<[string, string]>, a: string, b: string): boolean {
  return table.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

const LABELS = ["年", "月", "日", "时"];

/**
 * @param ganzhi  外来干支，如流年「丙午」
 * @param pillars 原局四柱 [年, 月, 日, 时]
 */
export function relationsWith(ganzhi: string, pillars: string[]): Relation[] {
  const g = ganzhi[0] ?? "";
  const z = ganzhi[1] ?? "";
  const out: Relation[] = [];
  if (!g || !z) return out;

  pillars.forEach((p, i) => {
    const pg = p?.[0] ?? "";
    const pz = p?.[1] ?? "";
    if (!pg || !pz) return;
    const label = LABELS[i] ?? "";

    if (pg === g && pz === z) {
      out.push({ pillar: label, kind: "伏吟", text: `与${label}柱${p}干支全同（伏吟）` });
      return;
    }

    // 天干
    const he = GAN_HE.find(([x, y]) => (x === g && y === pg) || (x === pg && y === g));
    const eg = STEM_ELEMENT[g];
    const ep = STEM_ELEMENT[pg];
    const ganKe = eg && ep && (KE[eg] === ep || KE[ep] === eg);
    if (he) {
      out.push({ pillar: label, kind: "干合", text: `${g}${pg}合${he[2]}（${label}干）` });
    } else if (ganKe && pair(CHONG, z, pz)) {
      out.push({ pillar: label, kind: "反吟", text: `与${label}柱${p}天克地冲（反吟）` });
      return;
    } else if (ganKe) {
      const [from, to] = KE[eg] === ep ? [g, pg] : [pg, g];
      out.push({ pillar: label, kind: "干克", text: `${from}克${to}（${label}干）` });
    }

    // 地支
    if (pair(CHONG, z, pz)) out.push({ pillar: label, kind: "六冲", text: `${z}${pz}相冲（${label}支）` });
    if (pair(LIU_HE, z, pz)) out.push({ pillar: label, kind: "六合", text: `${z}${pz}六合（${label}支）` });
    if (pair(HAI, z, pz)) out.push({ pillar: label, kind: "相害", text: `${z}${pz}相害（${label}支）` });
    if (pair(PO, z, pz) && !pair(LIU_HE, z, pz)) {
      out.push({ pillar: label, kind: "相破", text: `${z}${pz}相破（${label}支）` });
    }
    if (pair(XING, z, pz) && !pair(CHONG, z, pz)) {
      out.push({ pillar: label, kind: "相刑", text: `${z}${pz}相刑（${label}支）` });
    }
    if (z === pz && ZI_XING.includes(z)) {
      out.push({ pillar: label, kind: "相刑", text: `${z}${pz}自刑（${label}支）` });
    }
    const half = HALF_HE.find(([x, y]) => (x === z && y === pz) || (x === pz && y === z));
    if (half) {
      out.push({ pillar: label, kind: "半三合", text: `${z}${pz}半合${half[2]}局（${label}支）` });
    }
  });

  return out;
}
