/**
 * 浏览器端排盘引擎。
 *
 * 排盘是确定性计算，不需要任何密钥，因此整体移到浏览器执行：
 * 部署时 Pages 只托管静态资源，无需 Python 后端；AI 调用另走 Worker 网关。
 */

export { calculateProfessionalBazi } from "./bazi";
export type { BaziChart, DaYunStep, Gender, WuXingCount } from "./bazi";

export { calculateShenSha, formatShenShaForPillars } from "./shensha";
export type { ShenShaDetail } from "./shensha";

export { calculateXingChongHeHai } from "./xingchong";
export type { XingChong } from "./xingchong";

export { calculateWuXingPower, GAN_TO_ELEMENT, ZHI_HIDDEN_STEMS, ELEMENTS } from "./wuxing";
export type { WuXingPower, Element } from "./wuxing";

export { analyzeGeJu } from "./geju";
export type { GeJu } from "./geju";

import { calculateProfessionalBazi } from "./bazi";
import { calculateWuXingPower } from "./wuxing";
import { analyzeGeJu } from "./geju";

/**
 * 与后端 `POST /api/v1/chart` 等价的一次性计算，返回同样的三段结构。
 * 前端可直接用它替换网络请求。
 */
export function calculateChart(datetimeStr: string, gender: string) {
  // 与后端一致：接受 "YYYY-MM-DD HH:mm" / "YYYY-MM-DDTHH:mm"，按本地时间解释。
  const m = datetimeStr
    .trim()
    .match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) throw new Error(`无法解析日期时间：${datetimeStr}`);
  const dt = new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), Number(m[6] ?? 0)
  );

  const chart = calculateProfessionalBazi(dt, gender);
  return {
    chart,
    wuxing_power: calculateWuXingPower(chart),
    geju: analyzeGeJu(chart),
  };
}
