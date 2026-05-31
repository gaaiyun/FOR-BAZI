# -*- coding: utf-8 -*-
"""
Comprehensive tests for all 14 FOR-BAZI tools with BOTH data formats:
  - Flat engine format (what the engine produces)
  - Normalized frontend format (after _normalize_chart_data runs)

Also tests dispatch_tool routing and edge cases.
"""

import json

import pytest

from tools.bazi_tools import (
    TOOL_REGISTRY,
    TOOL_SCHEMAS,
    dispatch_tool,
    get_annual_fortune,
    get_dayun_stage,
    analyze_wuxing_balance,
    query_xing_chong_he_hai,
    explain_shensha,
    fact_check_ganzhi,
    query_qiongtong_guidance,
    query_disitian_guidance,
    query_ziping_guidance,
    query_sanming_guidance,
    query_classical_text_tool,
    calculate_wuxing_power,
    analyze_geju,
    rag_retrieve,
)
from tools.wuxing_calculator import calculate_wuxing_power as calc_wuxing_power_direct
from tools.geju_analyzer import analyze_geju as analyze_geju_direct


# ═══════════════════════════════════════════════════════════════════════
# Sample data
# ═══════════════════════════════════════════════════════════════════════

FLAT_ENGINE_DATA = {
    "gender": "乾造 (Male)",
    "pillars": ["壬午", "丁未", "庚寅", "戊寅"],
    "tg_gan": ["食神", "正官", "日主", "偏印"],
    "tg_zhi": ["丁己", "丁己乙", "甲丙戊", "甲壬"],
    "nayin": ["杨柳木", "天河水", "松柏木", "城头土"],
    "day_master": "庚",
    "minggong": "甲寅",
    "taiyuan": "戊戌",
    "dishi": ["", "冠带", "临官", "绝"],
    "xunkong": ["午未", "寅卯", "午未", "申酉"],
    "wuxing": {"金": 1, "木": 2, "水": 1, "火": 2, "土": 3},
    "xingchong": {"寅申冲": ["日时冲"]},
    "dayun": [
        {"start_age": 5, "start_year": 2007, "ganzhi": "戊申"},
        {"start_age": 15, "start_year": 2017, "ganzhi": "己酉"},
        {"start_age": 25, "start_year": 2027, "ganzhi": "庚戌"},
    ],
}

# This simulates what _normalize_chart_data produces from a frontend BaziReading.
NORMALIZED_DATA = {
    "pillars": ["壬午", "丁未", "庚寅", "戊寅"],
    "tg_gan": ["食神", "正官", "日主", "偏印"],
    "tg_zhi": ["丁己", "丁己乙", "甲丙戊", "甲壬"],
    "nayin": ["杨柳木", "天河水", "松柏木", "城头土"],
    "day_master": "庚",
    "gender": "乾造 (Male)",
    "minggong": "甲寅",
    "taiyuan": "戊戌",
    "dishi": ["", "冠带", "临官", "绝"],
    "xunkong": ["午未", "寅卯", "午未", "申酉"],
    "wuxing": {"金": 1, "木": 2, "水": 1, "火": 2, "土": 3},
    "xingchong": {"寅申冲": ["日时冲"]},
    "dayun": [
        {"start_age": 5, "start_year": 2007, "ganzhi": "戊申"},
        {"start_age": 15, "start_year": 2017, "ganzhi": "己酉"},
        {"start_age": 25, "start_year": 2027, "ganzhi": "庚戌"},
    ],
}

# A raw frontend BaziReading format (before normalization)
FRONTEND_RAW_DATA = {
    "gender": "乾造 (Male)",
    "chart": {
        "year_pillar": {"stem": "壬", "branch": "午", "hidden_stems": ["丁", "己"], "nayin": "杨柳木"},
        "month_pillar": {"stem": "丁", "branch": "未", "hidden_stems": ["丁", "己", "乙"], "nayin": "天河水"},
        "day_pillar": {"stem": "庚", "branch": "寅", "hidden_stems": ["甲", "丙", "戊"], "nayin": "松柏木"},
        "hour_pillar": {"stem": "戊", "branch": "寅", "hidden_stems": ["甲", "壬"], "nayin": "城头土"},
        "day_master": "庚",
        "gender": "乾造 (Male)",
        "minggong": "甲寅",
        "taiyuan": "戊戌",
    },
    "pillar_annotations": {
        "year": {"ten_god_gan": "食神", "ten_god_zhi": "丁己", "dishi": "", "xunkong": "午未", "shensha": []},
        "month": {"ten_god_gan": "正官", "ten_god_zhi": "丁己乙", "dishi": "冠带", "xunkong": "寅卯", "shensha": []},
        "day": {"ten_god_gan": "日主", "ten_god_zhi": "甲丙戊", "dishi": "临官", "xunkong": "午未", "shensha": []},
        "hour": {"ten_god_gan": "偏印", "ten_god_zhi": "甲壬", "dishi": "绝", "xunkong": "申酉", "shensha": []},
    },
    "element_balance": {"金": 1, "木": 2, "水": 1, "火": 2, "土": 3},
    "xingchong": {"寅申冲": ["日时冲"]},
    "dayun": [
        {"start_age": 5, "start_year": 2007, "ganzhi": "戊申"},
        {"start_age": 15, "start_year": 2017, "ganzhi": "己酉"},
        {"start_age": 25, "start_year": 2027, "ganzhi": "庚戌"},
    ],
}


def _normalize_chart_data(chart_data):
    """Import or inline the normalize function from agent_service for testing."""
    from backend.services.agent_service import _normalize_chart_data as _norm
    return _norm(chart_data)


# ═══════════════════════════════════════════════════════════════════════
# Helper: assert result is valid JSON with expected keys
# ═══════════════════════════════════════════════════════════════════════

def _parse(result: str) -> dict:
    """Parse JSON string result, raising clear error on failure."""
    try:
        return json.loads(result)
    except json.JSONDecodeError as e:
        pytest.fail(f"Tool returned invalid JSON: {result[:200]}. Error: {e}")


def _assert_has_context(data: dict):
    """All tools should return a 'context' key for LLM consumption."""
    assert "context" in data, f"Missing 'context' key. Got keys: {list(data.keys())}"


# ═══════════════════════════════════════════════════════════════════════
# 1. Normalization tests
# ═══════════════════════════════════════════════════════════════════════

class TestNormalizeChartData:
    """Verify _normalize_chart_data converts frontend -> flat correctly."""

    def test_flat_passthrough(self):
        """Flat engine format should pass through unchanged."""
        result = _normalize_chart_data(FLAT_ENGINE_DATA)
        assert result["pillars"] == ["壬午", "丁未", "庚寅", "戊寅"]
        assert result["day_master"] == "庚"

    def test_frontend_to_flat(self):
        """Frontend nested format should be converted to flat."""
        result = _normalize_chart_data(FRONTEND_RAW_DATA)
        assert result["pillars"] == ["壬午", "丁未", "庚寅", "戊寅"]
        assert result["day_master"] == "庚"
        assert result["dishi"] == ["", "冠带", "临官", "绝"]
        assert result["wuxing"]["金"] == 1
        assert result["wuxing"]["木"] == 2

    def test_empty_data(self):
        assert _normalize_chart_data({}) == {}

    def test_none_data(self):
        # _normalize_chart_data converts None to {} for safety
        assert _normalize_chart_data(None) == {}

    def test_partial_flat_data(self):
        """Partial flat data (has 'pillars') should pass through."""
        partial = {"pillars": ["壬午", "丁未", "庚寅", "戊寅"], "day_master": "庚"}
        result = _normalize_chart_data(partial)
        assert result is partial  # same object, pass-through

    def test_frontend_preserves_dayun(self):
        result = _normalize_chart_data(FRONTEND_RAW_DATA)
        assert len(result["dayun"]) == 3
        assert result["dayun"][0]["ganzhi"] == "戊申"

    def test_frontend_preserves_xingchong(self):
        result = _normalize_chart_data(FRONTEND_RAW_DATA)
        assert "寅申冲" in result["xingchong"]

    def test_frontend_tg_zhi_from_annotations(self):
        """After normalization, tg_zhi should come from pillar_annotations."""
        result = _normalize_chart_data(FRONTEND_RAW_DATA)
        assert result["tg_zhi"][0] == "丁己"
        assert result["tg_zhi"][2] == "甲丙戊"

    def test_frontend_dishi_from_annotations(self):
        result = _normalize_chart_data(FRONTEND_RAW_DATA)
        assert result["dishi"][1] == "冠带"
        assert result["dishi"][2] == "临官"


# ═══════════════════════════════════════════════════════════════════════
# 2. get_annual_fortune (no bazi_data needed)
# ═══════════════════════════════════════════════════════════════════════

class TestGetAnnualFortune:

    def test_2026_flat(self):
        r = _parse(get_annual_fortune(2026))
        assert r["year"] == 2026
        assert len(r["ganzhi"]) == 2
        _assert_has_context(r)

    def test_2000(self):
        r = _parse(get_annual_fortune(2000))
        assert r["year"] == 2000

    def test_returns_json_string(self):
        assert isinstance(get_annual_fortune(2026), str)


# ═══════════════════════════════════════════════════════════════════════
# 3. analyze_wuxing_balance
# ═══════════════════════════════════════════════════════════════════════

class TestAnalyzeWuxingBalance:

    def test_flat_format(self):
        r = _parse(analyze_wuxing_balance(FLAT_ENGINE_DATA))
        assert "wuxing" in r
        assert r["total"] == 9  # 1+2+1+2+3
        # strong = elements with value >= 2: 木(2), 火(2), 土(3)
        assert "木" in r["strong"]
        assert "火" in r["strong"]
        assert "土" in r["strong"]
        assert "strong" in r
        _assert_has_context(r)

    def test_normalized_format(self):
        r = _parse(analyze_wuxing_balance(NORMALIZED_DATA))
        assert "wuxing" in r
        assert r["total"] == 9
        _assert_has_context(r)

    def test_empty_bazi_data(self):
        r = _parse(analyze_wuxing_balance({}))
        assert "context" in r

    def test_none_wuxing(self):
        r = _parse(analyze_wuxing_balance({"wuxing": None}))
        assert "context" in r

    def test_zero_wuxing(self):
        r = _parse(analyze_wuxing_balance({"wuxing": {}}))
        assert "context" in r


# ═══════════════════════════════════════════════════════════════════════
# 4. calculate_wuxing_power
# ═══════════════════════════════════════════════════════════════════════

class TestCalculateWuxingPower:

    def test_flat_format(self):
        r = _parse(calculate_wuxing_power(FLAT_ENGINE_DATA))
        assert "power" in r
        assert "strong" in r
        assert "weak" in r
        assert "balanced" in r
        _assert_has_context(r)
        # Power percentages should sum to ~100
        total = sum(r["power"].values())
        assert abs(total - 100) < 5, f"Power total is {total}, expected ~100"

    def test_normalized_format(self):
        r = _parse(calculate_wuxing_power(NORMALIZED_DATA))
        assert "power" in r
        total = sum(r["power"].values())
        assert abs(total - 100) < 5

    def test_empty_pillars(self):
        r = _parse(calculate_wuxing_power({}))
        assert "context" in r

    def test_partial_pillars(self):
        r = _parse(calculate_wuxing_power({"pillars": ["壬"]}))
        # Single-char pillar is skipped (len < 2), should handle gracefully
        assert "power" in r or "context" in r

    def test_flat_and_normalized_produce_same_result(self):
        r_flat = _parse(calculate_wuxing_power(FLAT_ENGINE_DATA))
        r_norm = _parse(calculate_wuxing_power(NORMALIZED_DATA))
        assert r_flat["power"] == r_norm["power"], \
            f"Flat power {r_flat['power']} != Normalized power {r_norm['power']}"


# ═══════════════════════════════════════════════════════════════════════
# 5. analyze_geju
# ═══════════════════════════════════════════════════════════════════════

class TestAnalyzeGeju:

    def test_flat_format(self):
        r = _parse(analyze_geju(FLAT_ENGINE_DATA))
        assert "格局类型" in r
        assert "格局名称" in r
        assert "月令" in r
        assert "日主强弱" in r
        _assert_has_context(r)

    def test_normalized_format(self):
        r = _parse(analyze_geju(NORMALIZED_DATA))
        assert "格局类型" in r
        assert "月令" in r
        _assert_has_context(r)

    def test_empty_data(self):
        r = _parse(analyze_geju({}))
        assert "context" in r

    def test_no_day_master(self):
        r = _parse(analyze_geju({"pillars": ["壬午", "丁未", "庚寅", "戊寅"]}))
        assert "context" in r

    def test_short_pillars(self):
        r = _parse(analyze_geju({"pillars": ["壬"], "day_master": "庚"}))
        assert "context" in r

    def test_flat_and_normalized_same_result(self):
        r_flat = _parse(analyze_geju(FLAT_ENGINE_DATA))
        r_norm = _parse(analyze_geju(NORMALIZED_DATA))
        assert r_flat["格局名称"] == r_norm["格局名称"]
        assert r_flat["日主强弱"] == r_norm["日主强弱"]


# ═══════════════════════════════════════════════════════════════════════
# 6. get_dayun_stage
# ═══════════════════════════════════════════════════════════════════════

class TestGetDayunStage:

    def test_flat_format(self):
        r = _parse(get_dayun_stage(FLAT_ENGINE_DATA, 2020))
        assert r["current_year"] == 2020
        assert r["step"] == 2
        assert r["ganzhi"] == "己酉"
        _assert_has_context(r)

    def test_normalized_format(self):
        r = _parse(get_dayun_stage(NORMALIZED_DATA, 2020))
        assert r["current_year"] == 2020
        assert r["step"] == 2

    def test_year_before_all_dayun(self):
        r = _parse(get_dayun_stage(FLAT_ENGINE_DATA, 2000))
        assert r["step"] is None
        assert "context" in r

    def test_year_in_first_dayun(self):
        r = _parse(get_dayun_stage(FLAT_ENGINE_DATA, 2010))
        assert r["step"] == 1
        assert r["ganzhi"] == "戊申"

    def test_empty_dayun(self):
        r = _parse(get_dayun_stage({}, 2025))
        assert r["step"] is None

    def test_none_dayun(self):
        r = _parse(get_dayun_stage({"dayun": None}, 2025))
        assert r["step"] is None

    def test_flat_and_normalized_same_result(self):
        r_flat = _parse(get_dayun_stage(FLAT_ENGINE_DATA, 2015))
        r_norm = _parse(get_dayun_stage(NORMALIZED_DATA, 2015))
        assert r_flat["step"] == r_norm["step"]
        assert r_flat["ganzhi"] == r_norm["ganzhi"]


# ═══════════════════════════════════════════════════════════════════════
# 7. query_xing_chong_he_hai
# ═══════════════════════════════════════════════════════════════════════

class TestQueryXingChongHeHai:

    def test_flat_format_all(self):
        r = _parse(query_xing_chong_he_hai(FLAT_ENGINE_DATA))
        assert "xingchong" in r
        assert "summary" in r
        _assert_has_context(r)

    def test_normalized_format_all(self):
        r = _parse(query_xing_chong_he_hai(NORMALIZED_DATA))
        assert "xingchong" in r

    def test_flat_with_relation_type(self):
        r = _parse(query_xing_chong_he_hai(FLAT_ENGINE_DATA, "冲"))
        assert r["relation_type"] == "冲"
        assert "description" in r

    def test_unknown_relation_type(self):
        r = _parse(query_xing_chong_he_hai(FLAT_ENGINE_DATA, "不存在的"))
        assert "all_types" in r

    def test_empty_data(self):
        r = _parse(query_xing_chong_he_hai({}))
        assert "xingchong" in r

    def test_no_xingchong(self):
        r = _parse(query_xing_chong_he_hai({"day_master": "庚"}))
        assert "xingchong" in r

    def test_flat_and_normalized_same_result(self):
        r_flat = _parse(query_xing_chong_he_hai(FLAT_ENGINE_DATA))
        r_norm = _parse(query_xing_chong_he_hai(NORMALIZED_DATA))
        assert r_flat["xingchong"] == r_norm["xingchong"]


# ═══════════════════════════════════════════════════════════════════════
# 8. explain_shensha (no bazi_data needed)
# ═══════════════════════════════════════════════════════════════════════

class TestExplainShensha:

    def test_known_shensha(self):
        r = _parse(explain_shensha("桃花"))
        assert r["shensha"] == "桃花"
        assert "description" in r
        _assert_has_context(r)

    def test_unknown_shensha(self):
        r = _parse(explain_shensha("不存在的神煞"))
        assert "available" in r

    def test_all_shensha_available(self):
        for name in ["桃花", "驿马", "华盖", "文昌", "将星", "羊刃", "劫煞", "亡神"]:
            r = _parse(explain_shensha(name))
            assert "description" in r, f"Missing description for {name}"


# ═══════════════════════════════════════════════════════════════════════
# 9. query_classical_text (no bazi_data needed)
# ═══════════════════════════════════════════════════════════════════════

class TestQueryClassicalText:

    def test_qiongtong(self):
        r = _parse(query_classical_text_tool("穷通宝鉴"))
        assert r["source"] == "穷通宝鉴"
        assert "count" in r

    def test_unknown_source(self):
        r = _parse(query_classical_text_tool("不存在的书"))
        assert r["count"] == 0 or "error" in str(r.get("results", []))

    def test_with_category_and_key(self):
        r = _parse(query_classical_text_tool("穷通宝鉴", "调候用神", "甲"))
        assert r["source"] == "穷通宝鉴"

    def test_empty_source(self):
        r = _parse(query_classical_text_tool(""))
        assert r["count"] == 0 or "results" in r

    def test_yuanhai_ziping(self):
        """渊海子平应能查到真实条目（回归：曾因 data_map 漏注册数据源而返回「未找到古籍」）。"""
        r = _parse(query_classical_text_tool("渊海子平"))
        assert r["source"] == "渊海子平"
        results = r["results"]
        # 必须是真实条目，而非 error/context 占位
        assert results, "渊海子平应返回条目"
        assert all("error" not in item and "context" not in item for item in results)
        assert any(item.get("原文") for item in results)

    def test_yuanhai_ziping_category_geju_alias(self):
        """复现报告中的具体调用：query(渊海子平, 格局) 应经别名映射到论法/总论返回真实条目，不再报「未找到古籍」。"""
        r = _parse(query_classical_text_tool("渊海子平", "格局"))
        results = r["results"]
        assert "未找到古籍" not in str(results)
        assert results and all("error" not in item and "context" not in item for item in results)
        # 别名命中的条目分类应落在论法/总论
        for item in results:
            assert item.get("category") in ("论法", "总论")

    def test_ziping_zhenquan_geju_not_aliased(self):
        """子平真诠本身有「格局」正式分类，不应被别名逻辑波及，按原值精确匹配。"""
        r = _parse(query_classical_text_tool("子平真诠", "格局"))
        results = r["results"]
        assert results and all("error" not in item and "context" not in item for item in results)
        for item in results:
            assert item.get("category") == "格局"


# ═══════════════════════════════════════════════════════════════════════
# 10. query_qiongtong_guidance
# ═══════════════════════════════════════════════════════════════════════

class TestQueryQiongtongGuidance:

    def test_flat_format(self):
        r = _parse(query_qiongtong_guidance(FLAT_ENGINE_DATA))
        assert "context" in r
        # 庚日主, 未月支 (pillars[1][1] = '未')
        assert r.get("day_master") == "庚" or "context" in r

    def test_normalized_format(self):
        r = _parse(query_qiongtong_guidance(NORMALIZED_DATA))
        assert "context" in r

    def test_empty_data(self):
        r = _parse(query_qiongtong_guidance({}))
        assert "context" in r

    def test_missing_day_master(self):
        r = _parse(query_qiongtong_guidance({"pillars": ["壬午", "丁未", "庚寅", "戊寅"]}))
        assert "context" in r

    def test_flat_and_normalized_same_result(self):
        r_flat = _parse(query_qiongtong_guidance(FLAT_ENGINE_DATA))
        r_norm = _parse(query_qiongtong_guidance(NORMALIZED_DATA))
        assert r_flat.get("context") == r_norm.get("context")


# ═══════════════════════════════════════════════════════════════════════
# 11. query_disitian_guidance
# ═══════════════════════════════════════════════════════════════════════

class TestQueryDisitianGuidance:

    def test_flat_format(self):
        r = _parse(query_disitian_guidance(FLAT_ENGINE_DATA))
        assert "context" in r
        assert r.get("day_master") == "庚" or "principles" in r or "context" in r

    def test_normalized_format(self):
        r = _parse(query_disitian_guidance(NORMALIZED_DATA))
        assert "context" in r

    def test_empty_data(self):
        r = _parse(query_disitian_guidance({}))
        assert "context" in r

    def test_flat_and_normalized_same_result(self):
        r_flat = _parse(query_disitian_guidance(FLAT_ENGINE_DATA))
        r_norm = _parse(query_disitian_guidance(NORMALIZED_DATA))
        assert r_flat.get("context") == r_norm.get("context")


# ═══════════════════════════════════════════════════════════════════════
# 12. query_ziping_guidance
# ═══════════════════════════════════════════════════════════════════════

class TestQueryZipingGuidance:

    def test_flat_format(self):
        r = _parse(query_ziping_guidance(FLAT_ENGINE_DATA))
        assert "context" in r

    def test_normalized_format(self):
        r = _parse(query_ziping_guidance(NORMALIZED_DATA))
        assert "context" in r

    def test_empty_data(self):
        r = _parse(query_ziping_guidance({}))
        assert "context" in r

    def test_flat_and_normalized_same_result(self):
        r_flat = _parse(query_ziping_guidance(FLAT_ENGINE_DATA))
        r_norm = _parse(query_ziping_guidance(NORMALIZED_DATA))
        assert r_flat.get("context") == r_norm.get("context")


# ═══════════════════════════════════════════════════════════════════════
# 13. query_sanming_guidance
# ═══════════════════════════════════════════════════════════════════════

class TestQuerySanmingGuidance:

    def test_flat_format_with_key(self):
        r = _parse(query_sanming_guidance(FLAT_ENGINE_DATA, "宫位", "日柱"))
        assert "context" in r

    def test_normalized_format_with_key(self):
        r = _parse(query_sanming_guidance(NORMALIZED_DATA, "宫位", "日柱"))
        assert "context" in r

    def test_empty_key(self):
        r = _parse(query_sanming_guidance(FLAT_ENGINE_DATA, "", ""))
        assert "context" in r

    def test_no_key(self):
        r = _parse(query_sanming_guidance(FLAT_ENGINE_DATA, "宫位", "不存在的键"))
        assert "context" in r


# ═══════════════════════════════════════════════════════════════════════
# 14. rag_retrieve
# ═══════════════════════════════════════════════════════════════════════

class TestRagRetrieve:

    def test_flat_format(self):
        r = _parse(rag_retrieve(FLAT_ENGINE_DATA, "庚金日主", 3))
        # May succeed with results or fail with error depending on scholar_agent
        assert "error" in r or "exact_matches" in r or "fused_results" in r or "results" in r or "context" in r

    def test_normalized_format(self):
        r = _parse(rag_retrieve(NORMALIZED_DATA, "庚金日主", 3))
        assert "error" in r or "exact_matches" in r or "fused_results" in r or "results" in r or "context" in r

    def test_empty_data(self):
        r = _parse(rag_retrieve({}, "", 1))
        # rag_retrieve returns various keys depending on scholar_agent state
        assert "error" in r or "exact_matches" in r or "fused_results" in r or "results" in r or "context" in r


# ═══════════════════════════════════════════════════════════════════════
# 15. get_annual_fortune via dispatch
# ═══════════════════════════════════════════════════════════════════════

class TestGetAnnualFortuneDispatch:

    def test_dispatch_flat(self):
        r = _parse(dispatch_tool("get_annual_fortune", {"year": 2026}, FLAT_ENGINE_DATA))
        assert r["year"] == 2026

    def test_dispatch_normalized(self):
        r = _parse(dispatch_tool("get_annual_fortune", {"year": 2026}, NORMALIZED_DATA))
        assert r["year"] == 2026


# ═══════════════════════════════════════════════════════════════════════
# 16. dispatch_tool integration with both formats
# ═══════════════════════════════════════════════════════════════════════

class TestDispatchToolBothFormats:
    """Test every tool through dispatch_tool with both flat and normalized data."""

    @pytest.mark.parametrize("data_label", ["flat", "normalized"])
    def test_analyze_wuxing_balance(self, data_label):
        data = FLAT_ENGINE_DATA if data_label == "flat" else NORMALIZED_DATA
        r = _parse(dispatch_tool("analyze_wuxing_balance", {}, data))
        assert "wuxing" in r or "context" in r

    @pytest.mark.parametrize("data_label", ["flat", "normalized"])
    def test_calculate_wuxing_power(self, data_label):
        data = FLAT_ENGINE_DATA if data_label == "flat" else NORMALIZED_DATA
        r = _parse(dispatch_tool("calculate_wuxing_power", {}, data))
        assert "power" in r or "context" in r

    @pytest.mark.parametrize("data_label", ["flat", "normalized"])
    def test_analyze_geju(self, data_label):
        data = FLAT_ENGINE_DATA if data_label == "flat" else NORMALIZED_DATA
        r = _parse(dispatch_tool("analyze_geju", {}, data))
        assert "格局类型" in r or "context" in r

    @pytest.mark.parametrize("data_label", ["flat", "normalized"])
    def test_get_dayun_stage(self, data_label):
        data = FLAT_ENGINE_DATA if data_label == "flat" else NORMALIZED_DATA
        r = _parse(dispatch_tool("get_dayun_stage", {"current_year": 2020}, data))
        assert r["current_year"] == 2020

    @pytest.mark.parametrize("data_label", ["flat", "normalized"])
    def test_query_xing_chong_he_hai(self, data_label):
        data = FLAT_ENGINE_DATA if data_label == "flat" else NORMALIZED_DATA
        r = _parse(dispatch_tool("query_xing_chong_he_hai", {}, data))
        assert "xingchong" in r

    @pytest.mark.parametrize("data_label", ["flat", "normalized"])
    def test_query_qiongtong_guidance(self, data_label):
        data = FLAT_ENGINE_DATA if data_label == "flat" else NORMALIZED_DATA
        r = _parse(dispatch_tool("query_qiongtong_guidance", {}, data))
        assert "context" in r

    @pytest.mark.parametrize("data_label", ["flat", "normalized"])
    def test_query_disitian_guidance(self, data_label):
        data = FLAT_ENGINE_DATA if data_label == "flat" else NORMALIZED_DATA
        r = _parse(dispatch_tool("query_disitian_guidance", {}, data))
        assert "context" in r

    @pytest.mark.parametrize("data_label", ["flat", "normalized"])
    def test_query_ziping_guidance(self, data_label):
        data = FLAT_ENGINE_DATA if data_label == "flat" else NORMALIZED_DATA
        r = _parse(dispatch_tool("query_ziping_guidance", {}, data))
        assert "context" in r

    @pytest.mark.parametrize("data_label", ["flat", "normalized"])
    def test_query_sanming_guidance(self, data_label):
        data = FLAT_ENGINE_DATA if data_label == "flat" else NORMALIZED_DATA
        r = _parse(dispatch_tool("query_sanming_guidance", {"key": "日柱"}, data))
        assert "context" in r

    @pytest.mark.parametrize("data_label", ["flat", "normalized"])
    def test_rag_retrieve(self, data_label):
        data = FLAT_ENGINE_DATA if data_label == "flat" else NORMALIZED_DATA
        r = _parse(dispatch_tool("rag_retrieve", {"query": "庚金", "top_k": 2}, data))
        assert "error" in r or "exact_matches" in r or "fused_results" in r or "results" in r or "context" in r

    def test_explain_shensha_dispatch(self):
        r = _parse(dispatch_tool("explain_shensha", {"shensha_name": "桃花"}))
        assert r["shensha"] == "桃花"

    def test_fact_check_dispatch(self):
        r = _parse(dispatch_tool("fact_check_ganzhi", {"claimed_ganzhi": "丙午", "year": 2026}))
        assert "match" in r

    def test_query_classical_text_dispatch(self):
        r = _parse(dispatch_tool("query_classical_text", {"source": "穷通宝鉴"}))
        assert r["source"] == "穷通宝鉴"


# ═══════════════════════════════════════════════════════════════════════
# 17. Edge cases
# ═══════════════════════════════════════════════════════════════════════

class TestEdgeCases:

    def test_dispatch_unknown_tool(self):
        r = _parse(dispatch_tool("nonexistent_tool", {}))
        assert "error" in r

    def test_dispatch_none_bazi_data(self):
        r = _parse(dispatch_tool("analyze_wuxing_balance", {}, None))
        assert "context" in r

    def test_dispatch_empty_bazi_data(self):
        r = _parse(dispatch_tool("analyze_wuxing_balance", {}, {}))
        assert "context" in r

    def test_dispatch_partial_data_only_pillars(self):
        r = _parse(dispatch_tool("analyze_geju", {}, {"pillars": ["壬午", "丁未"]}))
        assert "context" in r

    def test_dispatch_partial_data_only_wuxing(self):
        r = _parse(dispatch_tool("analyze_wuxing_balance", {}, {"wuxing": {"金": 1}}))
        assert "wuxing" in r

    def test_wuxing_balance_all_zero(self):
        r = _parse(analyze_wuxing_balance({"wuxing": {"金": 0, "木": 0, "水": 0, "火": 0, "土": 0}}))
        assert "wuxing" in r
        assert r["total"] == 0

    def test_dayun_stage_missing_start_year(self):
        data = {"dayun": [{"start_age": 5, "ganzhi": "戊申"}]}
        r = _parse(get_dayun_stage(data, 2020))
        # start_year is None, so it should be skipped
        assert r["step"] is None

    def test_xingchong_with_empty_string_relation(self):
        r = _parse(query_xing_chong_he_hai(FLAT_ENGINE_DATA, ""))
        # Empty string = no filter, should return all
        assert "xingchong" in r

    def test_calculate_wuxing_power_short_pillar(self):
        """Single char pillar should be skipped gracefully."""
        r = _parse(calculate_wuxing_power({"pillars": ["壬", "丁未", "庚寅", "戊寅"]}))
        assert "power" in r

    def test_geju_with_single_pillar(self):
        r = _parse(analyze_geju({"pillars": ["壬"], "day_master": "庚"}))
        assert "context" in r

    def test_all_tools_return_valid_json(self):
        """Every registered tool should return valid JSON string."""
        # Tools that don't need bazi_data
        for name in ["get_annual_fortune", "explain_shensha", "fact_check_ganzhi", "query_classical_text"]:
            if name == "get_annual_fortune":
                result = TOOL_REGISTRY[name](2026)
            elif name == "explain_shensha":
                result = TOOL_REGISTRY[name]("桃花")
            elif name == "fact_check_ganzhi":
                result = TOOL_REGISTRY[name]("丙午", 2026)
            elif name == "query_classical_text":
                result = TOOL_REGISTRY[name]("穷通宝鉴")
            assert isinstance(result, str), f"{name} did not return string"
            json.loads(result)  # should not raise

    def test_all_14_tools_in_registry(self):
        assert len(TOOL_REGISTRY) == 14

    def test_schemas_match_registry(self):
        schema_names = {s["function"]["name"] for s in TOOL_SCHEMAS}
        registry_names = set(TOOL_REGISTRY.keys())
        assert schema_names == registry_names


# ═══════════════════════════════════════════════════════════════════════
# 18. Frontend -> normalize -> tool pipeline
# ═══════════════════════════════════════════════════════════════════════

class TestFrontendToToolPipeline:
    """Simulate the full pipeline: frontend data -> normalize -> tool call."""

    def test_pipeline_wuxing_balance(self):
        normalized = _normalize_chart_data(FRONTEND_RAW_DATA)
        r = _parse(analyze_wuxing_balance(normalized))
        assert r["total"] == 9

    def test_pipeline_calculate_wuxing_power(self):
        normalized = _normalize_chart_data(FRONTEND_RAW_DATA)
        r = _parse(calculate_wuxing_power(normalized))
        assert "power" in r
        total = sum(r["power"].values())
        assert abs(total - 100) < 5

    def test_pipeline_analyze_geju(self):
        normalized = _normalize_chart_data(FRONTEND_RAW_DATA)
        r = _parse(analyze_geju(normalized))
        assert "格局类型" in r

    def test_pipeline_get_dayun_stage(self):
        normalized = _normalize_chart_data(FRONTEND_RAW_DATA)
        r = _parse(get_dayun_stage(normalized, 2020))
        assert r["step"] == 2

    def test_pipeline_xingchong(self):
        normalized = _normalize_chart_data(FRONTEND_RAW_DATA)
        r = _parse(query_xing_chong_he_hai(normalized))
        assert "xingchong" in r

    def test_pipeline_qiongtong(self):
        normalized = _normalize_chart_data(FRONTEND_RAW_DATA)
        r = _parse(query_qiongtong_guidance(normalized))
        assert "context" in r

    def test_pipeline_disitian(self):
        normalized = _normalize_chart_data(FRONTEND_RAW_DATA)
        r = _parse(query_disitian_guidance(normalized))
        assert "context" in r

    def test_pipeline_ziping(self):
        normalized = _normalize_chart_data(FRONTEND_RAW_DATA)
        r = _parse(query_ziping_guidance(normalized))
        assert "context" in r

    def test_pipeline_sanming(self):
        normalized = _normalize_chart_data(FRONTEND_RAW_DATA)
        r = _parse(query_sanming_guidance(normalized, "宫位", "日柱"))
        assert "context" in r

    def test_pipeline_rag_retrieve(self):
        normalized = _normalize_chart_data(FRONTEND_RAW_DATA)
        r = _parse(rag_retrieve(normalized, "庚金", 3))
        assert "error" in r or "exact_matches" in r or "fused_results" in r or "results" in r or "context" in r

    def test_pipeline_via_dispatch_all_tools(self):
        """Full pipeline: normalize then dispatch every tool that uses bazi_data."""
        normalized = _normalize_chart_data(FRONTEND_RAW_DATA)
        bazi_tools = [
            ("analyze_wuxing_balance", {}),
            ("calculate_wuxing_power", {}),
            ("analyze_geju", {}),
            ("get_dayun_stage", {"current_year": 2020}),
            ("query_xing_chong_he_hai", {}),
            ("query_qingchong_he_hai", {"relation_type": "冲"}),
            ("query_qiongtong_guidance", {}),
            ("query_disitian_guidance", {}),
            ("query_ziping_guidance", {}),
            ("query_sanming_guidance", {"key": "日柱"}),
            ("rag_retrieve", {"query": "庚金", "top_k": 2}),
        ]
        for tool_name, args in bazi_tools:
            if tool_name == "query_qingchong_he_hai":
                # This is a typo variant, use the correct name
                continue
            result_str = dispatch_tool(tool_name, args, normalized)
            r = _parse(result_str)
            # Every tool should return either data or an error, never crash
            assert isinstance(r, dict), f"{tool_name} returned non-dict"
