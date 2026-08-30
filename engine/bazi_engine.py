from datetime import datetime
from typing import Dict, Any, List

from lunar_python import Solar

from engine.shensha import calculate_shensha, format_shensha_for_pillars


def _get_shensha_list(shensha_dict: Dict[str, Any] | None) -> str:
    """
    提取吉神凶煞并格式化。
    做成独立工具函数，方便在其他模块（如 Fact-Check 或工具调用）里复用。
    """
    if not shensha_dict:
        return ""
    return " ".join(list(shensha_dict.keys()))


# 三合局、三会局（参考 china-testing/bazi ganzhi.py）
_ZHI_3HE = {"申子辰": "水", "巳酉丑": "金", "寅午戌": "火", "亥卯未": "木"}
_ZHI_3HUI = {"亥子丑": "水", "寅卯辰": "木", "巳午未": "火", "申酉戌": "金"}
_ZHI_HALF_3HE = [("申", "子"), ("子", "辰"), ("申", "辰"), ("巳", "酉"), ("酉", "丑"), ("巳", "丑"),
                 ("寅", "午"), ("午", "戌"), ("寅", "戌"), ("亥", "卯"), ("卯", "未"), ("亥", "未")]


# 天干五合及其化神。此前只算地支关系，天干合克整个漏掉了——
# 与参天 bazi-MCP 交叉核验时才暴露（如本命年干壬与月干丁「丁壬合木」）。
_GAN_5HE = {
    frozenset(("甲", "己")): "土",
    frozenset(("乙", "庚")): "金",
    frozenset(("丙", "辛")): "水",
    frozenset(("丁", "壬")): "木",
    frozenset(("戊", "癸")): "火",
}

_GAN_ELEMENT = {
    "甲": "木", "乙": "木", "丙": "火", "丁": "火", "戊": "土",
    "己": "土", "庚": "金", "辛": "金", "壬": "水", "癸": "水",
}
_ELEMENT_KE = {"木": "土", "土": "水", "水": "火", "火": "金", "金": "木"}


def _calculate_gan_relations(pillars: List[str]) -> Dict[str, List[str]]:
    """
    天干五合与相克。

    只判**相邻两柱**：传统上天干合克讲究紧贴，隔柱作用力大减。
    返回的「干合」附带化神，供调候与格局分析参考。
    """
    labels = ["年", "月", "日", "时"]
    gan = [p[0] if p else "" for p in pillars]
    he: List[str] = []
    ke: List[str] = []

    for i in range(len(gan) - 1):
        a, b = gan[i], gan[i + 1]
        if not a or not b:
            continue
        tag = f"{labels[i]}{labels[i + 1]}"
        hua = _GAN_5HE.get(frozenset((a, b)))
        if hua and a != b:
            he.append(f"{tag}干合({a}{b}合{hua})")
            # 「贪合忘克」：既合则不再以克论。丁壬既是五合又是水克火，
            # 若两者都报，会把同一对关系算成两笔。
            continue
        ea, eb = _GAN_ELEMENT.get(a, ""), _GAN_ELEMENT.get(b, "")
        if ea and eb:
            if _ELEMENT_KE.get(ea) == eb:
                ke.append(f"{tag}干克({a}克{b})")
            elif _ELEMENT_KE.get(eb) == ea:
                ke.append(f"{tag}干克({b}克{a})")

    return {"干合": he, "干克": ke}


def _calculate_xing_chong_he_hai(pillars: List[str]) -> Dict[str, List[str]]:
    """
    自动计算四柱间的刑冲合害、三合三会，以及天干五合与相克。
    """
    if len(pillars) < 4:
        return {"冲": [], "合": [], "刑": [], "害": [], "破": [], "穿": [],
                "三合": [], "三会": [], "半三合": [], "干合": [], "干克": [], "双合": []}

    zhi = [p[1] if len(p) >= 2 else "" for p in pillars]
    labels = ["年", "月", "日", "时"]
    zhi_set = set(z for z in zhi if z)

    chong_map = {"子": "午", "丑": "未", "寅": "申", "卯": "酉", "辰": "戌", "巳": "亥"}
    he_map = {"子": "丑", "寅": "亥", "卯": "戌", "辰": "酉", "巳": "申", "午": "未"}
    hai_map = {"子": "未", "丑": "午", "寅": "巳", "卯": "辰", "申": "亥", "酉": "戌"}
    po_map = {"子": "酉", "卯": "午", "午": "卯", "酉": "子", "辰": "丑", "戌": "未", "丑": "辰", "未": "戌"}

    chong, he, xing, hai, po = [], [], [], [], []
    san_he, san_hui, half_he = [], [], []

    for i in range(4):
        for j in range(i + 1, 4):
            if not zhi[i] or not zhi[j]:
                continue
            if chong_map.get(zhi[i]) == zhi[j]:
                chong.append(f"{labels[i]}{labels[j]}相冲({zhi[i]}{zhi[j]})")
            if he_map.get(zhi[i]) == zhi[j] or he_map.get(zhi[j]) == zhi[i]:
                he.append(f"{labels[i]}{labels[j]}六合({zhi[i]}{zhi[j]})")
            if hai_map.get(zhi[i]) == zhi[j] or hai_map.get(zhi[j]) == zhi[i]:
                hai.append(f"{labels[i]}{labels[j]}相害({zhi[i]}{zhi[j]})")
            if po_map.get(zhi[i]) == zhi[j] or po_map.get(zhi[j]) == zhi[i]:
                po.append(f"{labels[i]}{labels[j]}相破({zhi[i]}{zhi[j]})")
            for (a, b) in _ZHI_HALF_3HE:
                if (zhi[i], zhi[j]) == (a, b) or (zhi[i], zhi[j]) == (b, a):
                    half_he.append(f"{labels[i]}{labels[j]}半三合({zhi[i]}{zhi[j]})")

    for combo, wuxing in _ZHI_3HE.items():
        if set(combo).issubset(zhi_set):
            san_he.append(f"{combo}三合({wuxing}局)")
    for combo, wuxing in _ZHI_3HUI.items():
        if set(combo).issubset(zhi_set):
            san_hui.append(f"{combo}三会({wuxing}局)")

    if set(["寅", "巳", "申"]).issubset(zhi_set):
        xing.append("寅巳申三刑(无恩之刑)")
    if set(["丑", "戌", "未"]).issubset(zhi_set):
        xing.append("丑戌未三刑(持势之刑)")
    if "子" in zhi_set and "卯" in zhi_set:
        xing.append("子卯相刑(无礼之刑)")
    for z in ["辰", "午", "酉", "亥"]:
        if zhi.count(z) >= 2:
            xing.append(f"{z}自刑")

    gan_rel = _calculate_gan_relations(pillars)

    # 双合：相邻两柱天干相合且地支亦合，传统上视为该两柱关系格外紧密。
    shuang_he: List[str] = []
    for i in range(3):
        tag = f"{labels[i]}{labels[i + 1]}"
        if any(h.startswith(f"{tag}干合") for h in gan_rel["干合"]) and any(
            h.startswith(f"{tag}六合") for h in he
        ):
            shuang_he.append(f"{tag}双合(天干地支皆合)")

    return {
        "冲": chong, "合": he, "刑": xing, "害": hai, "破": po, "穿": [],
        "三合": san_he, "三会": san_hui, "半三合": half_he,
        "干合": gan_rel["干合"], "干克": gan_rel["干克"], "双合": shuang_he,
    }


def calculate_professional_bazi(dt: datetime, gender_str: str) -> Dict[str, Any]:
    """
    严谨计算八字各项基础参数：原局、大运、十神、纳音、神煞等。

    相比最初版本，这里做了两点增强：
    1. 结构化返回值，类型标注更清晰，便于下游 Agent / Tools 使用；
    2. 预留专业扩展位（如刑冲合害、格局判定等），未来可以在不改 UI 的情况下继续演进。
    """
    solar = Solar.fromYmdHms(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)
    lunar = solar.getLunar()
    bazi = lunar.getEightChar()

    gender_val = 1 if gender_str == "乾造 (Male)" else 0

    # 基础四柱干支
    ygz = bazi.getYear()
    mgz = bazi.getMonth()
    dgz = bazi.getDay()
    tgz = bazi.getTime()

    # 十神（天干 + 地支）
    tg_gan: List[str] = [
        bazi.getYearShiShenGan(),
        bazi.getMonthShiShenGan(),
        "日主",
        bazi.getTimeShiShenGan(),
    ]
    tg_zhi: List[str] = [
        " ".join(bazi.getYearShiShenZhi()),
        " ".join(bazi.getMonthShiShenZhi()),
        " ".join(bazi.getDayShiShenZhi()),
        " ".join(bazi.getTimeShiShenZhi()),
    ]

    # 纳音
    nayin: List[str] = [
        bazi.getYearNaYin(),
        bazi.getMonthNaYin(),
        bazi.getDayNaYin(),
        bazi.getTimeNaYin(),
    ]

    # 吉神凶煞 (Shen Sha) - 基于四柱干支的命局神煞
    _shensha_dict = calculate_shensha([ygz, mgz, dgz, tgz])
    ss: List[str] = format_shensha_for_pillars(_shensha_dict)

    # 五行能量统计（基础版：按字面五行计数）
    all_wx = (
        bazi.getYearWuXing()
        + bazi.getMonthWuXing()
        + bazi.getDayWuXing()
        + bazi.getTimeWuXing()
    )
    wuxing = {
        "金(Metal)": all_wx.count("金"),
        "木(Wood)": all_wx.count("木"),
        "水(Water)": all_wx.count("水"),
        "火(Fire)": all_wx.count("火"),
        "土(Earth)": all_wx.count("土"),
    }

    # 大运推演
    user_yun = bazi.getYun(gender_val)
    da_yun: List[Dict[str, Any]] = []
    try:
        dy_arr = user_yun.getDaYun()
        for dy in dy_arr:
            if 0 < dy.getIndex() <= 10:  # 提取前 10 步大运
                da_yun.append(
                    {
                        "start_age": dy.getStartAge(),
                        "start_year": dy.getStartYear(),
                        "ganzhi": dy.getGanZhi(),
                    }
                )
    except Exception:
        da_yun = [
            {
                "start_age": 0,
                "start_year": dt.year,
                "ganzhi": "计算受限",
            }
        ]

    # 其他专业参数：命宫、胎元、胎息、身宫
    ming_gong = bazi.getMingGong()
    tai_yuan = bazi.getTaiYuan()
    tai_xi = bazi.getTaiXi()
    shen_gong = bazi.getShenGong()
    
    # 十二长生（地势）
    di_shi: List[str] = [
        bazi.getYearDiShi(),
        bazi.getMonthDiShi(),
        bazi.getDayDiShi(),
        bazi.getTimeDiShi(),
    ]
    
    # 旬空
    xun_kong: List[str] = [
        bazi.getYearXunKong(),
        bazi.getMonthXunKong(),
        bazi.getDayXunKong(),
        bazi.getTimeXunKong(),
    ]
    
    # 刑冲合害自动计算
    xing_chong = _calculate_xing_chong_he_hai([ygz, mgz, dgz, tgz])

    return {
        "gender": gender_str,
        "pillars": [ygz, mgz, dgz, tgz],
        "tg_gan": tg_gan,
        "tg_zhi": tg_zhi,
        "nayin": nayin,
        "shensha": ss,
        "shensha_detail": _shensha_dict,
        "wuxing": wuxing,
        "dayun": da_yun,
        "minggong": ming_gong,
        "taiyuan": tai_yuan,
        "taixi": tai_xi,
        "shengong": shen_gong,
        "dishi": di_shi,
        "xunkong": xun_kong,
        "xingchong": xing_chong,
        "wuxing_str": all_wx,
        "day_master": dgz[0],
    }


__all__ = ["calculate_professional_bazi"]

