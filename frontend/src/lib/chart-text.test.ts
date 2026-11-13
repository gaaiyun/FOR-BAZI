import { describe, expect, it } from "vitest";
import { calculateBazi } from "./api";
import { buildChartText, buildChartData } from "./chart-text";
import { deriveChart } from "./chart-view";
import { relationsWith } from "./relations";
import { resolveBirth, isChinaDst, equationOfTime, formatDateTime } from "./solar-time";
import { yearGanzhi, tenGod } from "./ganzhi";
import { calculateShenSha } from "@/engine/shensha";
import { explainShensha } from "@/engine/tools";
import type { BaziInput } from "@/types/bazi";

const BASE: BaziInput = {
  birth_date: "1985-06-15",
  birth_time: "09:20",
  gender: "male",
  time_known: true,
  calendar_type: "solar",
};
const NOW = new Date(2026, 10, 12);

describe("干支小工具", () => {
  it("年干支以 1984 甲子为基准", () => {
    expect(yearGanzhi(1984)).toBe("甲子");
    expect(yearGanzhi(2026)).toBe("丙午");
    expect(yearGanzhi(1985)).toBe("乙丑");
  });
  it("十神", () => {
    expect(tenGod("甲", "甲")).toBe("比肩");
    expect(tenGod("甲", "庚")).toBe("七杀");
    expect(tenGod("甲", "己")).toBe("正财");
  });
});

describe("外来干支与原局的关系", () => {
  const pillars = ["乙丑", "壬午", "丁巳", "乙巳"];
  it("子午冲、子丑合都能报出，且标明落在哪一柱", () => {
    const r = relationsWith("甲子", pillars).map((x) => x.text);
    expect(r).toContain("子午相冲（月支）");
    expect(r).toContain("子丑六合（年支）");
  });
  it("干支全同报伏吟，不再重复列其他关系", () => {
    const r = relationsWith("壬午", pillars).filter((x) => x.pillar === "月");
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe("伏吟");
  });
  it("天克地冲报反吟", () => {
    // 丙子 对 壬午：壬克丙、子午冲
    const r = relationsWith("丙子", pillars).filter((x) => x.pillar === "月");
    expect(r.map((x) => x.kind)).toEqual(["反吟"]);
  });
  it("丁壬合", () => {
    expect(relationsWith("壬寅", pillars).some((x) => x.text.startsWith("壬丁合木"))).toBe(true);
  });
});

describe("出生时间换算", () => {
  it("未开启校正时原样使用钟表时间", () => {
    const r = resolveBirth(BASE);
    expect(formatDateTime(r.effective)).toBe("1985-06-15 09:20");
    expect(r.offsetMinutes).toBe(0);
  });
  it("乌鲁木齐比东经 120° 慢两小时以上", () => {
    const r = resolveBirth({ ...BASE, true_solar: true, longitude: 87.6, place: "乌鲁木齐" });
    expect(r.offsetMinutes).toBeLessThan(-120);
    expect(r.offsetMinutes).toBeGreaterThan(-140);
    expect(r.effective.getHours()).toBe(7);
  });
  it("1988 年夏令时期间扣一小时", () => {
    expect(isChinaDst(new Date(1988, 4, 27, 9, 20))).toBe(true);
    expect(isChinaDst(new Date(1988, 0, 27, 9, 20))).toBe(false);
    expect(isChinaDst(new Date(1995, 5, 1, 9, 20))).toBe(false);
    const r = resolveBirth({
      ...BASE, birth_date: "1988-05-27", true_solar: true, longitude: 120, place: "东经 120°",
    });
    expect(r.dst).toBe(true);
    expect(r.offsetMinutes).toBeLessThan(-50);
    expect(r.offsetMinutes).toBeGreaterThan(-65);
  });
  it("均时差在合理范围内，二月为负、十一月为正", () => {
    expect(equationOfTime(new Date(2024, 1, 11))).toBeLessThan(-12);
    expect(equationOfTime(new Date(2024, 10, 3))).toBeGreaterThan(14);
  });
  it("农历转公历：乙丑年四月廿七 = 1985-06-15", () => {
    const r = resolveBirth({ ...BASE, calendar_type: "lunar", birth_date: "1985-04-27" });
    expect(formatDateTime(r.clock)).toBe("1985-06-15 09:20");
  });
  it("不存在的日期给出可读错误", () => {
    expect(() => resolveBirth({ ...BASE, birth_date: "1985-02-30" })).toThrow(/没有/);
    expect(() =>
      resolveBirth({ ...BASE, calendar_type: "lunar", lunar_leap: true, birth_date: "1985-04-27" })
    ).toThrow(/闰/);
  });
});

describe("命盘文本", () => {
  it("包含四柱表、五行、格局、大运与近期流年", async () => {
    const reading = await calculateBazi(BASE);
    const text = buildChartText(reading, { now: NOW });
    const v = deriveChart(reading, NOW);

    expect(text).toContain("# 八字命盘");
    expect(text).toContain("不要重新排盘");
    expect(text).toContain("乾造（男）");
    expect(text).toContain("公历出生：1985-06-15 09:20");
    // 四柱每一柱的干支都在表里
    for (const p of v.pillars) {
      expect(text).toContain(p.stem);
      expect(text).toContain(p.branch);
    }
    expect(text).toMatch(/\| 天干 \| . \| . \| . \| . \|/);
    expect(text).toContain("## 五行力量");
    expect(text).toContain("## 格局");
    expect(text).toContain("## 大运");
    expect(text).toContain("← 当前");
    expect(text).toContain("2026 丙午（今年）");
    expect(text).toContain("请基于上面的命盘做一次完整解读");
  });

  it("可以隐去出生时间，只留干支", async () => {
    const reading = await calculateBazi(BASE);
    const text = buildChartText(reading, { now: NOW, includeBirth: false });
    expect(text).not.toContain("1985-06-15");
    expect(text).not.toContain("公历出生");
    expect(text).toContain("## 四柱");
  });

  it("data 模式不带解读要求；自定义问题替换默认要求", async () => {
    const reading = await calculateBazi(BASE);
    expect(buildChartText(reading, { now: NOW, mode: "data" })).not.toContain("请基于上面的命盘");
    const q = buildChartText(reading, { now: NOW, question: "明年适合换工作吗" });
    expect(q).toContain("我的问题：明年适合换工作吗");
    expect(q).not.toContain("请基于上面的命盘做一次完整解读");
  });

  it("json 模式是合法 JSON，且五行合计约 100", async () => {
    const reading = await calculateBazi(BASE);
    const data = JSON.parse(buildChartText(reading, { now: NOW, mode: "json" }));
    expect(Object.keys(data.四柱)).toEqual(["年柱", "月柱", "日柱", "时柱"]);
    const sum = Object.values(data.五行力量百分比 as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(0.6);
    expect(buildChartData(reading, NOW).大运.列表.filter((d) => d.当前)).toHaveLength(1);
  });

  it("真太阳时校正会写进文本", async () => {
    const reading = await calculateBazi({ ...BASE, true_solar: true, longitude: 104.1, place: "成都" });
    const text = buildChartText(reading, { now: NOW });
    expect(text).toContain("成都");
    expect(text).toContain("真太阳时校正 -");
  });

  it("十神分布：五类权重之和等于 3 个天干 + 4 个地支", async () => {
    const reading = await calculateBazi(BASE);
    const v = deriveChart(reading, NOW);
    const sum = v.godGroups.reduce((s, g) => s + g.weight, 0);
    expect(sum).toBeGreaterThan(6);
    expect(sum).toBeLessThanOrEqual(7.01);
  });
});

describe("神煞释义覆盖", () => {
  it("引擎能输出的每一种神煞都有释义", () => {
    // 覆盖第二批全部规则的几组四柱
    const samples = [
      ["乙丑", "壬午", "乙酉", "辛巳"],
      ["戊辰", "甲寅", "庚戌", "丙子"],
      ["甲子", "丙寅", "壬辰", "癸卯"],
      ["甲子", "己巳", "丙午", "己亥"],
      ["甲子", "丁卯", "壬辰", "戊申"],
      ["甲子", "丙寅", "壬辰", "壬戌"],
    ];
    const names = new Set<string>();
    for (const p of samples) for (const list of Object.values(calculateShenSha(p))) list.forEach((n) => names.add(n));
    expect(names.size).toBeGreaterThanOrEqual(15);
    for (const n of names) {
      const r = explainShensha(n) as { description?: string };
      expect(r.description, n).toBeTruthy();
    }
  });
});
