# -*- coding: utf-8 -*-
"""
古典命理文本知识库
从 JSON 文件加载穷通宝鉴、滴天髓、子平真诠、三命通会等古籍数据。
按日主 + 月令检索，供 system prompt 注入与工具查询。
"""
import json
import os
from typing import Any, Dict, List, Optional

# ── 数据目录 ──────────────────────────────────────────────────
_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "classical_texts")


def _load_json(filename: str) -> Dict[str, Any]:
    """加载 JSON 文件，失败时返回空 dict。"""
    path = os.path.join(_DATA_DIR, filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


# ── 月支 -> 季节 ──────────────────────────────────────────────
MONTH_ZHI_TO_SEASON = {
    "寅": "春月", "卯": "春月", "辰": "春月",
    "巳": "夏月", "午": "夏月", "未": "夏月",
    "申": "秋月", "酉": "秋月", "戌": "秋月",
    "亥": "冬月", "子": "冬月", "丑": "冬月",
}

# ── 加载 JSON 数据 ────────────────────────────────────────────
_qiongtong_data = _load_json("qiongtong_baojian.json")
_disitian_data = _load_json("di_tian_sui.json")
_ziping_data = _load_json("ziping_zhenquan.json")
_sanming_data = _load_json("sanming_tonghui.json")
_yuanhai_data = _load_json("yuanhai_ziping.json")

# ── 穷通宝鉴：从 JSON 构建索引 ────────────────────────────────
# 原始 JSON 格式: entries["甲日_寅月"] = { "原文": "..." }
# 需要转换为: QIONGTONG_BAOJIAN["甲"]["春月"] = { "用神": "...", "原文": "...", "白话": "..." }
QIONGTONG_BAOJIAN: Dict[str, Dict[str, Dict[str, str]]] = {}

def _build_qiongtong_index():
    """从 JSON 数据构建穷通宝鉴索引。"""
    entries = _qiongtong_data.get("entries", {})
    for key, entry in entries.items():
        # key 格式: "甲日_寅月"
        parts = key.split("_")
        if len(parts) != 2:
            continue
        day_master = parts[0].replace("日", "")
        month_zhi = parts[1].replace("月", "")
        season = MONTH_ZHI_TO_SEASON.get(month_zhi, "春月")

        if day_master not in QIONGTONG_BAOJIAN:
            QIONGTONG_BAOJIAN[day_master] = {}

        # 从原文中提取用神信息
        原文 = entry.get("原文", "")
        QIONGTONG_BAOJIAN[day_master][season] = {
            "用神": 原文.split("。")[0] if "。" in 原文 else 原文,
            "原文": 原文,
            "白话": entry.get("解析", ""),
        }

_build_qiongtong_index()


# ── 滴天髓：从 JSON 构建索引 ──────────────────────────────────
DI_TIAN_SUI: Dict[str, Dict[str, str]] = {}

def _build_disitian_index():
    """从 JSON 数据构建滴天髓索引。"""
    entries = _disitian_data.get("entries", {})
    for key, entry in entries.items():
        DI_TIAN_SUI[key] = {
            "原文": entry.get("原文", ""),
            "白话": entry.get("解析", ""),
            "应用": entry.get("喜忌", ""),
        }

_build_disitian_index()

# 滴天髓：日主 -> 适用原则列表
_DISITIAN_DAY_MASTER_MAP: Dict[str, list] = {
    "甲": ["十干体性_甲", "月令提纲论", "日主衰旺论", "配合论"],
    "乙": ["十干体性_乙", "月令提纲论", "日主衰旺论", "配合论"],
    "丙": ["十干体性_丙", "月令提纲论", "日主衰旺论", "配合论"],
    "丁": ["十干体性_丁", "月令提纲论", "日主衰旺论", "配合论"],
    "戊": ["十干体性_戊", "日主衰旺论", "月令提纲论", "配合论", "生克制化_总论"],
    "己": ["十干体性_己", "日主衰旺论", "月令提纲论", "配合论", "生克制化_总论"],
    "庚": ["十干体性_庚", "日主衰旺论", "月令提纲论", "配合论", "合化论"],
    "辛": ["十干体性_辛", "日主衰旺论", "月令提纲论", "配合论", "合化论"],
    "壬": ["十干体性_壬", "日主衰旺论", "月令提纲论", "情通论", "流通论"],
    "癸": ["十干体性_癸", "日主衰旺论", "月令提纲论", "情通论", "流通论"],
}


# ── 子平真诠：从 JSON 构建索引 ────────────────────────────────
ZIPING_ZHENQUAN: Dict[str, Dict[str, str]] = {}

def _build_ziping_index():
    """从 JSON 数据构建子平真诠索引。"""
    entries = _ziping_data.get("entries", {})
    for key, entry in entries.items():
        if "格" in key:
            # 格局条目
            ZIPING_ZHENQUAN[key] = {
                "原文": entry.get("取格", ""),
                "白话": entry.get("口诀", ""),
                "成格条件": entry.get("取法", entry.get("取格", "")),
                "破格条件": entry.get("忌", ""),
                "喜忌": f"喜：{entry.get('喜', '')}。忌：{entry.get('忌', '')}",
                "应用": entry.get("贵格", ""),
            }

_build_ziping_index()

# 十神 -> 格局名映射
_SHISHEN_TO_GEJU = {
    "正官": "正官格",
    "七杀": "七杀格",
    "正财": "正财格",
    "偏财": "偏财格",
    "食神": "食神格",
    "伤官": "伤官格",
    "正印": "正印格",
    "偏印": "偏印格",
}


# ── 三命通会：从 JSON 构建索引 ────────────────────────────────
SANMING_TONGHUI: Dict[str, Dict[str, str]] = {}

def _build_sanming_index():
    """从 JSON 数据构建三命通会索引。"""
    entries = _sanming_data.get("entries", {})
    for key, entry in entries.items():
        SANMING_TONGHUI[key] = entry

_build_sanming_index()


# ═══════════════════════════════════════════════════════════════
# 公共 API 函数（保持向后兼容）
# ═══════════════════════════════════════════════════════════════

def get_qiongtong_guidance(day_master: str, month_zhi: str) -> str:
    """
    根据日主和月支返回《穷通宝鉴》调候用神指引。
    day_master: 日主天干（如 "甲"）；month_zhi: 月支（如 "寅"）。
    """
    if not day_master or not month_zhi:
        return ""
    season = MONTH_ZHI_TO_SEASON.get(month_zhi, "春月")
    stem_guidance = QIONGTONG_BAOJIAN.get(day_master, {})
    guidance = stem_guidance.get(season, {})
    if not guidance:
        return ""
    return (
        f"**《穷通宝鉴》调候用神（{day_master}日主 {season}）**\n"
        f"- 用神：{guidance.get('用神', '')}\n"
        f"- 原文：{guidance.get('原文', '')}\n"
        f"- 白话：{guidance.get('白话', '')}"
    )


def get_qiongtong_for_tool(day_master: str, month_zhi: str) -> Dict[str, Any]:
    """供工具调用的结构化返回。"""
    if not day_master or not month_zhi:
        return {"context": "缺少日主或月支。"}
    season = MONTH_ZHI_TO_SEASON.get(month_zhi, "春月")
    guidance = (QIONGTONG_BAOJIAN.get(day_master, {}) or {}).get(season, {})
    if not guidance:
        return {"context": f"未收录「{day_master}日主 {season}」的条文。"}
    return {
        "day_master": day_master,
        "month_zhi": month_zhi,
        "season": season,
        "用神": guidance.get("用神", ""),
        "原文": guidance.get("原文", ""),
        "白话": guidance.get("白话", ""),
        "context": f"《穷通宝鉴》{day_master}日主{season}：用神{guidance.get('用神', '')}。{guidance.get('白话', '')}",
    }


def get_disitian_sui_guidance(day_master: str, month_zhi: str) -> str:
    """
    根据日主和月支返回《滴天髓》相关理法指引。
    day_master: 日主天干（如 "甲"）；month_zhi: 月支（如 "寅"）。
    """
    if not day_master:
        return ""
    keys = _DISITIAN_DAY_MASTER_MAP.get(day_master, [])
    # 通用原则始终包含
    universal = ["通神论_天干", "通神论_地支", "用神论"]
    all_keys = list(dict.fromkeys(universal + keys))  # 去重保序
    lines = [f"**《滴天髓》理法参考（日主：{day_master}）**"]
    for key in all_keys:
        entry = DI_TIAN_SUI.get(key)
        if not entry:
            continue
        label = key.replace("_", " · ")
        lines.append(f"\n【{label}】")
        lines.append(f"- 原文：{entry['原文']}")
        lines.append(f"- 白话：{entry['白话']}")
        lines.append(f"- 应用：{entry['应用']}")
    return "\n".join(lines)


def get_disitian_for_tool(day_master: str, month_zhi: str) -> Dict[str, Any]:
    """供工具调用的结构化返回。"""
    if not day_master:
        return {"context": "缺少日主。"}
    keys = _DISITIAN_DAY_MASTER_MAP.get(day_master, [])
    universal = ["通神论_天干", "通神论_地支", "用神论"]
    all_keys = list(dict.fromkeys(universal + keys))
    entries = {}
    for key in all_keys:
        entry = DI_TIAN_SUI.get(key)
        if entry:
            entries[key] = entry
    return {
        "day_master": day_master,
        "month_zhi": month_zhi,
        "source": "滴天髓",
        "principles": entries,
        "context": f"《滴天髓》日主{day_master}相关理法共{len(entries)}条。",
    }


def _get_month_branch_stem(month_zhi: str) -> str:
    """根据月支返回月令本气所对应的天干（需配合日主使用）。"""
    _BRANCH_MAIN_STEM = {
        "寅": "甲", "卯": "乙", "辰": "戊", "巳": "丙",
        "午": "丁", "未": "己", "申": "庚", "酉": "辛",
        "戌": "戊", "亥": "壬", "子": "癸", "丑": "己",
    }
    return _BRANCH_MAIN_STEM.get(month_zhi, "")


def _stem_relation(day_master: str, other_stem: str) -> str:
    """返回 other_stem 相对于 day_master 的十神名称。"""
    _WUXING = {"甲": "木", "乙": "木", "丙": "火", "丁": "火", "戊": "土", "己": "土", "庚": "金", "辛": "金", "壬": "水", "癸": "水"}
    _YINYANG = {"甲": "阳", "乙": "阴", "丙": "阳", "丁": "阴", "戊": "阳", "己": "阴", "庚": "阳", "辛": "阴", "壬": "阳", "癸": "阴"}
    _GENERATE = {"木": "火", "火": "土", "土": "金", "金": "水", "水": "木"}
    _OVERCOME = {"木": "土", "土": "水", "水": "火", "火": "金", "金": "木"}

    dm_wx = _WUXING.get(day_master, "")
    dm_yy = _YINYANG.get(day_master, "")
    ot_wx = _WUXING.get(other_stem, "")
    ot_yy = _YINYANG.get(other_stem, "")
    if not dm_wx or not ot_wx:
        return ""
    same_yy = dm_yy == ot_yy
    if dm_wx == ot_wx:
        return "比肩" if same_yy else "劫财"
    if _GENERATE.get(dm_wx) == ot_wx:
        return "食神" if same_yy else "伤官"
    if _GENERATE.get(ot_wx) == dm_wx:
        return "偏印" if same_yy else "正印"
    if _OVERCOME.get(dm_wx) == ot_wx:
        return "偏财" if same_yy else "正财"
    if _OVERCOME.get(ot_wx) == dm_wx:
        return "七杀" if same_yy else "正官"
    return ""


def get_ziping_pattern_guidance(
    day_master: str, month_zhi: str, geju_name: str = ""
) -> str:
    """
    根据日主和月支返回《子平真诠》格局论法指引。

    day_master: 日主天干（如 "甲"）；month_zhi: 月支（如 "寅"）。
    geju_name:  已由 ``analyze_geju`` 算出的格局名（如 "正官格"）。**优先使用。**

    为什么需要 ``geju_name``：子平真诠取格要看**透干**，而不是只看月令本气。
    例如庚日主生未月，未藏 己(本气)、丁(中气)、乙(余气)；若本气己不透而中气丁
    正透月干，则应取丁为格（正官格），而非按本气己取正印格。本函数若只拿到月支，
    只能按本气粗判，会与 ``analyze_geju`` 的结论不一致——两个结论同时进入提示词，
    模型就只能在互斥证据里瞎挑。因此调用方应把算好的格局传进来。
    """
    if not day_master or not month_zhi:
        return ""

    source = "取格（含透干）"
    if not geju_name:
        month_stem = _get_month_branch_stem(month_zhi)
        if not month_stem:
            return ""
        shishen = _stem_relation(day_master, month_stem)
        geju_name = _SHISHEN_TO_GEJU.get(shishen, "")
        source = "月令本气"
        if not geju_name:
            return (
                "**《子平真诠》格局参考**\n"
                f"月令本气{month_stem}对日主{day_master}为「{shishen}」，"
                "非八格正格，需以变格论之。"
            )

    entry = ZIPING_ZHENQUAN.get(geju_name, {})
    if not entry:
        return (
            "**《子平真诠》格局参考**\n"
            f"命局取「{geju_name}」，非八格正格，需以变格论之。"
        )
    return (
        f"**《子平真诠》格局参考（{day_master}日主 月令{month_zhi} → {geju_name}"
        f"，依据：{source}）**\n"
        f"- 原文：{entry.get('原文', '')}\n"
        f"- 白话：{entry.get('白话', '')}\n"
        f"- 成格条件：{entry.get('成格条件', '')}\n"
        f"- 破格条件：{entry.get('破格条件', '')}\n"
        f"- 喜忌：{entry.get('喜忌', '')}\n"
        f"- 应用：{entry.get('应用', '')}"
    )


def get_ziping_for_tool(
    day_master: str, month_zhi: str, geju_name: str = ""
) -> Dict[str, Any]:
    """
    供工具调用的结构化返回。

    与 ``get_ziping_pattern_guidance`` 同理：取格要看**透干**而非只看月令本气。
    调用方（``bazi_tools.query_ziping_guidance``）会把 ``analyze_geju`` 算好的格局
    传进来；否则退回本气粗判，并在 ``依据`` 字段标明，免得模型拿到两个互斥的格名。
    """
    if not day_master or not month_zhi:
        return {"context": "缺少日主或月支。"}
    month_stem = _get_month_branch_stem(month_zhi)
    if not month_stem:
        return {"context": f"无法确定月令{month_zhi}的本气藏干。"}

    shishen = _stem_relation(day_master, month_stem)
    source = "取格（含透干）"
    if not geju_name:
        geju_name = _SHISHEN_TO_GEJU.get(shishen, "")
        source = "月令本气"

    if not geju_name:
        return {
            "day_master": day_master,
            "month_zhi": month_zhi,
            "month_stem": month_stem,
            "shishen": shishen,
            "source": "子平真诠",
            "依据": source,
            "context": f"月令本气{month_stem}对日主{day_master}为「{shishen}」，非八格正格。",
        }

    entry = ZIPING_ZHENQUAN.get(geju_name, {})
    if not entry:
        return {
            "day_master": day_master,
            "month_zhi": month_zhi,
            "month_stem": month_stem,
            "geju_name": geju_name,
            "source": "子平真诠",
            "依据": source,
            "context": f"命局取「{geju_name}」，非八格正格，需以变格论之。",
        }
    return {
        "day_master": day_master,
        "month_zhi": month_zhi,
        "month_stem": month_stem,
        "shishen": shishen,
        "geju_name": geju_name,
        "source": "子平真诠",
        "依据": source,
        "原文": entry.get("原文", ""),
        "白话": entry.get("白话", ""),
        "成格条件": entry.get("成格条件", ""),
        "破格条件": entry.get("破格条件", ""),
        "喜忌": entry.get("喜忌", ""),
        "应用": entry.get("应用", ""),
        "context": (
            f"《子平真诠》{day_master}日主月令{month_zhi}→{geju_name}"
            f"（依据：{source}）。{entry.get('白话', '')}"
        ),
    }


# ═══════════════════════════════════════════════════════════════
# 新增：三命通会查询函数
# ═══════════════════════════════════════════════════════════════

def get_sanming_guidance(category: str, key: str) -> str:
    """
    根据分类和键名返回《三命通会》相关条目。
    category: 分类（宫位/六亲/运年/强弱）
    key: 键名（年柱/月柱/日柱/时柱/父母/配偶等）
    """
    if not key:
        return ""
    entry = SANMING_TONGHUI.get(key, {})
    if not entry:
        # 尝试带前缀查找
        for prefix in ["六亲_", "运年_", "强弱_"]:
            entry = SANMING_TONGHUI.get(f"{prefix}{key}", {})
            if entry:
                break
    if not entry:
        return ""
    lines = [f"**《三命通会》参考（{key}）**"]
    for k, v in entry.items():
        if k in ("category", "key", "出处", "tags"):
            continue
        if isinstance(v, str):
            lines.append(f"- {k}：{v}")
    return "\n".join(lines)


def get_sanming_for_tool(category: str, key: str) -> Dict[str, Any]:
    """供工具调用的结构化返回。"""
    if not key:
        return {"context": "缺少查询键名。"}
    entry = SANMING_TONGHUI.get(key, {})
    if not entry:
        for prefix in ["六亲_", "运年_", "强弱_"]:
            entry = SANMING_TONGHUI.get(f"{prefix}{key}", {})
            if entry:
                break
    if not entry:
        return {"context": f"未收录「{key}」的条文。"}
    return {
        "source": "三命通会",
        "key": key,
        "entry": entry,
        "context": f"《三命通会》{key}：{entry.get('原文', entry.get('断法', ''))}",
    }


# 跨古籍分类别名：部分古籍未单独设「格局」等分类，相关论述散见于其他分类。
# 例：渊海子平的格局论命内容归于「论法」「总论」，故 category=格局 映射到这两类。
# （子平真诠本身设有「格局」正式分类，不在此映射，按原值精确匹配。）
_CATEGORY_ALIASES: Dict[str, Dict[str, List[str]]] = {
    "渊海子平": {
        "格局": ["论法", "总论"],
    },
}


def query_classical_text(source: str, category: str = "", key: str = "") -> List[Dict[str, Any]]:
    """
    通用古籍查询函数。
    source: 古籍名（穷通宝鉴/滴天髓/子平真诠/三命通会/渊海子平）
    category: 分类筛选（支持别名，如渊海子平的「格局」→「论法/总论」）
    key: 键名筛选
    """
    data_map = {
        "穷通宝鉴": _qiongtong_data,
        "滴天髓": _disitian_data,
        "子平真诠": _ziping_data,
        "三命通会": _sanming_data,
        "渊海子平": _yuanhai_data,
    }

    data = data_map.get(source, {})
    if not data:
        return [{"error": f"未找到古籍「{source}」"}]

    entries = data.get("entries", {})
    results = []

    # 解析分类别名（如渊海子平「格局」→「论法/总论」），未命中别名时即为原值精确匹配
    allowed_categories = set()
    if category:
        allowed_categories = {category} | set(
            _CATEGORY_ALIASES.get(source, {}).get(category, [])
        )

    for entry_key, entry in entries.items():
        # 按分类筛选（含别名）
        if category and entry.get("category", "") not in allowed_categories:
            continue
        # 按键名筛选
        if key and key not in entry_key and key not in entry.get("key", ""):
            continue
        results.append({
            "key": entry_key,
            "source": source,
            **entry,
        })

    return results if results else [{"context": f"在「{source}」中未找到匹配条目。"}]
