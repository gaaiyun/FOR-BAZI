/**
 * 格局判定 —— tools/geju_analyzer.py 的 TypeScript 移植。
 *
 * 这里刻意把两件事分开报告，因为它们是**两个不同的维度**：
 *   - 「格局名称」由月令取格决定（月支藏干透干 -> 十神 -> 格），与日主强弱无关；
 *   - 「日主强弱」由五行力量决定，描述日主能否担起这个结构。
 *
 * 旧后端会在判身弱时用「从财/从杀/从儿等（需细辨）」覆盖掉已经算对的取格结果，
 * 导致同一份提示词里出现互斥结论。移植版保持修正后的行为。
 */

import { LunarUtil } from "lunar-typescript";
import type { BaziChart } from "./bazi";
import { GAN_TO_ELEMENT, ZHI_HIDDEN_STEMS, calculateWuXingPower, ELEMENTS } from "./wuxing";

const SHI_SHEN: Record<string, string> = LunarUtil.SHI_SHEN as Record<string, string>;

/** 阳干。传统判准：阳干只要四柱见一点印或比劫之助，即不舍命相从。 */
const YANG_GAN = new Set(["甲", "丙", "戊", "庚", "壬"]);

const SHENG: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const KE: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };

const YIN = new Set(["正印", "偏印"]);
const BIJIE = new Set(["比肩", "劫财"]);

export interface GeJu {
  格局类型: string;
  格局名称: string;
  月令: string;
  月令主气: string;
  月干透干: boolean;
  透干位置: string;
  日主强弱: string;
  日主力量占比: number;
  最旺五行: string;
  从格判定: string;
  生扶力量: { 印星: string[]; 比劫: string[] };
  从格名称?: string;
  context: string;
}

function shishen(dayMaster: string, other: string): string {
  return SHI_SHEN[dayMaster + other] ?? "";
}

/** 四柱中除日干以外的全部天干与地支藏干。 */
function allOtherStems(pillars: string[]): string[] {
  const stems: string[] = [];
  pillars.forEach((pillar, idx) => {
    if (!pillar) return;
    const gan = pillar.length >= 1 ? pillar[0] : "";
    const zhi = pillar.length >= 2 ? pillar[1] : "";
    // 日干本身不算「帮扶」，但日支藏干算。
    if (gan && idx !== 2) stems.push(gan);
    if (zhi) stems.push(...(ZHI_HIDDEN_STEMS[zhi] ?? []));
  });
  return stems;
}

function supportForDayMaster(dayMaster: string, pillars: string[]) {
  const 印星: string[] = [];
  const 比劫: string[] = [];
  for (const stem of allOtherStems(pillars)) {
    const name = shishen(dayMaster, stem);
    if (YIN.has(name)) 印星.push(stem);
    else if (BIJIE.has(name)) 比劫.push(stem);
  }
  return { 印星, 比劫 };
}

/** 按最旺五行与日主的生克关系，给出确定的从格名称，而不是「需细辨」。 */
function congName(dmElem: string, dominant: string): string {
  if (!dmElem || !dominant) return "从格";
  if (dominant === dmElem) return "从旺格（专旺）";
  if (dominant === KE[dmElem]) return "从财格";
  if (KE[dominant] === dmElem) return "从杀格";
  if (dominant === SHENG[dmElem]) return "从儿格";
  if (SHENG[dominant] === dmElem) return "从强格（从印）";
  return "从格";
}

export function analyzeGeJu(chart: Pick<BaziChart, "pillars" | "day_master" | "dishi">): GeJu | { context: string } {
  const pillars = chart.pillars ?? [];
  const dayMaster = (chart.day_master ?? "").trim();
  if (pillars.length < 2 || !dayMaster) return { context: "命盘数据不完整。" };

  const monthPillar = pillars[1] ?? "";
  const monthGan = monthPillar.length >= 1 ? monthPillar[0] : "";
  const monthZhi = monthPillar.length >= 2 ? monthPillar[1] : "";
  const hidden = ZHI_HIDDEN_STEMS[monthZhi] ?? [];
  const monthMainQi = hidden[0] ?? "";
  const yearGan = (pillars[0] ?? "").length >= 1 ? pillars[0][0] : "";
  const timeGan = pillars.length >= 4 && (pillars[3] ?? "").length >= 1 ? pillars[3][0] : "";

  const wp = calculateWuXingPower(chart);
  const power = wp.power;

  const dmElem = GAN_TO_ELEMENT[dayMaster] ?? "";
  const dmPower = power[dmElem] ?? 0;

  // ── 取格：月支藏干透月干 > 透年/时干 > 月干坐根；月令主气为比劫则建禄/月劫 ──
  let shishenName = "";
  let touganWhere = "";
  let isTougan = false;
  let gejuName: string;

  const mainQiShiShen = monthMainQi ? shishen(dayMaster, monthMainQi) : "";
  if (monthMainQi && (mainQiShiShen === "比肩" || mainQiShiShen === "劫财")) {
    shishenName = monthMainQi === dayMaster ? "建禄" : "月劫";
    gejuName = `${shishenName}格`;
    isTougan = monthGan === monthMainQi;
    touganWhere = isTougan ? "月干" : "";
  } else {
    if (monthGan && hidden.includes(monthGan)) {
      shishenName = shishen(dayMaster, monthGan);
      touganWhere = "月干";
      isTougan = true;
    }
    if (!shishenName && yearGan && hidden.includes(yearGan)) {
      shishenName = shishen(dayMaster, yearGan);
      touganWhere = "年干";
      isTougan = false;
    }
    if (!shishenName && timeGan && hidden.includes(timeGan)) {
      shishenName = shishen(dayMaster, timeGan);
      touganWhere = "时干";
      isTougan = false;
    }
    if (!shishenName && monthGan) {
      for (const idx of [0, 2, 3]) {
        const p = pillars[idx];
        if (p && p.length >= 2 && (ZHI_HIDDEN_STEMS[p[1]] ?? []).includes(monthGan)) {
          shishenName = shishen(dayMaster, monthGan);
          touganWhere = "月干坐根";
          break;
        }
      }
    }
    gejuName = shishenName ? `${shishenName}格` : "月令格";
    if (!touganWhere) isTougan = monthGan === monthMainQi;
  }

  // ── 日主强弱 ──
  const totalPower = ELEMENTS.reduce((s, k) => s + (power[k] ?? 0), 0) || 1;
  const dmRatio = (dmPower / totalPower) * 100;
  const maxOther = Math.max(...ELEMENTS.filter((k) => k !== dmElem).map((k) => power[k] ?? 0), 0);
  const maxOtherRatio = (maxOther / totalPower) * 100;

  let strength: string;
  if (dmRatio >= 35) strength = "身旺";
  else if (dmRatio <= 20) strength = "身弱";
  else strength = "中和";

  // ── 从格：力量条件只是入口，真正决定的是有无印比生扶 ──
  const support = supportForDayMaster(dayMaster, pillars);
  const hasSupport = support.印星.length > 0 || support.比劫.length > 0;
  const dominant = ELEMENTS.reduce((a, b) => ((power[a] ?? 0) >= (power[b] ?? 0) ? a : b));

  let congType = "非从格";
  let congReason = "";
  if (dmRatio <= 15 && maxOtherRatio >= 40) {
    if (!hasSupport) {
      congType = "真从";
      congReason = "日主无根，且全局不见印星与比劫生扶。";
    } else if (YANG_GAN.has(dayMaster)) {
      congType = "非从格";
      const parts: string[] = [];
      if (support.印星.length) parts.push("印星");
      if (support.比劫.length) parts.push("比劫");
      congReason =
        `日主${dayMaster}为阳干，命局见${parts.join("、")}` +
        `（${[...support.印星, ...support.比劫].join("、")}）生扶。` +
        "阳干得一分生助即不舍命相从，故不作从格论，按身弱正格取用。";
    } else {
      congType = "假从";
      congReason =
        `日主${dayMaster}为阴干，虽见${[...support.印星, ...support.比劫].join("、")}` +
        "生扶但力弱，可作假从论，仍需兼顾印比。";
    }
  }

  let gejuType: string;
  let congN = "";
  if (congType === "真从") {
    gejuType = "从格";
    congN = congName(dmElem, dominant);
  } else if (congType === "假从") {
    gejuType = "假从格";
    congN = congName(dmElem, dominant);
  } else {
    gejuType = `正格（${strength}）`;
  }

  const ratio = Math.round(dmRatio * 10) / 10;
  const contextExtra = touganWhere ? `透干位置：${touganWhere}。` : "";
  let congText = "";
  if (congN) congText = `从格倾向：${congN}（${congType}）。${congReason}`;
  else if (congReason) congText = `曾触发从格力量条件，但不成立：${congReason}`;

  const out: GeJu = {
    格局类型: gejuType,
    格局名称: gejuName,
    月令: monthZhi,
    月令主气: monthMainQi,
    月干透干: isTougan,
    透干位置: touganWhere || (isTougan ? "月干" : ""),
    日主强弱: strength,
    日主力量占比: ratio,
    最旺五行: dominant,
    从格判定: congType,
    生扶力量: support,
    context:
      `命局取${gejuName}，为${gejuType}。月令${monthZhi}主气${monthMainQi}，${isTougan ? "透干" : "不透"}。` +
      `${contextExtra}日主${strength}（占比${ratio}%），最旺五行为${dominant}。${congText}`,
  };
  if (congN) out.从格名称 = congN;
  return out;
}
