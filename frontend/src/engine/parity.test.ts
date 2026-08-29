/**
 * 移植平价测试：TypeScript 引擎必须与 Python 引擎逐字段一致。
 *
 * 黄金基准由 `python scripts/gen_golden_fixtures.py` 从 Python 引擎导出，
 * 覆盖立春交节、晚子时跨日、闰年、年初年末和大运顺逆等边界。
 * 这是整个浏览器端移植的安全网：只要这里全绿，就说明搬家没有改变任何计算结果。
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculateProfessionalBazi } from "./bazi";
import { calculateWuXingPower } from "./wuxing";
import { analyzeGeJu } from "./geju";

interface GoldenCase {
  input: {
    year: number; month: number; day: number;
    hour: number; minute: number; gender: string;
  };
  why: string;
  chart: Record<string, unknown>;
  wuxing_power: Record<string, unknown>;
  geju: Record<string, unknown>;
}

const FIXTURES: GoldenCase[] = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../../tests/fixtures/golden_charts.json"),
    "utf-8"
  )
);

function makeDate(i: GoldenCase["input"]): Date {
  return new Date(i.year, i.month - 1, i.day, i.hour, i.minute, 0);
}

describe("TS 引擎与 Python 引擎平价", () => {
  it("黄金基准非空", () => {
    expect(FIXTURES.length).toBeGreaterThan(10);
  });

  describe.each(FIXTURES)("$input.year-$input.month-$input.day $input.hour:$input.minute（$why）", (c) => {
    const actual = calculateProfessionalBazi(makeDate(c.input), c.input.gender);

    // 四柱是一切的地基，单独断言以便失败时一眼看出是历法层还是逻辑层的问题
    it("四柱", () => {
      expect(actual.pillars).toEqual(c.chart.pillars);
    });

    it.each([
      "tg_gan", "tg_zhi", "nayin", "shensha", "wuxing",
      "minggong", "taiyuan", "taixi", "shengong",
      "dishi", "xunkong", "wuxing_str", "day_master", "gender",
    ])("字段 %s", (field) => {
      expect(actual[field as keyof typeof actual]).toEqual(c.chart[field]);
    });

    it("神煞明细（含同柱多煞的顺序）", () => {
      // Python 的 dict key 是 int，JSON 序列化后变成字符串键
      const expected = c.chart.shensha_detail as Record<string, string[]>;
      for (const k of ["0", "1", "2", "3"]) {
        expect(actual.shensha_detail[Number(k)]).toEqual(expected[k]);
      }
    });

    it("刑冲合害", () => {
      expect(actual.xingchong).toEqual(c.chart.xingchong);
    });

    it("大运", () => {
      expect(actual.dayun).toEqual(c.chart.dayun);
    });

    it("五行力量", () => {
      const wp = calculateWuXingPower(actual);
      const exp = c.wuxing_power as Record<string, unknown>;
      expect(wp.power).toEqual(exp.power);
      expect(wp.strong).toEqual(exp.strong);
      expect(wp.weak).toEqual(exp.weak);
      expect(wp.balanced).toEqual(exp.balanced);
    });

    it("格局判定", () => {
      const g = analyzeGeJu(actual) as Record<string, unknown>;
      const exp = c.geju as Record<string, unknown>;
      for (const field of [
        "格局类型", "格局名称", "月令", "月令主气", "月干透干",
        "透干位置", "日主强弱", "日主力量占比", "最旺五行", "从格判定",
      ]) {
        expect({ [field]: g[field] }).toEqual({ [field]: exp[field] });
      }
      expect(g["生扶力量"]).toEqual(exp["生扶力量"]);
    });
  });
});
