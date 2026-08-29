/**
 * 五行力量精算 —— tools/wuxing_calculator.py 的 TypeScript 移植。
 * 天干 + 月令加权 + 十二长生 + 地支藏干本中余气，归一化到 0-100。
 *
 * 旺衰结论以本模块为唯一裁定方；个数统计只是事实层，不再自己下判断
 * （后端此前两处各自判定过，结论互斥）。
 */

import { LunarUtil } from "lunar-typescript";
import type { BaziChart } from "./bazi";

export const GAN_TO_ELEMENT: Record<string, string> = LunarUtil.WU_XING_GAN as Record<string, string>;
export const ZHI_HIDDEN_STEMS: Record<string, string[]> = LunarUtil.ZHI_HIDE_GAN as Record<string, string[]>;

/** 藏干本中余气权重（子癸8；丑己5癸2辛1 …）。 */
const ZHI_HIDDEN_WEIGHTS: Record<string, number[]> = {
  子: [8], 丑: [5, 2, 1], 寅: [5, 2, 1], 卯: [8], 辰: [5, 2, 1], 巳: [5, 2, 1],
  午: [5, 3], 未: [5, 2, 1], 申: [5, 2, 1], 酉: [8], 戌: [5, 2, 1], 亥: [5, 3],
};

const CHANGSHENG_POWER: Record<string, number> = {
  长生: 1.5, 沐浴: 1.2, 冠带: 1.3, 临官: 1.6, 帝旺: 2.0,
  衰: 0.8, 病: 0.6, 死: 0.4, 墓: 0.5, 绝: 0.3, 胎: 0.7, 养: 0.9,
};

export const ELEMENTS = ["金", "木", "水", "火", "土"] as const;
export type Element = (typeof ELEMENTS)[number];

export interface WuXingPower {
  power: Record<string, number>;
  strong: string[];
  weak: string[];
  balanced: boolean;
  context: string;
}

/** Python 的 round() 是 banker's rounding，但这里保留一位小数、
 *  取值都不是 .x5 的边界情形，用常规四舍五入即可与其一致。 */
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function calculateWuXingPower(chart: Pick<BaziChart, "pillars" | "dishi">): WuXingPower {
  const pillars = chart.pillars ?? [];
  const dishi = chart.dishi ?? ["", "", "", ""];
  const MONTH_INDEX = 1;

  const power: Record<string, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };

  pillars.forEach((pillar, i) => {
    if (!pillar || pillar.length < 2) return;
    const gan = pillar[0];
    const zhi = pillar[1];

    const elem = GAN_TO_ELEMENT[gan];
    if (elem) {
      const base = 10.0 * (i === MONTH_INDEX ? 2.0 : 1.0);
      const coef = CHANGSHENG_POWER[dishi[i] ?? ""] ?? 1.0;
      power[elem] += base * coef;
    }

    const hidden = ZHI_HIDDEN_STEMS[zhi] ?? [];
    let weights = ZHI_HIDDEN_WEIGHTS[zhi] ?? [6, 3, 1].slice(0, hidden.length);
    if (weights.length > hidden.length) {
      weights = weights.slice(0, hidden.length);
    } else if (weights.length < hidden.length) {
      weights = [...weights, ...Array(hidden.length - weights.length).fill(1)];
    }
    const mult = i === MONTH_INDEX ? 1.5 : 1.0;
    weights.forEach((w, k) => {
      const e = GAN_TO_ELEMENT[hidden[k]];
      if (e) power[e] += w * mult;
    });
  });

  const total = Object.values(power).reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return { power, strong: [], weak: [], balanced: false, context: "无五行数据。" };
  }

  const pct: Record<string, number> = {};
  for (const k of ELEMENTS) pct[k] = round1((power[k] * 100) / total);

  const strong = ELEMENTS.filter((k) => pct[k] >= 20);
  const weak = ELEMENTS.filter((k) => pct[k] < 10);
  const vals = ELEMENTS.map((k) => pct[k]);
  const balanced = Math.max(...vals) - Math.min(...vals) <= 15;

  return {
    power: pct,
    strong: [...strong],
    weak: [...weak],
    balanced,
    context:
      `五行力量：${JSON.stringify(pct)}。偏旺：${strong.length ? strong.join(", ") : "无"}；` +
      `偏弱：${weak.length ? weak.join(", ") : "无"}；${balanced ? "较均衡" : "有偏"}。`,
  };
}
