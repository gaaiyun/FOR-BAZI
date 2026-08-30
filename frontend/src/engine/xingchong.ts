/**
 * 四柱地支间的刑冲合害、三合三会 —— engine/bazi_engine.py::_calculate_xing_chong_he_hai
 * 的 TypeScript 移植。
 *
 * 输出字符串格式（如「年月六合(午未)」）会直接进入提示词和 UI，
 * 所以标签拼接顺序必须与 Python 版一字不差。
 */

export interface XingChong {
  冲: string[];
  合: string[];
  刑: string[];
  害: string[];
  破: string[];
  穿: string[];
  三合: string[];
  三会: string[];
  半三合: string[];
  /** 天干五合（含化神）。此前整块漏算，与参天 bazi-MCP 交叉核验时才暴露。 */
  干合: string[];
  干克: string[];
  /** 相邻两柱天干相合且地支亦合 */
  双合: string[];
}

/** 天干五合及其化神 */
const GAN_5HE: Array<[string, string, string]> = [
  ["甲", "己", "土"],
  ["乙", "庚", "金"],
  ["丙", "辛", "水"],
  ["丁", "壬", "木"],
  ["戊", "癸", "火"],
];

const GAN_ELEMENT: Record<string, string> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};
const ELEMENT_KE: Record<string, string> = {
  木: "土", 土: "水", 水: "火", 火: "金", 金: "木",
};

function heHuaOf(a: string, b: string): string | null {
  for (const [x, y, hua] of GAN_5HE) {
    if ((a === x && b === y) || (a === y && b === x)) return hua;
  }
  return null;
}

const ZHI_3HE: Record<string, string> = {
  申子辰: "水", 巳酉丑: "金", 寅午戌: "火", 亥卯未: "木",
};
const ZHI_3HUI: Record<string, string> = {
  亥子丑: "水", 寅卯辰: "木", 巳午未: "火", 申酉戌: "金",
};
const ZHI_HALF_3HE: Array<[string, string]> = [
  ["申", "子"], ["子", "辰"], ["申", "辰"],
  ["巳", "酉"], ["酉", "丑"], ["巳", "丑"],
  ["寅", "午"], ["午", "戌"], ["寅", "戌"],
  ["亥", "卯"], ["卯", "未"], ["亥", "未"],
];

function emptyResult(): XingChong {
  return {
    冲: [], 合: [], 刑: [], 害: [], 破: [], 穿: [],
    三合: [], 三会: [], 半三合: [], 干合: [], 干克: [], 双合: [],
  };
}

export function calculateXingChongHeHai(pillars: string[]): XingChong {
  if (pillars.length < 4) return emptyResult();

  const zhi = pillars.map((p) => (p && p.length >= 2 ? p[1] : ""));
  const labels = ["年", "月", "日", "时"];
  const zhiSet = new Set(zhi.filter(Boolean));

  // 六冲/六合/六害/相破只列出一半映射，判定时双向查表。
  const chongMap: Record<string, string> = { 子: "午", 丑: "未", 寅: "申", 卯: "酉", 辰: "戌", 巳: "亥" };
  const heMap: Record<string, string> = { 子: "丑", 寅: "亥", 卯: "戌", 辰: "酉", 巳: "申", 午: "未" };
  const haiMap: Record<string, string> = { 子: "未", 丑: "午", 寅: "巳", 卯: "辰", 申: "亥", 酉: "戌" };
  const poMap: Record<string, string> = {
    子: "酉", 卯: "午", 午: "卯", 酉: "子", 辰: "丑", 戌: "未", 丑: "辰", 未: "戌",
  };

  const r = emptyResult();

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a = zhi[i];
      const b = zhi[j];
      if (!a || !b) continue;
      const tag = `${labels[i]}${labels[j]}`;

      // 冲只按单向查（与 Python 一致），其余三种双向。
      if (chongMap[a] === b) r.冲.push(`${tag}相冲(${a}${b})`);
      if (heMap[a] === b || heMap[b] === a) r.合.push(`${tag}六合(${a}${b})`);
      if (haiMap[a] === b || haiMap[b] === a) r.害.push(`${tag}相害(${a}${b})`);
      if (poMap[a] === b || poMap[b] === a) r.破.push(`${tag}相破(${a}${b})`);

      for (const [x, y] of ZHI_HALF_3HE) {
        if ((a === x && b === y) || (a === y && b === x)) {
          r.半三合.push(`${tag}半三合(${a}${b})`);
        }
      }
    }
  }

  for (const [combo, wx] of Object.entries(ZHI_3HE)) {
    if ([...combo].every((c) => zhiSet.has(c))) r.三合.push(`${combo}三合(${wx}局)`);
  }
  for (const [combo, wx] of Object.entries(ZHI_3HUI)) {
    if ([...combo].every((c) => zhiSet.has(c))) r.三会.push(`${combo}三会(${wx}局)`);
  }

  if (["寅", "巳", "申"].every((c) => zhiSet.has(c))) r.刑.push("寅巳申三刑(无恩之刑)");
  if (["丑", "戌", "未"].every((c) => zhiSet.has(c))) r.刑.push("丑戌未三刑(持势之刑)");
  if (zhiSet.has("子") && zhiSet.has("卯")) r.刑.push("子卯相刑(无礼之刑)");
  for (const z of ["辰", "午", "酉", "亥"]) {
    if (zhi.filter((x) => x === z).length >= 2) r.刑.push(`${z}自刑`);
  }

  // ── 天干五合与相克 ──
  // 只判相邻两柱：传统上天干合克讲究紧贴，隔柱作用力大减。
  const gan = pillars.map((p) => (p ? p[0] : ""));
  for (let i = 0; i < gan.length - 1; i++) {
    const a = gan[i];
    const b = gan[i + 1];
    if (!a || !b) continue;
    const tag = `${labels[i]}${labels[i + 1]}`;

    const hua = a !== b ? heHuaOf(a, b) : null;
    if (hua) {
      r.干合.push(`${tag}干合(${a}${b}合${hua})`);
      // 「贪合忘克」：既合则不再以克论，否则同一对关系被算两笔。
      continue;
    }
    const ea = GAN_ELEMENT[a];
    const eb = GAN_ELEMENT[b];
    if (ea && eb) {
      if (ELEMENT_KE[ea] === eb) r.干克.push(`${tag}干克(${a}克${b})`);
      else if (ELEMENT_KE[eb] === ea) r.干克.push(`${tag}干克(${b}克${a})`);
    }
  }

  // 双合：相邻两柱天干相合且地支亦合
  for (let i = 0; i < 3; i++) {
    const tag = `${labels[i]}${labels[i + 1]}`;
    if (
      r.干合.some((h) => h.startsWith(`${tag}干合`)) &&
      r.合.some((h) => h.startsWith(`${tag}六合`))
    ) {
      r.双合.push(`${tag}双合(天干地支皆合)`);
    }
  }

  return r;
}
