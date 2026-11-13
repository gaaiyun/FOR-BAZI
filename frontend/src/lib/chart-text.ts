/**
 * 把命盘整理成一段可以直接粘给任意 AI 的文本。
 *
 * 大模型自己排盘经常出错（节气换月、起运岁数、藏干），所以这里把算好的
 * 事实完整交过去，并在开头写明「以此为准，不要重排」。格式用 Markdown：
 * ChatGPT、Claude、DeepSeek、豆包、Kimi 等都能正确识别表格。
 */

import type { BaziReading } from "@/types/bazi";
import { ELEMENTS } from "./ganzhi";
import { deriveChart, yearView } from "./chart-view";
import { relationsWith } from "./relations";

export type ChartTextMode = "prompt" | "data" | "json";

export interface ChartTextOptions {
  /** prompt：命盘 + 解读要求；data：只有命盘；json：结构化数据 */
  mode?: ChartTextMode;
  /** 是否写出公历 / 农历出生时间 */
  includeBirth?: boolean;
  /** 附在末尾的具体问题 */
  question?: string;
  /** 古籍参考段落（由调用方异步取好传入） */
  classics?: string;
  /** 当前时间，测试时注入 */
  now?: Date;
}

const DEFAULT_REQUEST = `请基于上面的命盘做一次完整解读，依次说明：
1. 格局与日主强弱，以及由此得出的喜用与忌神（说明取用依据）
2. 性格与天赋
3. 事业与财运
4. 感情与婚姻
5. 健康上需要留意的方面
6. 当前大运与今明两年流年的重点

要求：直接引用命盘里的干支、十神、刑冲合害作为依据；结论分清把握大小；不要用恐吓式的说法。`;

function row(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

export function buildChartData(reading: BaziReading, now: Date = new Date()) {
  const v = deriveChart(reading, now);
  const pillars = v.pillars.map((p) => p.stem + p.branch);
  const thisYear = now.getFullYear();
  return {
    性别: v.genderLabel,
    出生: reading.birth
      ? {
          公历: reading.birth.clock,
          农历: reading.birth.lunar_text,
          排盘所用时间: reading.birth.effective,
          出生地: reading.birth.place ?? null,
          真太阳时校正分钟: reading.birth.offset_minutes,
        }
      : null,
    日主: `${v.dayMaster}${v.dayMasterElement}`,
    四柱: Object.fromEntries(
      v.pillars.map((p) => [
        p.label,
        {
          干支: p.stem + p.branch,
          天干十神: p.stemGod,
          藏干: p.hidden.map((h) => `${h.stem}(${h.god})`),
          纳音: p.nayin,
          地势: p.dishi,
          旬空: p.xunkong,
          神煞: p.shensha,
        },
      ])
    ),
    宫位: Object.fromEntries(v.palaces.map((p) => [p.label, p.value])),
    五行力量百分比: v.power,
    格局: v.geju
      ? {
          名称: v.geju.格局名称,
          类型: v.geju.格局类型,
          日主强弱: v.geju.日主强弱,
          日主力量占比: v.geju.日主力量占比,
          说明: v.geju.context,
        }
      : null,
    原局干支关系: Object.fromEntries(v.relations.map((r) => [r.kind, r.items])),
    大运: {
      顺逆: v.direction,
      列表: v.dayun.map((d) => ({
        干支: d.ganzhi,
        十神: `${d.stemGod}/${d.branchGod}`,
        年份: `${d.startYear}-${d.endYear}`,
        虚岁: `${d.startAge}-${d.endAge}`,
        当前: d.isCurrent,
      })),
    },
    近期流年: [thisYear - 1, thisYear, thisYear + 1, thisYear + 2, thisYear + 3].map((y) => {
      const yv = yearView(y, v.dayMaster, v.birthYear);
      return {
        年份: y,
        干支: yv.ganzhi,
        十神: `${yv.stemGod}/${yv.branchGod}`,
        与原局: relationsWith(yv.ganzhi, pillars).map((r) => r.text),
      };
    }),
  };
}

export function buildChartText(reading: BaziReading, opts: ChartTextOptions = {}): string {
  const mode = opts.mode ?? "prompt";
  const now = opts.now ?? new Date();
  const includeBirth = opts.includeBirth ?? true;

  if (mode === "json") {
    const data = buildChartData(reading, now);
    if (!includeBirth) data.出生 = null;
    return JSON.stringify(data, null, 2);
  }

  const v = deriveChart(reading, now);
  const pillarStrs = v.pillars.map((p) => p.stem + p.branch);
  const thisYear = now.getFullYear();
  const L: string[] = [];

  L.push("# 八字命盘");
  L.push("");
  L.push("> 以下内容由排盘程序按确定性规则算出（节气换月、起运、藏干、十神均已核对）。请以此为准，不要重新排盘。");
  L.push("");

  // ── 基本信息 ──
  L.push("## 基本信息");
  L.push(`- 性别：${v.genderLabel}`);
  const b = reading.birth;
  if (includeBirth && b) {
    L.push(`- 公历出生：${b.clock}`);
    L.push(`- 农历：${b.lunar_text}`);
    if (b.offset_minutes !== 0 || b.place) {
      L.push(
        `- 排盘所用时间：${b.effective}（${b.place ? b.place + "，" : ""}真太阳时校正 ${b.offset_minutes > 0 ? "+" : ""}${b.offset_minutes} 分钟${b.dst ? "，已扣除夏令时" : ""}）`
      );
    } else {
      L.push("- 时间口径：按钟表时间排盘，未做真太阳时校正");
    }
  }
  L.push(`- 日主：${v.dayMaster}（${v.dayMasterElement}）`);
  if (v.palaces.length) {
    L.push(`- ${v.palaces.map((p) => `${p.label} ${p.value}`).join("，")}`);
  }
  if (v.birthYear) {
    L.push(`- 今年 ${thisYear} 年，虚岁 ${thisYear - v.birthYear + 1}`);
  }
  L.push("");

  // ── 四柱 ──
  L.push("## 四柱");
  L.push(row(["", ...v.pillars.map((p) => p.label)]));
  L.push(row(["---", "---", "---", "---", "---"]));
  L.push(row(["天干十神", ...v.pillars.map((p) => p.stemGod)]));
  L.push(row(["天干", ...v.pillars.map((p) => p.stem)]));
  L.push(row(["地支", ...v.pillars.map((p) => p.branch)]));
  L.push(row(["藏干（十神）", ...v.pillars.map((p) => p.hidden.map((h) => `${h.stem}${h.god}`).join(" "))]));
  L.push(row(["纳音", ...v.pillars.map((p) => p.nayin || "—")]));
  L.push(row(["地势", ...v.pillars.map((p) => p.dishi || "—")]));
  L.push(row(["旬空", ...v.pillars.map((p) => p.xunkong || "—")]));
  L.push(row(["神煞", ...v.pillars.map((p) => p.shensha.join(" ") || "—")]));
  L.push("");

  // ── 五行 ──
  L.push("## 五行力量");
  L.push("含地支藏干、月令加权与十二长生状态，合计 100%。");
  L.push(`- ${ELEMENTS.map((e) => `${e} ${v.power[e].toFixed(1)}%`).join("，")}`);
  L.push(`- 偏旺（≥20%）：${v.strong.join("、") || "无"}；偏弱（<10%）：${v.weak.join("、") || "无"}`);
  L.push("");

  // ── 格局 ──
  if (v.geju) {
    L.push("## 格局");
    L.push(`- 取格：${v.geju.格局名称}，${v.geju.格局类型}`);
    L.push(`- 日主强弱：${v.geju.日主强弱}（日主五行占 ${v.geju.日主力量占比}%）`);
    L.push(`- 说明：${v.geju.context}`);
    L.push("");
  }

  // ── 原局关系 ──
  L.push("## 原局干支关系");
  if (v.relations.length) {
    for (const r of v.relations) L.push(`- ${r.kind}：${r.items.join("、")}`);
  } else {
    L.push("- 四柱之间未见刑冲合害");
  }
  L.push("");

  // ── 大运 ──
  if (v.dayun.length) {
    L.push(`## 大运（${v.direction}，虚岁 ${v.dayun[0].startAge} 岁起运）`);
    L.push(row(["年份", "虚岁", "干支", "十神（干/支）", ""]));
    L.push(row(["---", "---", "---", "---", "---"]));
    for (const d of v.dayun) {
      L.push(
        row([
          `${d.startYear}–${d.endYear}`,
          `${d.startAge}–${d.endAge}`,
          d.ganzhi,
          `${d.stemGod} / ${d.branchGod}`,
          d.isCurrent ? "← 当前" : "",
        ])
      );
    }
    L.push("");
  }

  // ── 流年 ──
  L.push("## 近期流年");
  for (const y of [thisYear - 1, thisYear, thisYear + 1, thisYear + 2, thisYear + 3]) {
    const yv = yearView(y, v.dayMaster, v.birthYear);
    const rel = relationsWith(yv.ganzhi, pillarStrs).map((r) => r.text);
    L.push(
      `- ${y} ${yv.ganzhi}${y === thisYear ? "（今年）" : ""}：${yv.stemGod} / ${yv.branchGod}` +
        (rel.length ? `；与原局 ${rel.join("、")}` : "")
    );
  }
  L.push("");

  if (opts.classics?.trim()) {
    L.push("## 古籍参考");
    L.push(opts.classics.trim());
    L.push("");
  }

  if (mode === "prompt") {
    L.push("---");
    L.push("");
    L.push(opts.question?.trim() ? `我的问题：${opts.question.trim()}` : DEFAULT_REQUEST);
    if (opts.question?.trim()) {
      L.push("");
      L.push("请直接引用命盘里的干支、十神、刑冲合害作为依据，结论分清把握大小。");
    }
  }

  return L.join("\n").trimEnd() + "\n";
}
