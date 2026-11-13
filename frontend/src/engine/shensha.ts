/**
 * 八字神煞计算 —— engine/shensha.py 的 TypeScript 移植。
 *
 * 以日干、日支、年支为太极点，遍历四柱地支查找神煞落宫。
 * 移植必须逐字段对齐 Python 版：命中顺序、去重规则和「日支优先、年支辅之」
 * 的分支结构都会影响最终数组顺序，`tests/engine-parity` 会做严格比对。
 */

/** 柱索引 -> 该柱地支上的神煞名列表。 */
export type ShenShaDetail = Record<number, string[]>;

function zhiAt(pillars: string[], pos: number): string {
  const p = pillars[pos] ?? "";
  return p.length >= 2 ? p[1] : "";
}

// ── 三合局类：以三合局的沐浴/冲/墓/帝旺位定神煞 ──────────────────────

/** 桃花 = 三合局的沐浴位。申子辰→酉，寅午戌→卯，巳酉丑→午，亥卯未→子 */
const TAOHUA: Record<string, string> = {
  申: "酉", 子: "酉", 辰: "酉",
  寅: "卯", 午: "卯", 戌: "卯",
  巳: "午", 酉: "午", 丑: "午",
  亥: "子", 卯: "子", 未: "子",
};

/** 驿马 = 三合局的冲位。 */
const YIMA: Record<string, string> = {
  申: "寅", 子: "寅", 辰: "寅",
  寅: "申", 午: "申", 戌: "申",
  巳: "亥", 酉: "亥", 丑: "亥",
  亥: "巳", 卯: "巳", 未: "巳",
};

/** 华盖 = 三合局的墓位。 */
const HUAGAI: Record<string, string> = {
  申: "辰", 子: "辰", 辰: "辰",
  寅: "戌", 午: "戌", 戌: "戌",
  巳: "丑", 酉: "丑", 丑: "丑",
  亥: "未", 卯: "未", 未: "未",
};

/** 将星 = 三合局的帝旺位。 */
const JIANGXING: Record<string, string> = {
  申: "子", 子: "子", 辰: "子",
  寅: "午", 午: "午", 戌: "午",
  巳: "酉", 酉: "酉", 丑: "酉",
  亥: "卯", 卯: "卯", 未: "卯",
};

// ── 日干类 ────────────────────────────────────────────────────────────

/** 天乙贵人：甲戊庚→丑未，乙己→子申，丙丁→亥酉，壬癸→卯巳，辛→寅午 */
const TIANYI: Record<string, string[]> = {
  甲: ["丑", "未"], 戊: ["丑", "未"], 庚: ["丑", "未"],
  乙: ["子", "申"], 己: ["子", "申"],
  丙: ["亥", "酉"], 丁: ["亥", "酉"],
  壬: ["卯", "巳"], 癸: ["卯", "巳"],
  辛: ["寅", "午"],
};

/** 禄神 = 日干临官位。 */
const LU: Record<string, string> = {
  甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳",
  己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子",
};

/** 羊刃 = 阳干帝旺位；阴干不取。 */
const YANGREN: Record<string, string> = {
  甲: "卯", 丙: "午", 戊: "午", 庚: "酉", 壬: "子",
};

/** 文昌。 */
const WENCHANG: Record<string, string> = {
  甲: "巳", 乙: "午", 丙: "申", 丁: "酉", 戊: "申",
  己: "酉", 庚: "亥", 辛: "子", 壬: "寅", 癸: "卯",
};

// ── 第二批神煞（2026-11 补入）。逐表对应 engine/shensha.py，顺序与 Python 版一致 ──

/** 太极贵人（日干）：甲乙→子午  丙丁→卯酉  戊己→辰戌丑未  庚辛→寅亥  壬癸→巳申 */
const TAIJI: Record<string, string[]> = {
  甲: ["子", "午"], 乙: ["子", "午"],
  丙: ["卯", "酉"], 丁: ["卯", "酉"],
  戊: ["辰", "戌", "丑", "未"], 己: ["辰", "戌", "丑", "未"],
  庚: ["寅", "亥"], 辛: ["寅", "亥"],
  壬: ["巳", "申"], 癸: ["巳", "申"],
};

/** 天德贵人（月支）。目标可能是天干也可能是地支，四柱干支都查。 */
const TIANDE: Record<string, string> = {
  寅: "丁", 卯: "申", 辰: "壬", 巳: "辛", 午: "亥", 未: "甲",
  申: "癸", 酉: "寅", 戌: "丙", 亥: "乙", 子: "巳", 丑: "庚",
};

/** 月德贵人（月支三合）：寅午戌→丙  申子辰→壬  亥卯未→甲  巳酉丑→庚，查四柱天干 */
const YUEDE: Record<string, string> = {
  寅: "丙", 午: "丙", 戌: "丙",
  申: "壬", 子: "壬", 辰: "壬",
  亥: "甲", 卯: "甲", 未: "甲",
  巳: "庚", 酉: "庚", 丑: "庚",
};

/** 金舆（日干） */
const JINYU: Record<string, string> = {
  甲: "辰", 乙: "巳", 丙: "未", 丁: "申", 戊: "未",
  己: "申", 庚: "戌", 辛: "亥", 壬: "丑", 癸: "寅",
};

/** 红鸾（年支） */
const HONGLUAN: Record<string, string> = {
  子: "卯", 丑: "寅", 寅: "丑", 卯: "子", 辰: "亥", 巳: "戌",
  午: "酉", 未: "申", 申: "未", 酉: "午", 戌: "巳", 亥: "辰",
};

/** 天喜（年支）：红鸾的对冲位 */
const TIANXI: Record<string, string> = {
  子: "酉", 丑: "申", 寅: "未", 卯: "午", 辰: "巳", 巳: "辰",
  午: "卯", 未: "寅", 申: "丑", 酉: "子", 戌: "亥", 亥: "戌",
};

/** 孤辰、寡宿（年支所在三会方） */
const GUCHEN: Record<string, string> = {
  亥: "寅", 子: "寅", 丑: "寅",
  寅: "巳", 卯: "巳", 辰: "巳",
  巳: "申", 午: "申", 未: "申",
  申: "亥", 酉: "亥", 戌: "亥",
};
const GUASU: Record<string, string> = {
  亥: "戌", 子: "戌", 丑: "戌",
  寅: "丑", 卯: "丑", 辰: "丑",
  巳: "辰", 午: "辰", 未: "辰",
  申: "未", 酉: "未", 戌: "未",
};

/** 劫煞（三合局绝位） */
const JIESHA: Record<string, string> = {
  申: "巳", 子: "巳", 辰: "巳",
  寅: "亥", 午: "亥", 戌: "亥",
  巳: "寅", 酉: "寅", 丑: "寅",
  亥: "申", 卯: "申", 未: "申",
};

/** 亡神（三合局临官位） */
const WANGSHEN: Record<string, string> = {
  申: "亥", 子: "亥", 辰: "亥",
  寅: "巳", 午: "巳", 戌: "巳",
  巳: "申", 酉: "申", 丑: "申",
  亥: "寅", 卯: "寅", 未: "寅",
};

/** 魁罡：日柱本身 */
const KUIGANG = new Set(["庚辰", "庚戌", "壬辰", "戊戌"]);

function secondBatch(pillars: string[], result: ShenShaDetail): void {
  const yearZhi = zhiAt(pillars, 0);
  const monthZhi = zhiAt(pillars, 1);
  const dayZhi = zhiAt(pillars, 2);
  const dayGan = (pillars[2] ?? "").length >= 1 ? pillars[2][0] : "";
  const gans = [0, 1, 2, 3].map((i) => ((pillars[i] ?? "").length >= 1 ? pillars[i][0] : ""));
  const zhis = [0, 1, 2, 3].map((i) => zhiAt(pillars, i));

  const add = (i: number, name: string) => {
    if (!result[i].includes(name)) result[i].push(name);
  };
  // 年支、日支两个基准都查（与桃花同一结构：年支先，日支不同时再补）
  const byYearAndDay = (table: Record<string, string>, name: string) => {
    for (let i = 0; i < 4; i++) {
      if (!zhis[i]) continue;
      if (yearZhi && table[yearZhi] === zhis[i]) add(i, name);
      if (dayZhi && dayZhi !== yearZhi && table[dayZhi] === zhis[i]) add(i, name);
    }
  };

  for (let i = 0; i < 4; i++) {
    if (dayGan && zhis[i] && (TAIJI[dayGan] ?? []).includes(zhis[i])) add(i, "太极贵人");
  }
  for (let i = 0; i < 4; i++) {
    const t = TIANDE[monthZhi] ?? "";
    if (t && (gans[i] === t || zhis[i] === t)) add(i, "天德贵人");
  }
  for (let i = 0; i < 4; i++) {
    const t = YUEDE[monthZhi] ?? "";
    if (t && gans[i] === t) add(i, "月德贵人");
  }
  for (let i = 0; i < 4; i++) {
    if (dayGan && zhis[i] && JINYU[dayGan] === zhis[i]) add(i, "金舆");
  }
  for (const [name, table] of [
    ["红鸾", HONGLUAN], ["天喜", TIANXI], ["孤辰", GUCHEN], ["寡宿", GUASU],
  ] as const) {
    for (let i = 0; i < 4; i++) {
      if (yearZhi && zhis[i] && table[yearZhi] === zhis[i]) add(i, name);
    }
  }
  byYearAndDay(JIESHA, "劫煞");
  byYearAndDay(WANGSHEN, "亡神");
  if (KUIGANG.has(pillars[2] ?? "")) add(2, "魁罡");
}

/**
 * 根据四柱干支计算神煞。
 * @param pillars [年柱, 月柱, 日柱, 时柱]，每柱两字如 "庚寅"
 */
export function calculateShenSha(pillars: string[]): ShenShaDetail {
  const empty: ShenShaDetail = { 0: [], 1: [], 2: [], 3: [] };
  if (pillars.length < 4) return empty;

  const yearZhi = zhiAt(pillars, 0);
  const dayZhi = zhiAt(pillars, 2);
  const dayGan = (pillars[2] ?? "").length >= 1 ? pillars[2][0] : "";

  const result: ShenShaDetail = { 0: [], 1: [], 2: [], 3: [] };

  // 三合局类。注意桃花/华盖是「年支与日支分别判、命中则去重」，
  // 而驿马/将星是「日支优先，年支仅在日支未命中时才判」——两者分支
  // 结构不同，不能合并简化，否则数组顺序会与 Python 版分叉。
  for (let i = 0; i < 4; i++) {
    const zhi = zhiAt(pillars, i);
    if (!zhi) continue;

    if (yearZhi && TAOHUA[yearZhi] === zhi) result[i].push("桃花");
    if (dayZhi && dayZhi !== yearZhi && TAOHUA[dayZhi] === zhi) {
      if (!result[i].includes("桃花")) result[i].push("桃花");
    }

    if (dayZhi && YIMA[dayZhi] === zhi) {
      result[i].push("驿马");
    } else if (yearZhi && yearZhi !== dayZhi && YIMA[yearZhi] === zhi) {
      if (!result[i].includes("驿马")) result[i].push("驿马");
    }

    if (yearZhi && HUAGAI[yearZhi] === zhi) result[i].push("华盖");
    if (dayZhi && dayZhi !== yearZhi && HUAGAI[dayZhi] === zhi) {
      if (!result[i].includes("华盖")) result[i].push("华盖");
    }

    if (dayZhi && JIANGXING[dayZhi] === zhi) {
      result[i].push("将星");
    } else if (yearZhi && yearZhi !== dayZhi && JIANGXING[yearZhi] === zhi) {
      if (!result[i].includes("将星")) result[i].push("将星");
    }
  }

  // 日干类。Python 版是四个独立的整轮遍历，所以同一柱上的顺序恒为
  // 天乙贵人 -> 禄神 -> 羊刃 -> 文昌，这里保持一致。
  if (dayGan) {
    const tianyi = TIANYI[dayGan] ?? [];
    for (let i = 0; i < 4; i++) {
      const zhi = zhiAt(pillars, i);
      if (zhi && tianyi.includes(zhi)) result[i].push("天乙贵人");
    }

    const lu = LU[dayGan] ?? "";
    if (lu) {
      for (let i = 0; i < 4; i++) {
        if (zhiAt(pillars, i) === lu) result[i].push("禄神");
      }
    }

    const yangren = YANGREN[dayGan] ?? "";
    if (yangren) {
      for (let i = 0; i < 4; i++) {
        if (zhiAt(pillars, i) === yangren) result[i].push("羊刃");
      }
    }

    const wenchang = WENCHANG[dayGan] ?? "";
    if (wenchang) {
      for (let i = 0; i < 4; i++) {
        if (zhiAt(pillars, i) === wenchang) result[i].push("文昌");
      }
    }
  }

  secondBatch(pillars, result);
  return result;
}

/** 展平为四柱字符串，同柱多煞以空格分隔（与后端 explain_shensha 的入参格式一致）。 */
export function formatShenShaForPillars(detail: ShenShaDetail): string[] {
  return [0, 1, 2, 3].map((i) => (detail[i] ?? []).join(" "));
}
