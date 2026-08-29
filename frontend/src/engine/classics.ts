/**
 * 古籍知识库 —— prompts/ancient_texts.py 的 TypeScript 移植。
 *
 * 五本古籍共 380KB，用动态 import 懒加载，首屏不受影响；
 * 只有真正调用古籍工具时才拉这块 chunk。
 *
 * 关于 rag_retrieve：后端版依赖 ChromaDB 做向量检索，浏览器里跑不了。
 * 这里换成**词法检索**——古籍查询的词几乎都是专名（格局名、十神、干支、
 * 日主、神煞），精确与子串匹配在这个语料上比语义检索更可控，也不需要
 * 预计算向量。返回结构保持一致（带来源、分类、原文），并在 method 字段
 * 里如实标明是 lexical 而非 semantic，不把它伪装成同一种东西。
 */

export interface ClassicEntry {
  key: string;
  source: string;
  category?: string;
  [field: string]: unknown;
}

interface RawBook {
  source: string;
  entries: Record<string, Record<string, unknown>>;
}

export const MONTH_ZHI_TO_SEASON: Record<string, string> = {
  寅: "春月", 卯: "春月", 辰: "春月",
  巳: "夏月", 午: "夏月", 未: "夏月",
  申: "秋月", 酉: "秋月", 戌: "秋月",
  亥: "冬月", 子: "冬月", 丑: "冬月",
};

const BRANCH_MAIN_STEM: Record<string, string> = {
  寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙",
  午: "丁", 未: "己", 申: "庚", 酉: "辛",
  戌: "戊", 亥: "壬", 子: "癸", 丑: "己",
};

const SHISHEN_TO_GEJU: Record<string, string> = {
  正官: "正官格", 七杀: "七杀格", 正财: "正财格", 偏财: "偏财格",
  食神: "食神格", 伤官: "伤官格", 正印: "正印格", 偏印: "偏印格",
};

const DISITIAN_DAY_MASTER_MAP: Record<string, string[]> = {
  甲: ["十干体性_甲", "月令提纲论", "日主衰旺论", "配合论"],
  乙: ["十干体性_乙", "月令提纲论", "日主衰旺论", "配合论"],
  丙: ["十干体性_丙", "月令提纲论", "日主衰旺论", "配合论"],
  丁: ["十干体性_丁", "月令提纲论", "日主衰旺论", "配合论"],
  戊: ["十干体性_戊", "日主衰旺论", "月令提纲论", "配合论", "生克制化_总论"],
  己: ["十干体性_己", "日主衰旺论", "月令提纲论", "配合论", "生克制化_总论"],
  庚: ["十干体性_庚", "日主衰旺论", "月令提纲论", "配合论", "合化论"],
  辛: ["十干体性_辛", "日主衰旺论", "月令提纲论", "配合论", "合化论"],
  壬: ["十干体性_壬", "日主衰旺论", "月令提纲论", "情通论", "流通论"],
  癸: ["十干体性_癸", "日主衰旺论", "月令提纲论", "情通论", "流通论"],
};

/** 跨古籍分类别名：渊海子平没有独立「格局」分类，相关论述散在论法/总论。 */
const CATEGORY_ALIASES: Record<string, Record<string, string[]>> = {
  渊海子平: { 格局: ["论法", "总论"] },
};

// ── 懒加载 ────────────────────────────────────────────────────────────

interface Books {
  穷通宝鉴: RawBook;
  滴天髓: RawBook;
  子平真诠: RawBook;
  三命通会: RawBook;
  渊海子平: RawBook;
}

let booksPromise: Promise<Books> | null = null;

export function loadBooks(): Promise<Books> {
  if (!booksPromise) {
    booksPromise = Promise.all([
      import("@data/qiongtong_baojian.json"),
      import("@data/di_tian_sui.json"),
      import("@data/ziping_zhenquan.json"),
      import("@data/sanming_tonghui.json"),
      import("@data/yuanhai_ziping.json"),
    ]).then(([q, d, z, s, y]) => ({
      穷通宝鉴: (q.default ?? q) as unknown as RawBook,
      滴天髓: (d.default ?? d) as unknown as RawBook,
      子平真诠: (z.default ?? z) as unknown as RawBook,
      三命通会: (s.default ?? s) as unknown as RawBook,
      渊海子平: (y.default ?? y) as unknown as RawBook,
    }));
  }
  return booksPromise;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// ── 穷通宝鉴 ──────────────────────────────────────────────────────────

function qiongtongIndex(book: RawBook) {
  // 原始键形如 "甲日_寅月"，索引为 [日主][季节]
  const idx: Record<string, Record<string, { 用神: string; 原文: string; 白话: string }>> = {};
  for (const [key, entry] of Object.entries(book.entries ?? {})) {
    const parts = key.split("_");
    if (parts.length !== 2) continue;
    const dayMaster = parts[0].replace("日", "");
    const monthZhi = parts[1].replace("月", "");
    const season = MONTH_ZHI_TO_SEASON[monthZhi] ?? "春月";
    const 原文 = str(entry["原文"]);
    idx[dayMaster] ??= {};
    idx[dayMaster][season] = {
      用神: 原文.includes("。") ? 原文.split("。")[0] : 原文,
      原文,
      白话: str(entry["解析"]),
    };
  }
  return idx;
}

export async function getQiongtongForTool(dayMaster: string, monthZhi: string) {
  if (!dayMaster || !monthZhi) return { context: "缺少日主或月支。" };
  const books = await loadBooks();
  const season = MONTH_ZHI_TO_SEASON[monthZhi] ?? "春月";
  const g = qiongtongIndex(books.穷通宝鉴)[dayMaster]?.[season];
  if (!g) return { context: `未收录「${dayMaster}日主 ${season}」的条文。` };
  return {
    day_master: dayMaster, month_zhi: monthZhi, season,
    用神: g.用神, 原文: g.原文, 白话: g.白话,
    context: `《穷通宝鉴》${dayMaster}日主${season}：用神${g.用神}。${g.白话}`,
  };
}

export async function getQiongtongGuidance(dayMaster: string, monthZhi: string): Promise<string> {
  if (!dayMaster || !monthZhi) return "";
  const books = await loadBooks();
  const season = MONTH_ZHI_TO_SEASON[monthZhi] ?? "春月";
  const g = qiongtongIndex(books.穷通宝鉴)[dayMaster]?.[season];
  if (!g) return "";
  return (
    `**《穷通宝鉴》调候用神（${dayMaster}日主 ${season}）**\n` +
    `- 用神：${g.用神}\n- 原文：${g.原文}\n- 白话：${g.白话}`
  );
}

// ── 滴天髓 ────────────────────────────────────────────────────────────

function disitianKeys(dayMaster: string): string[] {
  const universal = ["通神论_天干", "通神论_地支", "用神论"];
  return [...new Set([...universal, ...(DISITIAN_DAY_MASTER_MAP[dayMaster] ?? [])])];
}

function disitianEntry(book: RawBook, key: string) {
  const e = book.entries?.[key];
  if (!e) return null;
  return { 原文: str(e["原文"]), 白话: str(e["解析"]), 应用: str(e["喜忌"]) };
}

export async function getDisitianForTool(dayMaster: string, monthZhi: string) {
  if (!dayMaster) return { context: "缺少日主。" };
  const books = await loadBooks();
  const principles: Record<string, unknown> = {};
  for (const k of disitianKeys(dayMaster)) {
    const e = disitianEntry(books.滴天髓, k);
    if (e) principles[k] = e;
  }
  return {
    day_master: dayMaster, month_zhi: monthZhi, source: "滴天髓", principles,
    context: `《滴天髓》日主${dayMaster}相关理法共${Object.keys(principles).length}条。`,
  };
}

export async function getDisitianGuidance(dayMaster: string): Promise<string> {
  if (!dayMaster) return "";
  const books = await loadBooks();
  const lines = [`**《滴天髓》理法参考（日主：${dayMaster}）**`];
  for (const k of disitianKeys(dayMaster)) {
    const e = disitianEntry(books.滴天髓, k);
    if (!e) continue;
    lines.push(`\n【${k.replace(/_/g, " · ")}】`);
    lines.push(`- 原文：${e.原文}`);
    lines.push(`- 白话：${e.白话}`);
    lines.push(`- 应用：${e.应用}`);
  }
  return lines.join("\n");
}

// ── 子平真诠 ──────────────────────────────────────────────────────────

function zipingIndex(book: RawBook) {
  const idx: Record<string, Record<string, string>> = {};
  for (const [key, e] of Object.entries(book.entries ?? {})) {
    if (!key.includes("格")) continue;
    idx[key] = {
      原文: str(e["取格"]),
      白话: str(e["口诀"]),
      成格条件: str(e["取法"]) || str(e["取格"]),
      破格条件: str(e["忌"]),
      喜忌: `喜：${str(e["喜"])}。忌：${str(e["忌"])}`,
      应用: str(e["贵格"]),
    };
  }
  return idx;
}

const YANG_YIN: Record<string, string> = {
  甲: "阳", 乙: "阴", 丙: "阳", 丁: "阴", 戊: "阳",
  己: "阴", 庚: "阳", 辛: "阴", 壬: "阳", 癸: "阴",
};
const GAN_WX: Record<string, string> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};
const GEN: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const OVC: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };

function stemRelation(dayMaster: string, other: string): string {
  const dw = GAN_WX[dayMaster];
  const ow = GAN_WX[other];
  if (!dw || !ow) return "";
  const same = YANG_YIN[dayMaster] === YANG_YIN[other];
  if (dw === ow) return same ? "比肩" : "劫财";
  if (GEN[dw] === ow) return same ? "食神" : "伤官";
  if (GEN[ow] === dw) return same ? "偏印" : "正印";
  if (OVC[dw] === ow) return same ? "偏财" : "正财";
  if (OVC[ow] === dw) return same ? "七杀" : "正官";
  return "";
}

/**
 * 取格要看**透干**，不是只看月令本气。调用方应把 analyze_geju 已算出的
 * 格局传进来；否则退回本气粗判并在「依据」里标明，免得模型同时拿到两个
 * 互斥格名而在回答里两头下注。
 */
export async function getZipingForTool(dayMaster: string, monthZhi: string, gejuName = "") {
  if (!dayMaster || !monthZhi) return { context: "缺少日主或月支。" };
  const books = await loadBooks();
  const monthStem = BRANCH_MAIN_STEM[monthZhi] ?? "";
  if (!monthStem) return { context: `无法确定月令${monthZhi}的本气藏干。` };

  const shishen = stemRelation(dayMaster, monthStem);
  let source = "取格（含透干）";
  let name = gejuName;
  if (!name) {
    name = SHISHEN_TO_GEJU[shishen] ?? "";
    source = "月令本气";
  }
  const base = { day_master: dayMaster, month_zhi: monthZhi, month_stem: monthStem, source: "子平真诠", 依据: source };
  if (!name) {
    return { ...base, shishen, context: `月令本气${monthStem}对日主${dayMaster}为「${shishen}」，非八格正格。` };
  }
  const entry = zipingIndex(books.子平真诠)[name];
  if (!entry) {
    return { ...base, geju_name: name, context: `命局取「${name}」，非八格正格，需以变格论之。` };
  }
  return {
    ...base, shishen, geju_name: name, ...entry,
    context: `《子平真诠》${dayMaster}日主月令${monthZhi}→${name}（依据：${source}）。${entry.白话}`,
  };
}

export async function getZipingGuidance(dayMaster: string, monthZhi: string, gejuName = ""): Promise<string> {
  const r = (await getZipingForTool(dayMaster, monthZhi, gejuName)) as Record<string, unknown>;
  const name = str(r["geju_name"]);
  if (!name) return r["context"] ? `**《子平真诠》格局参考**\n${str(r["context"])}` : "";
  return (
    `**《子平真诠》格局参考（${dayMaster}日主 月令${monthZhi} → ${name}，依据：${str(r["依据"])}）**\n` +
    `- 原文：${str(r["原文"])}\n- 白话：${str(r["白话"])}\n` +
    `- 成格条件：${str(r["成格条件"])}\n- 破格条件：${str(r["破格条件"])}\n` +
    `- 喜忌：${str(r["喜忌"])}\n- 应用：${str(r["应用"])}`
  );
}

// ── 三命通会 ──────────────────────────────────────────────────────────

function sanmingLookup(book: RawBook, key: string) {
  let e = book.entries?.[key];
  if (!e) {
    for (const prefix of ["六亲_", "运年_", "强弱_"]) {
      e = book.entries?.[`${prefix}${key}`];
      if (e) break;
    }
  }
  return e ?? null;
}

export async function getSanmingForTool(_category: string, key: string) {
  if (!key) return { context: "缺少查询键名。" };
  const books = await loadBooks();
  const e = sanmingLookup(books.三命通会, key);
  if (!e) return { context: `未收录「${key}」的条文。` };
  return {
    source: "三命通会", key, entry: e,
    context: `《三命通会》${key}：${str(e["原文"]) || str(e["断法"])}`,
  };
}

export async function getSanmingGuidance(key: string): Promise<string> {
  if (!key) return "";
  const books = await loadBooks();
  const e = sanmingLookup(books.三命通会, key);
  if (!e) return "";
  const lines = [`**《三命通会》参考（${key}）**`];
  for (const [k, v] of Object.entries(e)) {
    if (["category", "key", "出处", "tags"].includes(k)) continue;
    if (typeof v === "string") lines.push(`- ${k}：${v}`);
  }
  return lines.join("\n");
}

// ── 通用查询 ──────────────────────────────────────────────────────────

export async function queryClassicalText(
  source: string, category = "", key = ""
): Promise<ClassicEntry[]> {
  const books = await loadBooks();
  const book = (books as unknown as Record<string, RawBook>)[source];
  if (!book) return [{ key: "", source, error: `未找到古籍「${source}」` } as ClassicEntry];

  const allowed = category
    ? new Set([category, ...(CATEGORY_ALIASES[source]?.[category] ?? [])])
    : null;

  const results: ClassicEntry[] = [];
  for (const [entryKey, entry] of Object.entries(book.entries ?? {})) {
    if (allowed && !allowed.has(str(entry["category"]))) continue;
    if (key && !entryKey.includes(key) && !str(entry["key"]).includes(key)) continue;
    results.push({ key: entryKey, source, ...entry } as ClassicEntry);
  }
  return results.length
    ? results
    : [{ key: "", source, context: `在「${source}」中未找到匹配条目。` } as ClassicEntry];
}

// ── 词法检索（替代后端的向量 RAG）────────────────────────────────────

/** 把中文查询切成 1-3 字的片段：古籍专名多为 2-3 字，无需分词器。 */
function gramsOf(query: string): string[] {
  const cleaned = query.replace(/[\s，。、；：！？"'（）()《》\[\]{}]/g, "");
  const out = new Set<string>();
  for (let n = 3; n >= 2; n--) {
    for (let i = 0; i + n <= cleaned.length; i++) out.add(cleaned.slice(i, i + n));
  }
  // 单字只保留干支、五行、十神里有判别力的字，避免"的""之"这类噪声
  const MEANINGFUL = new Set("甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥金木水火土官杀印财食伤比劫");
  for (const ch of cleaned) if (MEANINGFUL.has(ch)) out.add(ch);
  return [...out];
}

const FIELD_WEIGHTS: Record<string, number> = {
  key: 6, category: 3, tags: 4, 原文: 2, 取格: 2, 解析: 1, 口诀: 1, 喜: 1, 忌: 1,
};

export interface RetrievedPassage {
  key: string;
  source: string;
  category: string;
  score: number;
  excerpt: string;
  entry: Record<string, unknown>;
}

/**
 * 在全部五本古籍上做加权词法检索。
 * 命中权重：条目键 > 标签 > 分类 > 原文 > 解析。
 */
export async function lexicalRetrieve(query: string, topK = 6): Promise<RetrievedPassage[]> {
  const grams = gramsOf(query);
  if (!grams.length) return [];
  const books = await loadBooks();

  const scored: RetrievedPassage[] = [];
  for (const [sourceName, book] of Object.entries(books as unknown as Record<string, RawBook>)) {
    for (const [entryKey, entry] of Object.entries(book.entries ?? {})) {
      let score = 0;
      const fields: Array<[string, string]> = [["key", entryKey]];
      for (const [f, v] of Object.entries(entry)) {
        if (typeof v === "string") fields.push([f, v]);
        else if (Array.isArray(v)) fields.push([f, v.join(" ")]);
      }
      for (const [field, text] of fields) {
        if (!text) continue;
        const w = FIELD_WEIGHTS[field] ?? 1;
        for (const g of grams) {
          if (text.includes(g)) score += w * g.length;
        }
      }
      if (score > 0) {
        const excerpt =
          str(entry["原文"]) || str(entry["取格"]) || str(entry["解析"]) || str(entry["断法"]) || entryKey;
        scored.push({
          key: entryKey,
          source: sourceName,
          category: str(entry["category"]),
          score,
          excerpt: excerpt.slice(0, 160),
          entry: entry as Record<string, unknown>,
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return scored.slice(0, topK);
}
