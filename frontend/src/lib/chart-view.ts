/**
 * 命盘的展示模型。
 *
 * 页面和「复制给 AI」的文本都需要同一批派生量（每柱藏干的十神、大运十神、
 * 当前大运、十神分布……）。集中在这里算一次，避免各页各算各的、口径不一。
 * 全部由引擎产出的事实推得，不添加任何吉凶判断。
 */

import type { BaziReading } from "@/types/bazi";
import { analyzeGeJu, type GeJu } from "@/engine/geju";
import {
  ELEMENTS, HIDDEN_STEMS, TEN_GOD_GROUP, TEN_GOD_GROUPS,
  elementOf, tenGod, tenGodOfBranch, yearGanzhi, nayinOf, type Element,
} from "./ganzhi";

export interface PillarView {
  key: "year" | "month" | "day" | "hour";
  label: string;
  /** 宫位含义 */
  palace: string;
  stem: string;
  branch: string;
  stemGod: string;
  hidden: Array<{ stem: string; god: string }>;
  nayin: string;
  dishi: string;
  xunkong: string;
  shensha: string[];
}

export interface DayunView {
  index: number;
  ganzhi: string;
  stem: string;
  branch: string;
  stemGod: string;
  branchGod: string;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
  isCurrent: boolean;
}

export interface YearView {
  year: number;
  ganzhi: string;
  stem: string;
  branch: string;
  stemGod: string;
  branchGod: string;
  nayin: string;
  /** 虚岁 */
  age: number;
}

export interface ChartView {
  pillars: PillarView[];
  dayMaster: string;
  dayMasterElement: Element | "";
  genderLabel: string;
  /** 大运顺逆 */
  direction: "顺行" | "逆行" | "";
  power: Record<Element, number>;
  strong: string[];
  weak: string[];
  geju: GeJu | null;
  dayun: DayunView[];
  currentDayun: DayunView | null;
  /** 出生年（按年柱所属的农历年推算，用于算虚岁） */
  birthYear: number | null;
  /** 十神加权分布：天干 1，藏干按本中余 0.6 / 0.3 / 0.1 */
  godGroups: Array<{ group: string; weight: number; members: string[] }>;
  relations: Array<{ kind: string; items: string[] }>;
  palaces: Array<{ label: string; value: string }>;
}

const PILLAR_META = [
  { key: "year", label: "年柱", palace: "祖上 · 早年" },
  { key: "month", label: "月柱", palace: "父母 · 青年" },
  { key: "day", label: "日柱", palace: "自身 · 配偶" },
  { key: "hour", label: "时柱", palace: "子女 · 晚年" },
] as const;

const HIDDEN_WEIGHTS = [0.6, 0.3, 0.1];
const RELATION_ORDER = ["干合", "干克", "冲", "合", "三合", "三会", "半三合", "刑", "害", "破", "双合"];

function isYangStem(stem: string): boolean {
  return "甲丙戊庚壬".includes(stem);
}

export function yearView(year: number, dayMaster: string, birthYear: number | null): YearView {
  const gz = yearGanzhi(year);
  return {
    year,
    ganzhi: gz,
    stem: gz[0],
    branch: gz[1],
    stemGod: tenGod(dayMaster, gz[0]),
    branchGod: tenGodOfBranch(dayMaster, gz[1]),
    nayin: nayinOf(gz),
    age: birthYear ? year - birthYear + 1 : 0,
  };
}

export function deriveChart(reading: BaziReading, now: Date = new Date()): ChartView {
  const ec = reading.engine_chart;
  const dm = reading.chart.day_master;
  const raw = [
    reading.chart.year_pillar, reading.chart.month_pillar,
    reading.chart.day_pillar, reading.chart.hour_pillar,
  ];

  const pillars: PillarView[] = PILLAR_META.map((m, i) => {
    const ann = reading.pillar_annotations?.[m.key];
    const p = raw[i];
    const hiddenStems = HIDDEN_STEMS[p.branch] ?? p.hidden_stems ?? [];
    return {
      key: m.key,
      label: m.label,
      palace: m.palace,
      stem: p.stem,
      branch: p.branch,
      stemGod: i === 2 ? "日主" : tenGod(dm, p.stem),
      hidden: hiddenStems.map((s) => ({ stem: s, god: tenGod(dm, s) })),
      nayin: ann?.nayin ?? p.nayin ?? "",
      dishi: ann?.dishi ?? "",
      xunkong: ann?.xunkong ?? "",
      shensha: (ann?.shensha ?? []).flatMap((s) => s.split(/\s+/)).filter(Boolean),
    };
  });

  // 五行力量
  const src = (reading.wuxing_power ?? reading.element_balance) as unknown as Record<string, number>;
  const total = ELEMENTS.reduce((s, e) => s + (src[e] ?? 0), 0) || 1;
  const power = Object.fromEntries(
    ELEMENTS.map((e) => [e, Math.round(((src[e] ?? 0) / total) * 1000) / 10])
  ) as Record<Element, number>;

  // 格局：引擎原件在手就直接重算，拿到全部结构化字段
  let geju: GeJu | null = null;
  if (ec) {
    const g = analyzeGeJu(ec);
    if ("格局名称" in g) geju = g;
  }

  // 大运
  const thisYear = now.getFullYear();
  const dayun: DayunView[] = (reading.dayun ?? []).map((d, i) => ({
    index: i,
    ganzhi: d.ganzhi,
    stem: d.stem,
    branch: d.branch,
    stemGod: tenGod(dm, d.stem),
    branchGod: tenGodOfBranch(dm, d.branch),
    startAge: d.start_age,
    endAge: d.end_age,
    startYear: d.start_year,
    endYear: d.end_year,
    isCurrent: thisYear >= d.start_year && thisYear <= d.end_year,
  }));

  // 虚岁起点：第一步大运的起运年 − 起运岁数 + 1 即出生的农历年
  const first = dayun[0];
  const birthYear = first ? first.startYear - first.startAge + 1 : null;

  // 顺逆：阳年生男、阴年生女顺行
  const yearStem = pillars[0].stem;
  const male = reading.birth ? reading.birth.gender === "male" : (reading.gender ?? "").includes("乾");
  const direction: ChartView["direction"] = yearStem
    ? isYangStem(yearStem) === male ? "顺行" : "逆行"
    : "";

  // 十神分布
  const weights: Record<string, number> = {};
  const members: Record<string, Set<string>> = {};
  const add = (god: string, w: number) => {
    const g = TEN_GOD_GROUP[god];
    if (!g) return;
    weights[g] = (weights[g] ?? 0) + w;
    (members[g] ??= new Set()).add(god);
  };
  pillars.forEach((p, i) => {
    if (i !== 2) add(p.stemGod, 1);
    p.hidden.forEach((h, k) => add(h.god, HIDDEN_WEIGHTS[k] ?? 0.1));
  });
  const godGroups = TEN_GOD_GROUPS.map((g) => ({
    group: g,
    weight: Math.round((weights[g] ?? 0) * 100) / 100,
    members: [...(members[g] ?? [])],
  }));

  // 原局干支关系
  const xc = (ec?.xingchong ?? {}) as unknown as Record<string, string[]>;
  const relations = RELATION_ORDER
    .map((kind) => ({ kind, items: xc[kind] ?? [] }))
    .filter((r) => r.items.length > 0);

  return {
    pillars,
    dayMaster: dm,
    dayMasterElement: elementOf(dm),
    genderLabel: male ? "乾造（男）" : "坤造（女）",
    direction,
    power,
    strong: ELEMENTS.filter((e) => power[e] >= 20),
    weak: ELEMENTS.filter((e) => power[e] < 10),
    geju,
    dayun,
    currentDayun: dayun.find((d) => d.isCurrent) ?? null,
    birthYear,
    godGroups,
    relations,
    palaces: [
      { label: "命宫", value: reading.ming_gong ?? "" },
      { label: "身宫", value: reading.shen_gong ?? "" },
      { label: "胎元", value: reading.tai_yuan ?? "" },
      { label: "胎息", value: reading.tai_xi ?? "" },
    ].filter((p) => p.value),
  };
}
