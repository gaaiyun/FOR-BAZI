/**
 * 四柱排盘 —— engine/bazi_engine.py::calculate_professional_bazi 的 TypeScript 移植。
 *
 * 十神、纳音、大运、命宫、胎元、地势、旬空全部来自 lunar-typescript 的 EightChar，
 * 与 Python 版所用的 lunar-python 同作者、方法同名，因此这层几乎是一一对应。
 * 自有逻辑只有神煞与刑冲合害两块，分别在 ./shensha 与 ./xingchong。
 */

import { Solar } from "lunar-typescript";
import { calculateShenSha, formatShenShaForPillars, type ShenShaDetail } from "./shensha";
import { calculateXingChongHeHai, type XingChong } from "./xingchong";

export type Gender = "乾造 (Male)" | "坤造 (Female)";

export interface DaYunStep {
  start_age: number;
  start_year: number;
  ganzhi: string;
}

export interface WuXingCount {
  "金(Metal)": number;
  "木(Wood)": number;
  "水(Water)": number;
  "火(Fire)": number;
  "土(Earth)": number;
}

export interface BaziChart {
  gender: string;
  pillars: string[];
  tg_gan: string[];
  tg_zhi: string[];
  nayin: string[];
  shensha: string[];
  shensha_detail: ShenShaDetail;
  wuxing: WuXingCount;
  dayun: DaYunStep[];
  minggong: string;
  taiyuan: string;
  taixi: string;
  shengong: string;
  dishi: string[];
  xunkong: string[];
  xingchong: XingChong;
  wuxing_str: string;
  day_master: string;
}

function countChar(haystack: string, needle: string): number {
  let n = 0;
  for (const ch of haystack) if (ch === needle) n++;
  return n;
}

/**
 * 计算完整命盘。
 *
 * @param dt     出生时刻（本地时间语义，与后端 datetime 一致，不做时区换算）
 * @param gender 必须是 "乾造 (Male)" 或 "坤造 (Female)"——大运顺逆由它决定
 */
export function calculateProfessionalBazi(dt: Date, gender: string): BaziChart {
  const solar = Solar.fromYmdHms(
    dt.getFullYear(),
    dt.getMonth() + 1,
    dt.getDate(),
    dt.getHours(),
    dt.getMinutes(),
    dt.getSeconds()
  );
  const bazi = solar.getLunar().getEightChar();

  const genderVal = gender === "乾造 (Male)" ? 1 : 0;

  const ygz = bazi.getYear();
  const mgz = bazi.getMonth();
  const dgz = bazi.getDay();
  const tgz = bazi.getTime();
  const pillars = [ygz, mgz, dgz, tgz];

  const tg_gan = [
    bazi.getYearShiShenGan(),
    bazi.getMonthShiShenGan(),
    "日主",
    bazi.getTimeShiShenGan(),
  ];

  const tg_zhi = [
    bazi.getYearShiShenZhi().join(" "),
    bazi.getMonthShiShenZhi().join(" "),
    bazi.getDayShiShenZhi().join(" "),
    bazi.getTimeShiShenZhi().join(" "),
  ];

  const nayin = [
    bazi.getYearNaYin(),
    bazi.getMonthNaYin(),
    bazi.getDayNaYin(),
    bazi.getTimeNaYin(),
  ];

  const shenshaDetail = calculateShenSha(pillars);
  const shensha = formatShenShaForPillars(shenshaDetail);

  const allWx =
    bazi.getYearWuXing() +
    bazi.getMonthWuXing() +
    bazi.getDayWuXing() +
    bazi.getTimeWuXing();

  const wuxing: WuXingCount = {
    "金(Metal)": countChar(allWx, "金"),
    "木(Wood)": countChar(allWx, "木"),
    "水(Water)": countChar(allWx, "水"),
    "火(Fire)": countChar(allWx, "火"),
    "土(Earth)": countChar(allWx, "土"),
  };

  // 大运：只取前 10 步，且 index 从 1 开始（index 0 是起运前的小运，Python 版同样跳过）
  let dayun: DaYunStep[] = [];
  try {
    for (const dy of bazi.getYun(genderVal).getDaYun()) {
      const idx = dy.getIndex();
      if (idx > 0 && idx <= 10) {
        dayun.push({
          start_age: dy.getStartAge(),
          start_year: dy.getStartYear(),
          ganzhi: dy.getGanZhi(),
        });
      }
    }
  } catch {
    dayun = [{ start_age: 0, start_year: dt.getFullYear(), ganzhi: "计算受限" }];
  }

  return {
    gender,
    pillars,
    tg_gan,
    tg_zhi,
    nayin,
    shensha,
    shensha_detail: shenshaDetail,
    wuxing,
    dayun,
    minggong: bazi.getMingGong(),
    taiyuan: bazi.getTaiYuan(),
    taixi: bazi.getTaiXi(),
    shengong: bazi.getShenGong(),
    dishi: [
      bazi.getYearDiShi(),
      bazi.getMonthDiShi(),
      bazi.getDayDiShi(),
      bazi.getTimeDiShi(),
    ],
    xunkong: [
      bazi.getYearXunKong(),
      bazi.getMonthXunKong(),
      bazi.getDayXunKong(),
      bazi.getTimeXunKong(),
    ],
    xingchong: calculateXingChongHeHai(pillars),
    wuxing_str: allWx,
    day_master: dgz.length >= 1 ? dgz[0] : "",
  };
}
