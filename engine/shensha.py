"""
八字神煞（Shen Sha）计算模块

本模块基于传统八字命理规则，根据四柱干支计算各类神煞。
与黄历（calendar-level）的吉神凶煞不同，这里是真正的命局神煞——
以日干、日支、年支为太极点，遍历四柱地支查找神煞落宫。

神煞一览：
    1. 桃花（Peach Blossom）  — 人缘、异性缘、才艺
    2. 驿马（Travel Star）     — 奔波、出行、变动
    3. 天乙贵人（Tianyi Noble） — 贵人相助、逢凶化吉
    4. 华盖（Canopy）          — 孤高、学术、宗教、艺术
    5. 羊刃（Yang Blade）      — 刚烈、果断、灾厄
    6. 禄神（Lu Star）         — 俸禄、财源、衣食
    7. 文昌（Literary Star）   — 聪明、学业、文才
    8. 将星（General Star）    — 领导力、权柄、威严
    以下为第二批（2026-11 补入，查法见各表注释）：
    9.  太极贵人   — 日干查四支
    10. 天德贵人   — 月支查四柱干支
    11. 月德贵人   — 月支三合查四柱天干
    12. 金舆       — 日干查四支
    13. 红鸾       — 年支查四支
    14. 天喜       — 年支查四支（红鸾对冲位）
    15. 孤辰       — 年支三会方查四支
    16. 寡宿       — 年支三会方查四支
    17. 劫煞       — 年支、日支三合查四支
    18. 亡神       — 年支、日支三合查四支
    19. 魁罡       — 日柱本身为庚辰、庚戌、壬辰、戊戌

    第二批一律追加在第一批之后，同柱内的顺序按上面的编号，
    这样第一批的输出顺序与旧版完全一致。

返回格式：
    Dict[int, List[str]]，key 为柱索引（0=年, 1=月, 2=日, 3=时），
    value 为该柱地支上查到的神煞名称列表。
"""

from typing import Dict, List


# ── 地支序号映射 ──────────────────────────────────────────────────────────
_ZHI_INDEX = {z: i for i, z in enumerate("子丑寅卯辰巳午未申酉戌亥")}


def _zhi_at(pillars: List[str], pos: int) -> str:
    """取指定柱的地支（干支字符串的第 2 个字符）。"""
    p = pillars[pos]
    return p[1] if len(p) >= 2 else ""


# ══════════════════════════════════════════════════════════════════════════
# 三合局 → 神煞映射表
# ══════════════════════════════════════════════════════════════════════════

# 桃花：年支或日支所属三合局的"沐浴"位（即桃花位）
#   申子辰（水局）→ 酉    寅午戌（火局）→ 卯
#   巳酉丑（金局）→ 午    亥卯未（木局）→ 子
_TAOHUA: Dict[str, str] = {
    "申": "酉", "子": "酉", "辰": "酉",
    "寅": "卯", "午": "卯", "戌": "卯",
    "巳": "午", "酉": "午", "丑": "午",
    "亥": "子", "卯": "子", "未": "子",
}

# 驿马：年支或日支所属三合局的"冲"位
#   申子辰 → 寅    寅午戌 → 申
#   巳酉丑 → 亥    亥卯未 → 巳
_YIMA: Dict[str, str] = {
    "申": "寅", "子": "寅", "辰": "寅",
    "寅": "申", "午": "申", "戌": "申",
    "巳": "亥", "酉": "亥", "丑": "亥",
    "亥": "巳", "卯": "巳", "未": "巳",
}

# 华盖：年支或日支所属三合局的"墓"位
#   申子辰 → 辰    寅午戌 → 戌
#   巳酉丑 → 丑    亥卯未 → 未
_HUAGAI: Dict[str, str] = {
    "申": "辰", "子": "辰", "辰": "辰",
    "寅": "戌", "午": "戌", "戌": "戌",
    "巳": "丑", "酉": "丑", "丑": "丑",
    "亥": "未", "卯": "未", "未": "未",
}

# 将星：年支或日支所属三合局的"帝旺"位
#   申子辰 → 子    寅午戌 → 午
#   巳酉丑 → 酉    亥卯未 → 卯
_JIANGXING: Dict[str, str] = {
    "申": "子", "子": "子", "辰": "子",
    "寅": "午", "午": "午", "戌": "午",
    "巳": "酉", "酉": "酉", "丑": "酉",
    "亥": "卯", "卯": "卯", "未": "卯",
}


# ══════════════════════════════════════════════════════════════════════════
# 日干 → 神煞映射表
# ══════════════════════════════════════════════════════════════════════════

# 天乙贵人：最吉之神，主贵人相助
#   甲戊庚 → 丑未    乙己 → 子申
#   丙丁   → 亥酉    壬癸 → 卯巳
#   辛     → 寅午
_TIANYI: Dict[str, List[str]] = {
    "甲": ["丑", "未"], "戊": ["丑", "未"], "庚": ["丑", "未"],
    "乙": ["子", "申"], "己": ["子", "申"],
    "丙": ["亥", "酉"], "丁": ["亥", "酉"],
    "壬": ["卯", "巳"], "癸": ["卯", "巳"],
    "辛": ["寅", "午"],
}

# 禄神：日干临官之位，主衣食俸禄
#   甲→寅  乙→卯  丙→巳  丁→午  戊→巳
#   己→午  庚→申  辛→酉  壬→亥  癸→子
_LU: Dict[str, str] = {
    "甲": "寅", "乙": "卯", "丙": "巳", "丁": "午", "戊": "巳",
    "己": "午", "庚": "申", "辛": "酉", "壬": "亥", "癸": "子",
}

# 羊刃（阳干专属）：日干帝旺之位，主刚烈果断
#   甲→卯  丙→午  戊→午  庚→酉  壬→子
#   阴干无羊刃（部分流派用"飞刃"，此处暂不取）
_YANGREN: Dict[str, str] = {
    "甲": "卯", "丙": "午", "戊": "午", "庚": "酉", "壬": "子",
}

# 文昌：主聪明才学、利考试文章
#   甲→巳  乙→午  丙→申  丁→酉  戊→申
#   己→酉  庚→亥  辛→子  壬→寅  癸→卯
_WENCHANG: Dict[str, str] = {
    "甲": "巳", "乙": "午", "丙": "申", "丁": "酉", "戊": "申",
    "己": "酉", "庚": "亥", "辛": "子", "壬": "寅", "癸": "卯",
}



# ── 第二批神煞（2026-11 补入）──────────────────────────────────────────

# 太极贵人（日干）：甲乙→子午  丙丁→卯酉  戊己→辰戌丑未  庚辛→寅亥  壬癸→巳申
_TAIJI: Dict[str, List[str]] = {
    "甲": ["子", "午"], "乙": ["子", "午"],
    "丙": ["卯", "酉"], "丁": ["卯", "酉"],
    "戊": ["辰", "戌", "丑", "未"], "己": ["辰", "戌", "丑", "未"],
    "庚": ["寅", "亥"], "辛": ["寅", "亥"],
    "壬": ["巳", "申"], "癸": ["巳", "申"],
}

# 天德贵人（月支）：正丁二申宫，三壬四辛同，五亥六甲上，七癸八寅逢，九丙十归乙，子巳丑庚中。
# 目标可能是天干也可能是地支，四柱干支都要查。
_TIANDE: Dict[str, str] = {
    "寅": "丁", "卯": "申", "辰": "壬", "巳": "辛", "午": "亥", "未": "甲",
    "申": "癸", "酉": "寅", "戌": "丙", "亥": "乙", "子": "巳", "丑": "庚",
}

# 月德贵人（月支三合）：寅午戌→丙  申子辰→壬  亥卯未→甲  巳酉丑→庚，查四柱天干
_YUEDE: Dict[str, str] = {
    "寅": "丙", "午": "丙", "戌": "丙",
    "申": "壬", "子": "壬", "辰": "壬",
    "亥": "甲", "卯": "甲", "未": "甲",
    "巳": "庚", "酉": "庚", "丑": "庚",
}

# 金舆（日干）：甲辰 乙巳 丙未 丁申 戊未 己申 庚戌 辛亥 壬丑 癸寅
_JINYU: Dict[str, str] = {
    "甲": "辰", "乙": "巳", "丙": "未", "丁": "申", "戊": "未",
    "己": "申", "庚": "戌", "辛": "亥", "壬": "丑", "癸": "寅",
}

# 红鸾（年支）：子→卯 丑→寅 寅→丑 卯→子 辰→亥 巳→戌 午→酉 未→申 申→未 酉→午 戌→巳 亥→辰
_HONGLUAN: Dict[str, str] = {
    "子": "卯", "丑": "寅", "寅": "丑", "卯": "子", "辰": "亥", "巳": "戌",
    "午": "酉", "未": "申", "申": "未", "酉": "午", "戌": "巳", "亥": "辰",
}

# 天喜（年支）：红鸾的对冲位
_TIANXI: Dict[str, str] = {
    "子": "酉", "丑": "申", "寅": "未", "卯": "午", "辰": "巳", "巳": "辰",
    "午": "卯", "未": "寅", "申": "丑", "酉": "子", "戌": "亥", "亥": "戌",
}

# 孤辰、寡宿（年支所在三会方）：亥子丑→寅/戌  寅卯辰→巳/丑  巳午未→申/辰  申酉戌→亥/未
_GUCHEN: Dict[str, str] = {
    "亥": "寅", "子": "寅", "丑": "寅",
    "寅": "巳", "卯": "巳", "辰": "巳",
    "巳": "申", "午": "申", "未": "申",
    "申": "亥", "酉": "亥", "戌": "亥",
}
_GUASU: Dict[str, str] = {
    "亥": "戌", "子": "戌", "丑": "戌",
    "寅": "丑", "卯": "丑", "辰": "丑",
    "巳": "辰", "午": "辰", "未": "辰",
    "申": "未", "酉": "未", "戌": "未",
}

# 劫煞（三合局绝位）：申子辰→巳  寅午戌→亥  巳酉丑→寅  亥卯未→申
_JIESHA: Dict[str, str] = {
    "申": "巳", "子": "巳", "辰": "巳",
    "寅": "亥", "午": "亥", "戌": "亥",
    "巳": "寅", "酉": "寅", "丑": "寅",
    "亥": "申", "卯": "申", "未": "申",
}

# 亡神（三合局临官位）：申子辰→亥  寅午戌→巳  巳酉丑→申  亥卯未→寅
_WANGSHEN: Dict[str, str] = {
    "申": "亥", "子": "亥", "辰": "亥",
    "寅": "巳", "午": "巳", "戌": "巳",
    "巳": "申", "酉": "申", "丑": "申",
    "亥": "寅", "卯": "寅", "未": "寅",
}

# 魁罡：日柱本身
_KUIGANG = {"庚辰", "庚戌", "壬辰", "戊戌"}


def _second_batch(pillars: List[str], result: Dict[int, List[str]]) -> None:
    """第二批神煞，追加在第一批之后。顺序与模块文档的编号一致。"""
    year_zhi = _zhi_at(pillars, 0)
    month_zhi = _zhi_at(pillars, 1)
    day_zhi = _zhi_at(pillars, 2)
    day_gan = pillars[2][0] if len(pillars[2]) >= 1 else ""
    gans = [p[0] if len(p) >= 1 else "" for p in pillars[:4]]
    zhis = [_zhi_at(pillars, i) for i in range(4)]

    def add(idx: int, name: str) -> None:
        if name not in result[idx]:
            result[idx].append(name)

    # 年支、日支两个基准都查的（与桃花同一结构：年支先，日支不同时再补）
    def by_year_and_day(table: Dict[str, str], name: str) -> None:
        for i in range(4):
            if not zhis[i]:
                continue
            if year_zhi and table.get(year_zhi) == zhis[i]:
                add(i, name)
            if day_zhi and day_zhi != year_zhi and table.get(day_zhi) == zhis[i]:
                add(i, name)

    for i in range(4):
        # 9. 太极贵人
        if day_gan and zhis[i] in _TAIJI.get(day_gan, []):
            add(i, "太极贵人")
    for i in range(4):
        # 10. 天德贵人：目标为天干时查天干，为地支时查地支
        target = _TIANDE.get(month_zhi, "")
        if target and (gans[i] == target or zhis[i] == target):
            add(i, "天德贵人")
    for i in range(4):
        # 11. 月德贵人
        target = _YUEDE.get(month_zhi, "")
        if target and gans[i] == target:
            add(i, "月德贵人")
    for i in range(4):
        # 12. 金舆
        if day_gan and zhis[i] and _JINYU.get(day_gan) == zhis[i]:
            add(i, "金舆")
    for name, table in (("红鸾", _HONGLUAN), ("天喜", _TIANXI), ("孤辰", _GUCHEN), ("寡宿", _GUASU)):
        # 13–16. 以年支为基准
        for i in range(4):
            if year_zhi and zhis[i] and table.get(year_zhi) == zhis[i]:
                add(i, name)
    # 17–18. 劫煞、亡神
    by_year_and_day(_JIESHA, "劫煞")
    by_year_and_day(_WANGSHEN, "亡神")
    # 19. 魁罡
    if len(pillars) >= 3 and pillars[2] in _KUIGANG:
        add(2, "魁罡")

# ══════════════════════════════════════════════════════════════════════════
# 公开 API
# ══════════════════════════════════════════════════════════════════════════

def calculate_shensha(pillars: List[str]) -> Dict[int, List[str]]:
    """
    根据四柱干支计算八字神煞。

    参数：
        pillars: 四柱干支列表，顺序为 [年柱, 月柱, 日柱, 时柱]，
                 每柱为两位字符串，如 ["庚午", "壬午", "甲子", "丙寅"]。

    返回：
        Dict[int, List[str]]，key 为柱索引 (0=年, 1=月, 2=日, 3=时)，
        value 为该柱地支上出现的神煞名称列表。
        例如: {0: ["禄神"], 2: ["桃花", "天乙贵人"], ...}

    计算逻辑：
        1. 取年支、日支作为三合局神煞的太极点；
        2. 取日干作为天干类神煞的太极点；
        3. 遍历四柱地支，逐一查找是否命中各类神煞。
    """
    if len(pillars) < 4:
        return {i: [] for i in range(4)}

    # 提取年支、日支、日干
    year_zhi = _zhi_at(pillars, 0)
    day_zhi = _zhi_at(pillars, 2)
    day_gan = pillars[2][0] if len(pillars[2]) >= 1 else ""

    # 初始化结果：每柱一个空列表
    result: Dict[int, List[str]] = {i: [] for i in range(4)}

    # ── 三合局类神煞（桃花、驿马、华盖、将星）───────────────────────────
    # 这些神煞以年支和日支所属三合局来定位，查四柱地支是否出现目标支。
    # 正统命理中，桃花和华盖一般年日同看，驿马和将星以日支为主；
    # 此处为全面起见，年支日支均查。

    for pillar_idx in range(4):
        zhi = _zhi_at(pillars, pillar_idx)
        if not zhi:
            continue

        # 桃花：查年支、日支对应的桃花位
        if year_zhi and _TAOHUA.get(year_zhi) == zhi:
            result[pillar_idx].append("桃花")
        if day_zhi and day_zhi != year_zhi and _TAOHUA.get(day_zhi) == zhi:
            # 避免年支日支相同时重复计桃花
            if "桃花" not in result[pillar_idx]:
                result[pillar_idx].append("桃花")

        # 驿马：以日支为主（年支辅之，部分流派仅取日支）
        if day_zhi and _YIMA.get(day_zhi) == zhi:
            result[pillar_idx].append("驿马")
        elif year_zhi and year_zhi != day_zhi and _YIMA.get(year_zhi) == zhi:
            if "驿马" not in result[pillar_idx]:
                result[pillar_idx].append("驿马")

        # 华盖：查年支、日支对应的华盖位
        if year_zhi and _HUAGAI.get(year_zhi) == zhi:
            result[pillar_idx].append("华盖")
        if day_zhi and day_zhi != year_zhi and _HUAGAI.get(day_zhi) == zhi:
            if "华盖" not in result[pillar_idx]:
                result[pillar_idx].append("华盖")

        # 将星：以日支为主
        if day_zhi and _JIANGXING.get(day_zhi) == zhi:
            result[pillar_idx].append("将星")
        elif year_zhi and year_zhi != day_zhi and _JIANGXING.get(year_zhi) == zhi:
            if "将星" not in result[pillar_idx]:
                result[pillar_idx].append("将星")

    # ── 天干类神煞（天乙贵人、羊刃、禄神、文昌）─────────────────────────
    # 这些神煞以日干为太极点，查四柱地支是否出现目标支。

    if day_gan:
        # 天乙贵人
        tianyi_targets = _TIANYI.get(day_gan, [])
        for pillar_idx in range(4):
            zhi = _zhi_at(pillars, pillar_idx)
            if zhi and zhi in tianyi_targets:
                result[pillar_idx].append("天乙贵人")

        # 禄神
        lu_target = _LU.get(day_gan, "")
        if lu_target:
            for pillar_idx in range(4):
                zhi = _zhi_at(pillars, pillar_idx)
                if zhi == lu_target:
                    result[pillar_idx].append("禄神")

        # 羊刃（仅阳干）
        yangren_target = _YANGREN.get(day_gan, "")
        if yangren_target:
            for pillar_idx in range(4):
                zhi = _zhi_at(pillars, pillar_idx)
                if zhi == yangren_target:
                    result[pillar_idx].append("羊刃")

        # 文昌
        wenchang_target = _WENCHANG.get(day_gan, "")
        if wenchang_target:
            for pillar_idx in range(4):
                zhi = _zhi_at(pillars, pillar_idx)
                if zhi == wenchang_target:
                    result[pillar_idx].append("文昌")

    _second_batch(pillars, result)
    return result


def format_shensha_for_pillars(shensha_dict: Dict[int, List[str]]) -> List[str]:
    """
    将神煞字典格式化为四柱列表形式，方便直接嵌入返回结果。

    返回：
        List[str]，长度 4，每项为空格分隔的神煞名称字符串。
        例如: ["禄神", "桃花 天乙贵人", "", "文昌"]
    """
    return [
        " ".join(shensha_dict.get(i, []))
        for i in range(4)
    ]


__all__ = ["calculate_shensha", "format_shensha_for_pillars"]
