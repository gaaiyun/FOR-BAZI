/**
 * Agent 工具层 —— tools/bazi_tools.py 的 TypeScript 移植。
 *
 * 排盘、五行、格局、刑冲已由 ./ 下的引擎模块提供；这里补齐流年干支、
 * 大运阶段、神煞释义、干支校验和五本古籍的查询，并把它们包装成
 * OpenAI function-calling schema，供浏览器端 ReAct 循环调用。
 *
 * 与后端的唯一差异：rag_retrieve 从向量检索换成词法检索（见 ./classics）。
 * 工具名保持不变，模型侧无需感知。
 */

import { Solar } from "lunar-typescript";
import type { BaziChart } from "./bazi";
import { calculateWuXingPower } from "./wuxing";
import { analyzeGeJu } from "./geju";
import {
  getQiongtongForTool, getDisitianForTool, getZipingForTool,
  getSanmingForTool, queryClassicalText, lexicalRetrieve,
} from "./classics";

export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ── 流年 / 大运 ───────────────────────────────────────────────────────

export function getAnnualFortune(year: number) {
  const lunar = Solar.fromYmdHms(year, 6, 1, 12, 0, 0).getLunar();
  const ganzhi = lunar.getYearInGanZhi();
  const nayin = lunar.getYearNaYin();
  return {
    year, ganzhi, nayin,
    context: `当年干支为${ganzhi}，纳音${nayin}。可结合命主原局进行生克制化分析。`,
  };
}

export function getDayunStage(chart: Pick<BaziChart, "dayun">, currentYear: number) {
  const dayun = chart.dayun ?? [];
  for (let i = 0; i < dayun.length; i++) {
    const d = dayun[i];
    const next = dayun[i + 1];
    const endYear = next ? next.start_year - 1 : d.start_year + 9;
    if (currentYear >= d.start_year && currentYear <= endYear) {
      return {
        current_year: currentYear,
        step: i + 1,
        ganzhi: d.ganzhi,
        start_year: d.start_year,
        start_age: d.start_age,
        end_year: endYear,
        end_age: d.start_age + (endYear - d.start_year),
        context: `当前${currentYear}年处于第${i + 1}步大运「${d.ganzhi}」，起于${d.start_year}年（${d.start_age}岁）。`,
      };
    }
  }
  return {
    current_year: currentYear, step: null, ganzhi: "",
    context: `${currentYear}年不在已推演的大运区间内。`,
  };
}

/** 反查某年干支是否与历法一致，用于收尾 fact-check。 */
export function factCheckGanzhi(claimedGanzhi: string, year: number) {
  const actual = Solar.fromYmdHms(year, 6, 1, 12, 0, 0).getLunar().getYearInGanZhi();
  const claimed = (claimedGanzhi ?? "").trim();
  return {
    year, claimed, actual, match: claimed === actual,
    context: claimed === actual
      ? `${year}年干支${actual}，与所述一致。`
      : `${year}年实际干支为${actual}，与所述「${claimed}」不符。`,
  };
}

// ── 五行 / 神煞 ───────────────────────────────────────────────────────

export function analyzeWuxingBalance(chart: BaziChart) {
  const counts = chart.wuxing ?? {};
  const vals = Object.values(counts) as number[];
  if (!vals.length) return { context: "无五行数据。" };
  const total = vals.reduce((a, b) => a + b, 0);

  // 旺衰只由加权精算裁定；个数是事实层，不再自己下互斥结论。
  const detail = calculateWuXingPower(chart);
  return {
    wuxing: counts, total, power: detail.power,
    strong: detail.strong, weak: detail.weak, balanced: detail.balanced,
    verdict_source: "weighted",
    context:
      `五行个数：${JSON.stringify(counts)}（共${total}字）。加权力量：${JSON.stringify(detail.power)}。` +
      `偏旺：${detail.strong.join("、") || "无"}；偏弱：${detail.weak.join("、") || "无"}；` +
      `整体${detail.balanced ? "较均衡" : "有偏"}。旺衰以加权力量为准，个数仅供参考。`,
  };
}

/** 引擎在同柱多煞时输出空格串（如「桃花 天乙贵人」），因此这里同样接受多个名称。 */
const SHENSHA_GLOSSARY: Record<string, string> = {
  桃花: "子午卯酉为桃花，主异性缘、审美、情感；分墙内墙外。",
  驿马: "寅申巳亥为驿马，主变动、出行、迁移、机遇。",
  华盖: "主孤高、艺术、宗教缘、独立思考。",
  文昌: "主学业、文采、考试、名声。",
  将星: "主领导力、权威、组织能力。",
  羊刃: "主刚强、胆大、易有伤灾或官非。",
  劫煞: "主突发变故、破财、竞争。",
  亡神: "主思虑、城府、亦主官禄。",
  天乙贵人: "十干中最尊之贵神，主逢凶化吉、得人提携、遇难有助。",
  禄神: "日主临官之位，主自立、衣食俸禄、依靠己力立身。",
};

export function explainShensha(name: string) {
  const raw = (name ?? "").trim();
  const names = raw.split(/\s+/).filter(Boolean);
  const available = Object.keys(SHENSHA_GLOSSARY);
  if (!names.length) return { shensha: raw, context: "未提供神煞名称。", available };

  const known = names.filter((n) => SHENSHA_GLOSSARY[n]);
  const unknown = names.filter((n) => !SHENSHA_GLOSSARY[n]);
  if (!known.length) {
    return { shensha: raw, context: `未收录「${unknown.join("、")}」的释义。`, available };
  }
  const description = known.map((n) => `${n}：${SHENSHA_GLOSSARY[n]}`).join("；");
  const out: Record<string, unknown> = { shensha: raw, description, context: description };
  if (unknown.length) out.unrecognized = unknown;
  return out;
}

const XING_CHONG_DESC: Record<string, string> = {
  刑: "地支相刑：子卯、寅巳申、丑戌未、辰午酉亥自刑等，主是非、压力、健康隐患。",
  冲: "地支六冲：子午、丑未、寅申、卯酉、辰戌、巳亥，主变动、冲突、机遇与挑战并存。",
  合: "地支六合：子丑、寅亥、卯戌、辰酉、巳申、午未，主合和、人缘、合作。",
  害: "地支六害：子未、丑午、寅巳、卯辰、申亥、酉戌，主暗中妨害、口舌、小人。",
  破: "地支相破：子酉、卯午、辰丑、戌未等，主破损、不顺、暗中损耗。",
  三合: "申子辰水、巳酉丑金、寅午戌火、亥卯未木，三字全为三合局，力量强。",
  三会: "亥子丑水、寅卯辰木、巳午未火、申酉戌金，三会方局，气专力大。",
  半三合: "三合局中两字（如申子、子辰、申辰），为半三合，有合意但力减。",
};

export function queryXingChongHeHai(chart: BaziChart, relationType = "") {
  const xc = chart.xingchong ?? ({} as BaziChart["xingchong"]);
  if (relationType) {
    const desc = XING_CHONG_DESC[relationType.trim()];
    if (!desc) return { relation_type: relationType, context: `未收录「${relationType}」的释义。` };
    return {
      relation_type: relationType,
      description: desc,
      hits: (xc as unknown as Record<string, string[]>)[relationType] ?? [],
      context: desc,
    };
  }
  const summary: string[] = [];
  for (const [k, v] of Object.entries(xc as unknown as Record<string, string[]>)) {
    if (v && v.length) summary.push(`${k}：${v.join(", ")}`);
  }
  return {
    xingchong: xc,
    summary,
    context: `命盘刑冲合害关系：${summary.join("; ") || "无"}。`,
  };
}

// ── Schema ────────────────────────────────────────────────────────────

const noArgs = { type: "object", properties: {}, required: [] as string[] };

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "get_annual_fortune",
      description: "获取指定公历年份的流年干支与纳音。问某年运势时必须先调用它核实干支。",
      parameters: {
        type: "object",
        properties: { year: { type: "integer", description: "公历年份，如 2026" } },
        required: ["year"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dayun_stage",
      description: "判断指定年份处于命主的第几步大运，返回该步干支与起止。",
      parameters: {
        type: "object",
        properties: { year: { type: "integer", description: "公历年份" } },
        required: ["year"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_wuxing_balance",
      description: "五行分布统计与旺衰判定（旺衰以加权精算为准）。",
      parameters: noArgs,
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_wuxing_power",
      description: "五行力量精算，含藏干、月令加权与十二长生，归一化百分比。",
      parameters: noArgs,
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_geju",
      description: "格局判定：取格（含透干）、日主强弱、从格判定与生扶力量。",
      parameters: noArgs,
    },
  },
  {
    type: "function",
    function: {
      name: "query_xing_chong_he_hai",
      description: "查询命盘中的刑冲合害、三合三会关系；可指定关系类型取释义。",
      parameters: {
        type: "object",
        properties: {
          relation_type: { type: "string", description: "可选：刑/冲/合/害/破/三合/三会/半三合" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "explain_shensha",
      description: "神煞释义。可传单个名称或命盘中空格分隔的多个名称。",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "如「桃花」或「桃花 天乙贵人」" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fact_check_ganzhi",
      description: "校验某年干支是否与历法一致，用于收尾自检，防止臆造。",
      parameters: {
        type: "object",
        properties: {
          year: { type: "integer" },
          claimed_ganzhi: { type: "string", description: "所述干支，如「乙巳」" },
        },
        required: ["year", "claimed_ganzhi"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_qiongtong_guidance",
      description: "查《穷通宝鉴》调候用神（按命盘日主与月令）。",
      parameters: noArgs,
    },
  },
  {
    type: "function",
    function: {
      name: "query_disitian_guidance",
      description: "查《滴天髓》十干体性与理法（按命盘日主）。",
      parameters: noArgs,
    },
  },
  {
    type: "function",
    function: {
      name: "query_ziping_guidance",
      description: "查《子平真诠》格局论法（自动带入已算出的格局，含透干）。",
      parameters: noArgs,
    },
  },
  {
    type: "function",
    function: {
      name: "query_sanming_guidance",
      description: "查《三命通会》宫位六亲、大运流年条目。",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "键名，如「年柱」「日柱」「配偶」" },
          category: { type: "string", description: "可选分类" },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_classical_text",
      description: "通用古籍查询，可按古籍名、分类和关键词筛选。",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string", description: "穷通宝鉴/滴天髓/子平真诠/三命通会/渊海子平" },
          category: { type: "string" },
          key: { type: "string" },
        },
        required: ["source"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rag_retrieve",
      description:
        "跨五本古籍检索相关条文，返回带来源与分类的原文片段。问题涉及多本古籍或需要广泛检索时使用。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "检索词，如「庚金 未月 调候」" },
          top_k: { type: "integer", description: "返回条数，默认 6" },
        },
        required: ["query"],
      },
    },
  },
];

// ── 分发 ──────────────────────────────────────────────────────────────

/** 古籍工具最多回传的条目数：避免一次塞爆模型上下文。 */
const MAX_CLASSICAL_ENTRIES = 10;

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  chart: BaziChart | null
): Promise<unknown> {
  const c = chart;
  const monthZhi = c?.pillars?.[1]?.[1] ?? "";
  const dayMaster = c?.day_master ?? "";
  const num = (v: unknown, d: number) => (typeof v === "number" ? v : Number(v) || d);

  switch (name) {
    case "get_annual_fortune":
      return getAnnualFortune(num(args.year, new Date().getFullYear()));

    case "get_dayun_stage":
      if (!c) return { context: "尚无命盘数据。" };
      return getDayunStage(c, num(args.year, new Date().getFullYear()));

    case "analyze_wuxing_balance":
      if (!c) return { context: "尚无命盘数据。" };
      return analyzeWuxingBalance(c);

    case "calculate_wuxing_power":
      if (!c) return { context: "尚无命盘数据。" };
      return calculateWuXingPower(c);

    case "analyze_geju":
      if (!c) return { context: "尚无命盘数据。" };
      return analyzeGeJu(c);

    case "query_xing_chong_he_hai":
      if (!c) return { context: "尚无命盘数据。" };
      return queryXingChongHeHai(c, String(args.relation_type ?? ""));

    case "explain_shensha":
      return explainShensha(String(args.name ?? ""));

    case "fact_check_ganzhi":
      return factCheckGanzhi(String(args.claimed_ganzhi ?? ""), num(args.year, 0));

    case "query_qiongtong_guidance":
      return getQiongtongForTool(dayMaster, monthZhi);

    case "query_disitian_guidance":
      return getDisitianForTool(dayMaster, monthZhi);

    case "query_ziping_guidance": {
      // 把已算出的格局带进去：取格看透干，只按月令本气查表会给出另一个格名。
      let gejuName = "";
      if (c) {
        const g = analyzeGeJu(c) as Record<string, unknown>;
        gejuName = typeof g["格局名称"] === "string" ? (g["格局名称"] as string) : "";
      }
      return getZipingForTool(dayMaster, monthZhi, gejuName);
    }

    case "query_sanming_guidance":
      return getSanmingForTool(String(args.category ?? ""), String(args.key ?? ""));

    case "query_classical_text": {
      const all = await queryClassicalText(
        String(args.source ?? ""), String(args.category ?? ""), String(args.key ?? "")
      );
      // 明确告知截断，不让模型误以为这就是全部命中。
      if (all.length > MAX_CLASSICAL_ENTRIES) {
        return {
          total_matched: all.length,
          returned: MAX_CLASSICAL_ENTRIES,
          truncated: true,
          note: `共命中 ${all.length} 条，为控制上下文只返回前 ${MAX_CLASSICAL_ENTRIES} 条。`,
          entries: all.slice(0, MAX_CLASSICAL_ENTRIES),
        };
      }
      return { total_matched: all.length, returned: all.length, truncated: false, entries: all };
    }

    case "rag_retrieve": {
      const hits = await lexicalRetrieve(String(args.query ?? ""), num(args.top_k, 6));
      return {
        query: String(args.query ?? ""),
        method: "lexical",
        note: "词法检索（按条目键、标签、分类、原文加权匹配），非向量语义检索。",
        count: hits.length,
        results: hits,
      };
    }

    default:
      return { error: `未知工具：${name}` };
  }
}
