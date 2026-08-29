# -*- coding: utf-8 -*-
"""
格局判定：根据月令、透干、日主强弱判断正格/从格；取格顺序（月干透优先、年时透、坐根）。
十神数据源优先使用 lunar_python.util.LunarUtil.SHI_SHEN。
"""
import json
from typing import Any, Dict, List

from .wuxing_calculator import GAN_TO_ELEMENT, ZHI_HIDDEN_STEMS, calculate_wuxing_power

# 十神：优先从 LunarUtil.SHI_SHEN 构建（键为 日干+他干，如 "甲丙"->"食神"）
try:
    from lunar_python.util import LunarUtil
    _gans = list(LunarUtil.WU_XING_GAN.keys())
    SHISHEN_MAP: Dict[str, Dict[str, str]] = {}
    for day_gan in _gans:
        SHISHEN_MAP[day_gan] = {other: LunarUtil.SHI_SHEN.get(day_gan + other, "") for other in _gans}
except Exception:
    SHISHEN_MAP = {
        "甲": {"甲": "比肩", "乙": "劫财", "丙": "食神", "丁": "伤官", "戊": "偏财", "己": "正财", "庚": "七杀", "辛": "正官", "壬": "偏印", "癸": "正印"},
        "乙": {"甲": "劫财", "乙": "比肩", "丙": "伤官", "丁": "食神", "戊": "正财", "己": "偏财", "庚": "正官", "辛": "七杀", "壬": "正印", "癸": "偏印"},
        "丙": {"甲": "偏印", "乙": "正印", "丙": "比肩", "丁": "劫财", "戊": "食神", "己": "伤官", "庚": "偏财", "辛": "正财", "壬": "七杀", "癸": "正官"},
        "丁": {"甲": "正印", "乙": "偏印", "丙": "劫财", "丁": "比肩", "戊": "伤官", "己": "食神", "庚": "正财", "辛": "偏财", "壬": "正官", "癸": "七杀"},
        "戊": {"甲": "七杀", "乙": "正官", "丙": "偏印", "丁": "正印", "戊": "比肩", "己": "劫财", "庚": "食神", "辛": "伤官", "壬": "偏财", "癸": "正财"},
        "己": {"甲": "正官", "乙": "七杀", "丙": "正印", "丁": "偏印", "戊": "劫财", "己": "比肩", "庚": "伤官", "辛": "食神", "壬": "正财", "癸": "偏财"},
        "庚": {"甲": "偏财", "乙": "正财", "丙": "七杀", "丁": "正官", "戊": "偏印", "己": "正印", "庚": "比肩", "辛": "劫财", "壬": "食神", "癸": "伤官"},
        "辛": {"甲": "正财", "乙": "偏财", "丙": "正官", "丁": "七杀", "戊": "正印", "己": "偏印", "庚": "劫财", "辛": "比肩", "壬": "伤官", "癸": "食神"},
        "壬": {"甲": "食神", "乙": "伤官", "丙": "偏财", "丁": "正财", "戊": "七杀", "己": "正官", "庚": "偏印", "辛": "正印", "壬": "比肩", "癸": "劫财"},
        "癸": {"甲": "伤官", "乙": "食神", "丙": "正财", "丁": "偏财", "戊": "正官", "己": "七杀", "庚": "正印", "辛": "偏印", "壬": "劫财", "癸": "比肩"},
    }


# 阳干日主。传统判准：阳干只要四柱见一点印或比劫之助，即不舍命相从，
# 故阳干不可轻言从格（阴干在全无生助时尚可入「假从」）。
YANG_GAN = {"甲", "丙", "戊", "庚", "壬"}

# 五行生克。用于把「最旺的五行」翻译成它对日主的十神关系，
# 从而给出确定的从格名称，而不是「需细辨」。
_SHENG = {"木": "火", "火": "土", "土": "金", "金": "水", "水": "木"}
_KE = {"木": "土", "土": "水", "水": "火", "火": "金", "金": "木"}

_YIN_SHISHEN = {"正印", "偏印"}
_BIJIE_SHISHEN = {"比肩", "劫财"}


def _all_other_stems(pillars: List[str]) -> List[str]:
    """四柱中除日干以外的全部天干与地支藏干。"""
    stems: List[str] = []
    for idx, pillar in enumerate(pillars):
        if not pillar:
            continue
        gan = pillar[0] if len(pillar) >= 1 else ""
        zhi = pillar[1] if len(pillar) >= 2 else ""
        # 日干本身不算「帮扶」，但日支藏干算。
        if gan and idx != 2:
            stems.append(gan)
        if zhi:
            stems.extend(ZHI_HIDDEN_STEMS.get(zhi, []))
    return stems


def _support_for_day_master(day_master: str, pillars: List[str]) -> Dict[str, List[str]]:
    """找出命局中所有生扶日主的力量（印星与比劫）。"""
    table = SHISHEN_MAP.get(day_master, {}) or {}
    yin: List[str] = []
    bijie: List[str] = []
    for stem in _all_other_stems(pillars):
        name = table.get(stem, "")
        if name in _YIN_SHISHEN:
            yin.append(stem)
        elif name in _BIJIE_SHISHEN:
            bijie.append(stem)
    return {"印星": yin, "比劫": bijie}


def _cong_name(day_master_elem: str, dominant_elem: str) -> str:
    """按最旺五行与日主的生克关系，给出确定的从格名称。"""
    if not day_master_elem or not dominant_elem:
        return "从格"
    if dominant_elem == day_master_elem:
        return "从旺格（专旺）"
    if dominant_elem == _KE.get(day_master_elem):      # 日主所克 → 财
        return "从财格"
    if _KE.get(dominant_elem) == day_master_elem:      # 克日主 → 官杀
        return "从杀格"
    if dominant_elem == _SHENG.get(day_master_elem):   # 日主所生 → 食伤
        return "从儿格"
    if _SHENG.get(dominant_elem) == day_master_elem:   # 生日主 → 印
        return "从强格（从印）"
    return "从格"


def analyze_geju(bazi_data: Dict[str, Any]) -> str:
    """
    格局判定。

    这里刻意把两件事分开报告，因为它们是**两个不同的维度**：

      - 「格局名称」由月令取格决定（月支藏干透干 → 十神 → 格）。
        它描述命局的结构类型，与日主强弱无关。
      - 「日主强弱」由五行力量决定，描述日主能否担起这个结构。

    旧实现会在判定身弱时用「从财/从杀/从儿等（需细辨）」覆盖掉已经算对的
    取格结果，导致同一份提示词里出现互斥结论（取格说正印格、格局字段说从格），
    且「需细辨」本身并不是一个结论。现在取格结果始终保留，从格另立字段，
    且从格必须通过传统判准（阳干见印比即不从）才成立。
    """
    pillars = bazi_data.get("pillars") or []
    day_master = (bazi_data.get("day_master") or "").strip()
    if not pillars or len(pillars) < 2 or not day_master:
        return json.dumps({"context": "命盘数据不完整。"}, ensure_ascii=False)

    month_pillar = pillars[1]
    month_gan = month_pillar[0] if len(month_pillar) >= 1 else ""
    month_zhi = month_pillar[1] if len(month_pillar) >= 2 else ""
    hidden = ZHI_HIDDEN_STEMS.get(month_zhi, [])
    month_main_qi = hidden[0] if hidden else ""
    year_gan = pillars[0][0] if len(pillars[0]) >= 1 else ""
    time_gan = pillars[3][0] if len(pillars) >= 4 and len(pillars[3]) >= 1 else ""

    # 日主五行力量（用精算结果）
    try:
        wuxing_result = json.loads(calculate_wuxing_power(bazi_data))
        power = wuxing_result.get("power", {})
    except Exception:
        power = bazi_data.get("wuxing") or {}
        power = {k.replace("(Metal)", "").replace("(Wood)", "").replace("(Water)", "").replace("(Fire)", "").replace("(Earth)", "").strip(): v for k, v in power.items()}

    dm_elem = GAN_TO_ELEMENT.get(day_master, "")
    dm_power = power.get(dm_elem, 0)
    if isinstance(dm_power, (int, float)):
        pass
    else:
        dm_power = float(dm_power) if dm_power else 0

    # 取格顺序：1) 月支藏干透月干 2) 透年/时干 3) 月干坐根；建禄/月劫（月令主气为比劫）
    shishen_name = ""
    tougan_where = ""
    if month_main_qi and (SHISHEN_MAP.get(day_master, {}) or {}).get(month_main_qi, "") in ("比肩", "劫财"):
        shishen_name = "建禄" if month_main_qi == day_master else "月劫"
        geju_name = f"{shishen_name}格"
        is_tougan = month_gan == month_main_qi
        tougan_where = "月干" if is_tougan else ""
    else:
        tougan_where = ""
        is_tougan = False
        if month_gan and month_gan in hidden:
            shishen_name = (SHISHEN_MAP.get(day_master, {}) or {}).get(month_gan, "")
            tougan_where = "月干"
            is_tougan = True
        if not shishen_name and year_gan and year_gan in hidden:
            shishen_name = (SHISHEN_MAP.get(day_master, {}) or {}).get(year_gan, "")
            tougan_where = "年干"
            is_tougan = False
        if not shishen_name and time_gan and time_gan in hidden:
            shishen_name = (SHISHEN_MAP.get(day_master, {}) or {}).get(time_gan, "")
            tougan_where = "时干"
            is_tougan = False
        if not shishen_name and month_gan:
            for idx in (0, 2, 3):
                if idx != 1 and idx < len(pillars) and len(pillars[idx]) >= 2:
                    root_zhi = pillars[idx][1]
                    if month_gan in ZHI_HIDDEN_STEMS.get(root_zhi, []):
                        shishen_name = (SHISHEN_MAP.get(day_master, {}) or {}).get(month_gan, "")
                        tougan_where = "月干坐根"
                        break
        geju_name = f"{shishen_name}格" if shishen_name else "月令格"
        if not tougan_where and month_gan == month_main_qi:
            is_tougan = True
        elif not tougan_where:
            is_tougan = False

    # 身强/身弱/中和（按力量百分比粗判）
    total_power = sum(float(power.get(k, 0)) for k in ["金", "木", "水", "火", "土"])
    if total_power <= 0:
        total_power = 1
    dm_ratio = dm_power / total_power * 100 if total_power else 0
    max_other = max((power.get(k, 0) for k in ["金", "木", "水", "火", "土"] if k != dm_elem), default=0)
    if isinstance(max_other, (int, float)):
        max_other_ratio = max_other / total_power * 100 if total_power else 0
    else:
        max_other_ratio = 0

    # ── 日主强弱（力量占比粗判）──────────────────────────────────
    if dm_ratio >= 35:
        strength = "身旺"
    elif dm_ratio <= 20:
        strength = "身弱"
    else:
        strength = "中和"

    # ── 从格判定：先看力量，再过传统判准 ────────────────────────
    # 力量条件只是入口，不是结论。真正决定能不能从的是有无印比生扶。
    support = _support_for_day_master(day_master, pillars)
    has_support = bool(support["印星"] or support["比劫"])
    dominant_elem = max(
        ("金", "木", "水", "火", "土"),
        key=lambda k: float(power.get(k, 0) or 0),
    )

    cong_type = "非从格"
    cong_reason = ""
    if dm_ratio <= 15 and max_other_ratio >= 40:
        if not has_support:
            cong_type = "真从"
            cong_reason = "日主无根，且全局不见印星与比劫生扶。"
        elif day_master in YANG_GAN:
            cong_type = "非从格"
            cong_reason = (
                f"日主{day_master}为阳干，命局见"
                f"{'印星' if support['印星'] else ''}"
                f"{'、' if support['印星'] and support['比劫'] else ''}"
                f"{'比劫' if support['比劫'] else ''}"
                f"（{'、'.join(support['印星'] + support['比劫'])}）生扶。"
                "阳干得一分生助即不舍命相从，故不作从格论，按身弱正格取用。"
            )
        else:
            cong_type = "假从"
            cong_reason = (
                f"日主{day_master}为阴干，虽见"
                f"{'、'.join(support['印星'] + support['比劫'])}"
                "生扶但力弱，可作假从论，仍需兼顾印比。"
            )

    if cong_type == "真从":
        geju_type = "从格"
        cong_name = _cong_name(dm_elem, dominant_elem)
    elif cong_type == "假从":
        geju_type = "假从格"
        cong_name = _cong_name(dm_elem, dominant_elem)
    else:
        geju_type = f"正格（{strength}）"
        cong_name = ""

    # 取格结果始终保留，不再被强弱判定覆盖。
    context_extra = f"透干位置：{tougan_where}。" if tougan_where else ""
    cong_text = ""
    if cong_name:
        cong_text = f"从格倾向：{cong_name}（{cong_type}）。{cong_reason}"
    elif cong_reason:
        cong_text = f"曾触发从格力量条件，但不成立：{cong_reason}"

    payload = {
        "格局类型": geju_type,
        "格局名称": geju_name,
        "月令": month_zhi,
        "月令主气": month_main_qi,
        "月干透干": is_tougan,
        "透干位置": tougan_where or ("月干" if is_tougan else ""),
        "日主强弱": strength,
        "日主力量占比": round(dm_ratio, 1),
        "最旺五行": dominant_elem,
        "从格判定": cong_type,
        "生扶力量": support,
        "context": (
            f"命局取{geju_name}，为{geju_type}。"
            f"月令{month_zhi}主气{month_main_qi}，{'透干' if is_tougan else '不透'}。"
            f"{context_extra}日主{strength}（占比{round(dm_ratio, 1)}%），最旺五行为{dominant_elem}。"
            f"{cong_text}"
        ),
    }
    if cong_name:
        payload["从格名称"] = cong_name
    return json.dumps(payload, ensure_ascii=False)
