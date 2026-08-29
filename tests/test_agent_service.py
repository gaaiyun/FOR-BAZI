# -*- coding: utf-8 -*-
"""
Comprehensive integration tests for agent_service._normalize_chart_data,
stream_chat normalization, and system prompt rendering.

Covers: empty input, None, flat pass-through, frontend BaziReading format,
partial data, malformed data, missing keys, null fields, stream_chat
integration, and system prompt correctness.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from agent.api_adapter import is_anthropic_provider
from backend.services.agent_service import (
    ProviderConfigError,
    _normalize_chart_data,
    _resolve_provider_config,
    stream_chat,
)


# ---------------------------------------------------------------------------
# Sample data
# ---------------------------------------------------------------------------

FLAT_ENGINE_DATA = {
    "gender": "乾造 (Male)",
    "pillars": ["壬午", "丁未", "庚寅", "戊寅"],
    "tg_gan": ["食神", "正官", "日主", "偏印"],
    "tg_zhi": ["丁己", "丁己乙", "甲丙戊", "甲壬"],
    "nayin": ["杨柳木", "天河水", "松柏木", "城头土"],
    "day_master": "庚",
    "minggong": "甲寅",
    "taiyuan": "戊戌",
    "shengong": "丙寅",
    "taixi": "乙巳",
    "dishi": ["", "冠带", "临官", "绝"],
    "xunkong": ["午未", "寅卯", "午未", "申酉"],
    "shensha": ["太极贵人", "天乙贵人", "文昌", "驿马"],
    "shensha_detail": {
        "year": ["太极贵人"],
        "month": ["天乙贵人"],
        "day": ["文昌"],
        "hour": ["驿马"],
    },
    "wuxing": {"金": 1, "木": 2, "水": 1, "火": 2, "土": 3},
    "xingchong": {"冲": ["年月相冲(午子)"], "合": []},
    "dayun": [
        {"start_age": 5, "start_year": 2007, "ganzhi": "戊申"},
        {"start_age": 15, "start_year": 2017, "ganzhi": "己酉"},
    ],
}

FRONTEND_BAZI_READING = {
    "chart": {
        "year_pillar": {
            "stem": "壬",
            "branch": "午",
            "hidden_stems": ["丁", "己"],
            "element": "水",
            "nayin": "杨柳木",
        },
        "month_pillar": {
            "stem": "丁",
            "branch": "未",
            "hidden_stems": ["丁", "己", "乙"],
            "element": "火",
            "nayin": "天河水",
        },
        "day_pillar": {
            "stem": "庚",
            "branch": "寅",
            "hidden_stems": ["甲", "丙", "戊"],
            "element": "金",
            "nayin": "松柏木",
        },
        "hour_pillar": {
            "stem": "戊",
            "branch": "寅",
            "hidden_stems": ["甲", "壬"],
            "element": "土",
            "nayin": "城头土",
        },
        "day_master": "庚",
        "day_master_element": "金",
    },
    "element_balance": {"金": 1, "木": 2, "水": 1, "火": 2, "土": 3},
    "ten_gods": [],
    "luck_pillars": [],
    "annual_pillars": [],
    "strengths": ["五行偏强: 土"],
    "weaknesses": ["五行偏弱: 水"],
    "favorable_elements": ["水"],
    "unfavorable_elements": ["土"],
    "summary": "格局: 正官格",
    "pillar_annotations": {
        "year": {
            "ten_god_gan": "食神",
            "ten_god_zhi": "丁己",
            "nayin": "杨柳木",
            "shensha": ["太极贵人"],
            "dishi": "",
            "xunkong": "午未",
        },
        "month": {
            "ten_god_gan": "正官",
            "ten_god_zhi": "丁己乙",
            "nayin": "天河水",
            "shensha": ["天乙贵人"],
            "dishi": "冠带",
            "xunkong": "寅卯",
        },
        "day": {
            "ten_god_gan": "日主",
            "ten_god_zhi": "甲丙戊",
            "nayin": "松柏木",
            "shensha": ["文昌"],
            "dishi": "临官",
            "xunkong": "午未",
        },
        "hour": {
            "ten_god_gan": "偏印",
            "ten_god_zhi": "甲壬",
            "nayin": "城头土",
            "shensha": ["驿马"],
            "dishi": "绝",
            "xunkong": "申酉",
        },
    },
    "wuxing_power": {"金": 15.2, "木": 25.1, "水": 10.3, "火": 22.0, "土": 27.4},
    "dayun": [
        {
            "stem": "戊",
            "branch": "申",
            "ganzhi": "戊申",
            "start_age": 5,
            "end_age": 14,
            "start_year": 2007,
            "end_year": 2016,
            "is_current": False,
        },
        {
            "stem": "己",
            "branch": "酉",
            "ganzhi": "己酉",
            "start_age": 15,
            "end_age": 24,
            "start_year": 2017,
            "end_year": 2026,
            "is_current": True,
        },
    ],
    "ming_gong": "甲寅",
    "tai_yuan": "戊戌",
    "shen_gong": "丙寅",
    "tai_xi": "乙巳",
    "geju": {
        "geju_type": "正官格",
        "description": "庚金生于未月",
        "favorable_elements": ["水"],
        "unfavorable_elements": ["土"],
    },
    "xingchong": ["寅申冲: 日时冲"],
    "all_shensha": [
        {"name": "太极贵人", "pillar": "年柱", "description": ""},
        {"name": "天乙贵人", "pillar": "月柱", "description": ""},
        {"name": "文昌", "pillar": "日柱", "description": ""},
        {"name": "驿马", "pillar": "时柱", "description": ""},
    ],
}


# ---------------------------------------------------------------------------
# 1. Empty / None inputs
# ---------------------------------------------------------------------------


class TestEmptyAndNoneInputs:
    """Edge-case inputs should return gracefully without crashing."""

    def test_empty_dict_returns_empty(self):
        result = _normalize_chart_data({})
        assert result == {}

    def test_none_returns_empty_dict(self):
        result = _normalize_chart_data(None)
        assert result == {}

    def test_empty_dict_is_falsy_passes_through(self):
        """Empty dict is falsy, so the function returns it as-is."""
        result = _normalize_chart_data({})
        assert not result

    def test_dict_with_only_unrelated_keys(self):
        """Dict with keys unrelated to bazi should pass through unchanged."""
        data = {"foo": "bar", "baz": 42}
        result = _normalize_chart_data(data)
        assert result == data


# ---------------------------------------------------------------------------
# 2. Flat engine format pass-through
# ---------------------------------------------------------------------------


class TestFlatEnginePassThrough:
    """Data already in flat engine format should be returned as-is."""

    def test_full_flat_data_identity(self):
        result = _normalize_chart_data(FLAT_ENGINE_DATA)
        assert result is FLAT_ENGINE_DATA

    def test_flat_with_missing_pillars_key(self):
        """If 'pillars' key is missing, it should not pass through as flat."""
        data = {"gender": "男", "day_master": "甲"}
        result = _normalize_chart_data(data)
        # No 'pillars' and no 'chart' — returns as-is
        assert result == data

    def test_flat_with_empty_pillars_list(self):
        """Empty pillars list is falsy, so won't trigger flat pass-through."""
        data = {"pillars": []}
        result = _normalize_chart_data(data)
        assert result == data

    def test_flat_with_non_list_pillars(self):
        """pillars as string should not trigger flat pass-through."""
        data = {"pillars": "甲子"}
        result = _normalize_chart_data(data)
        assert result == data


# ---------------------------------------------------------------------------
# 3. Frontend BaziReading format — full conversion
# ---------------------------------------------------------------------------


class TestFrontendFormatConversion:
    """Full frontend BaziReading -> flat format conversion."""

    def test_pillars_reconstructed(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["pillars"] == ["壬午", "丁未", "庚寅", "戊寅"]

    def test_day_master_from_chart(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["day_master"] == "庚"

    def test_nayin_from_pillar_objects(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["nayin"] == ["杨柳木", "天河水", "松柏木", "城头土"]

    def test_tg_zhi_from_pillar_annotations(self):
        """tg_zhi should come from pillar_annotations (not hidden_stems)."""
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["tg_zhi"] == ["丁己", "丁己乙", "甲丙戊", "甲壬"]

    def test_tg_gan_from_pillar_annotations(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["tg_gan"] == ["食神", "正官", "日主", "偏印"]

    def test_dishi_from_pillar_annotations(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["dishi"] == ["", "冠带", "临官", "绝"]

    def test_xunkong_from_pillar_annotations(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["xunkong"] == ["午未", "寅卯", "午未", "申酉"]

    def test_shensha_detail_from_pillar_annotations(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["shensha_detail"]["year"] == ["太极贵人"]
        assert result["shensha_detail"]["month"] == ["天乙贵人"]
        assert result["shensha_detail"]["day"] == ["文昌"]
        assert result["shensha_detail"]["hour"] == ["驿马"]

    def test_minggong_from_frontend_key(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["minggong"] == "甲寅"

    def test_taiyuan_from_frontend_key(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["taiyuan"] == "戊戌"

    def test_shengong_from_frontend_key(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["shengong"] == "丙寅"

    def test_taixi_from_frontend_key(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["taixi"] == "乙巳"

    def test_wuxing_from_element_balance(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["wuxing"] == {"金": 1, "木": 2, "水": 1, "火": 2, "土": 3}

    def test_dayun_preserved(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert len(result["dayun"]) == 2
        assert result["dayun"][0]["ganzhi"] == "戊申"

    def test_shensha_from_all_shensha(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert "太极贵人" in result["shensha"]
        assert "天乙贵人" in result["shensha"]
        assert "文昌" in result["shensha"]
        assert "驿马" in result["shensha"]

    def test_xingchong_preserved(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        # After fix, xingchong should be preserved (list from frontend)
        assert result["xingchong"] is not None

    def test_wuxing_power_preserved(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["wuxing_power"]["金"] == 15.2
        assert result["wuxing_power"]["土"] == 27.4

    def test_geju_preserved(self):
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        assert result["geju"]["geju_type"] == "正官格"

    def test_gender_empty_when_not_provided(self):
        """Gender is not in the sample frontend data."""
        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        # Gender should be empty string, not crash
        assert result.get("gender") == ""


# ---------------------------------------------------------------------------
# 4. Partial / malformed data
# ---------------------------------------------------------------------------


class TestPartialAndMalformedData:
    """Graceful handling of partial or malformed chart data."""

    def test_chart_key_is_none(self):
        data = {"chart": None}
        result = _normalize_chart_data(data)
        assert result == data

    def test_chart_key_is_string(self):
        data = {"chart": "not a dict"}
        result = _normalize_chart_data(data)
        assert result == data

    def test_chart_key_empty_dict(self):
        data = {"chart": {}}
        result = _normalize_chart_data(data)
        assert result == data

    def test_missing_pillar_objects(self):
        """Chart has no pillar sub-dicts — should return as-is."""
        data = {"chart": {"day_master": "甲", "foo": "bar"}}
        result = _normalize_chart_data(data)
        assert result == data

    def test_partial_pillars_only_year(self):
        """Only year_pillar is present."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
            }
        }
        result = _normalize_chart_data(data)
        assert result["pillars"][0] == "甲子"
        assert result["pillars"][1] == ""
        assert result["pillars"][2] == ""
        assert result["pillars"][3] == ""

    def test_pillar_with_missing_stem(self):
        data = {
            "chart": {
                "year_pillar": {"branch": "子"},
            }
        }
        result = _normalize_chart_data(data)
        # stem is "" and branch is "子" — pillar should be "" (both required)
        assert result["pillars"][0] == ""

    def test_pillar_with_missing_branch(self):
        data = {
            "chart": {
                "year_pillar": {"stem": "甲"},
            }
        }
        result = _normalize_chart_data(data)
        assert result["pillars"][0] == ""

    def test_pillar_with_none_value(self):
        data = {
            "chart": {
                "day_pillar": None,
            }
        }
        result = _normalize_chart_data(data)
        # None pillar, no 'stem' key — has_nested is False, returns as-is
        assert result == data

    def test_empty_hidden_stems(self):
        data = {
            "chart": {
                "year_pillar": {
                    "stem": "甲",
                    "branch": "子",
                    "hidden_stems": [],
                },
            }
        }
        result = _normalize_chart_data(data)
        assert result["pillars"][0] == "甲子"
        # hidden_stems is empty, so initial tg_zhi is ""
        # Without pillar_annotations, tg_zhi from pillars stays as ""
        assert result["tg_zhi"][0] == ""

    def test_pillar_annotations_partial(self):
        """Only some annotation keys are present."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
                "month_pillar": {"stem": "乙", "branch": "丑"},
                "day_pillar": {"stem": "丙", "branch": "寅"},
                "hour_pillar": {"stem": "丁", "branch": "卯"},
            },
            "pillar_annotations": {
                "year": {"ten_god_gan": "比肩"},
                # month, day, hour missing
            },
        }
        result = _normalize_chart_data(data)
        assert result["tg_gan"][0] == "比肩"
        assert result["tg_gan"][1] == ""
        assert result["tg_gan"][2] == ""
        assert result["tg_gan"][3] == ""

    def test_pillar_annotations_none(self):
        """pillar_annotations is explicitly None."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
                "day_pillar": {"stem": "丙", "branch": "寅"},
            },
            "pillar_annotations": None,
        }
        result = _normalize_chart_data(data)
        # Should not crash; annotations section skipped
        assert "pillars" in result

    def test_gender_from_top_level(self):
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
            },
            "gender": "坤造 (Female)",
        }
        result = _normalize_chart_data(data)
        assert result["gender"] == "坤造 (Female)"

    def test_gender_from_chart(self):
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
                "gender": "乾造",
            },
        }
        result = _normalize_chart_data(data)
        assert result["gender"] == "乾造"

    def test_minggong_from_chart_nested(self):
        """minggong fallback to chart sub-dict."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
                "minggong": "壬申",
            },
        }
        result = _normalize_chart_data(data)
        assert result["minggong"] == "壬申"

    def test_minggong_from_minggong_key(self):
        """minggong from top-level 'minggong' key."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
            },
            "minggong": "丙寅",
        }
        result = _normalize_chart_data(data)
        assert result["minggong"] == "丙寅"

    def test_minggong_frontend_underscore_wins(self):
        """ming_gong (frontend) should be preferred over chart.minggong."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
                "minggong": "壬申",
            },
            "ming_gong": "丙寅",
        }
        result = _normalize_chart_data(data)
        assert result["minggong"] == "丙寅"

    def test_all_shensha_with_string_items(self):
        """all_shensha items that are strings, not dicts."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
            },
            "all_shensha": ["太极贵人", "天乙贵人"],
        }
        result = _normalize_chart_data(data)
        # String items should be filtered out gracefully
        assert isinstance(result.get("shensha"), list)

    def test_all_shensha_with_mixed_items(self):
        """all_shensha with mix of dicts and strings."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
            },
            "all_shensha": [
                {"name": "太极贵人", "pillar": "年柱"},
                "天乙贵人",  # string, not dict
                {"name": "文昌", "pillar": "日柱"},
            ],
        }
        result = _normalize_chart_data(data)
        assert "太极贵人" in result["shensha"]
        assert "文昌" in result["shensha"]

    def test_element_balance_not_dict(self):
        """element_balance is not a dict — should not crash."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
            },
            "element_balance": "not a dict",
        }
        result = _normalize_chart_data(data)
        assert "wuxing" not in result

    def test_xingchong_as_list(self):
        """Frontend sends xingchong as a list — should be preserved."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
            },
            "xingchong": ["寅申冲: 日时冲", "巳亥冲: 年月冲"],
        }
        result = _normalize_chart_data(data)
        # After fix: list should be preserved as-is
        assert isinstance(result["xingchong"], list)
        assert len(result["xingchong"]) == 2

    def test_xingchong_as_dict(self):
        """Backend native format xingchong as dict."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
            },
            "xingchong": {"冲": ["寅申冲"], "合": ["甲己合"]},
        }
        result = _normalize_chart_data(data)
        assert result["xingchong"] == {"冲": ["寅申冲"], "合": ["甲己合"]}


# ---------------------------------------------------------------------------
# 5. stream_chat integration (mocked API)
# ---------------------------------------------------------------------------


class TestStreamChatNormalization:
    """Verify stream_chat normalizes chart_data before building prompt."""

    @staticmethod
    def _make_generator(items):
        """Helper to make a generator from a list."""
        return (item for item in items)

    @patch("backend.services.agent_service.run_react_loop_streaming")
    @patch("backend.services.agent_service.create_client")
    def test_stream_chat_normalizes_frontend_format(
        self, mock_create_client, mock_react
    ):
        """stream_chat should normalize frontend BaziReading to flat format."""
        mock_create_client.return_value = {
            "type": "openai",
            "client": MagicMock(),
        }
        # The agent yields a final tuple
        mock_react.return_value = self._make_generator([
            ("最终回答", [], [])
        ])

        results = list(stream_chat(
            message="你好",
            provider="OpenAI",
            api_key="test-key",
            base_url="https://api.example.com/v1",
            model="test-model",
            chart_data=FRONTEND_BAZI_READING,
        ))

        # Should have at least a "done" event
        done_events = [r for r in results if r[0] == "done"]
        assert len(done_events) == 1

        # Verify that run_react_loop_streaming was called with normalized data
        call_args = mock_react.call_args
        bazi_data_arg = call_args.kwargs.get("bazi_data") or call_args[1].get("bazi_data")
        # bazi_data should have 'pillars' (flat format), not 'chart' (nested)
        assert "pillars" in bazi_data_arg
        assert bazi_data_arg["pillars"] == ["壬午", "丁未", "庚寅", "戊寅"]

    @patch("backend.services.agent_service.run_react_loop_streaming")
    @patch("backend.services.agent_service.create_client")
    def test_stream_chat_passes_flat_data_through(
        self, mock_create_client, mock_react
    ):
        """stream_chat should pass flat engine data through as-is."""
        mock_create_client.return_value = {
            "type": "openai",
            "client": MagicMock(),
        }
        mock_react.return_value = self._make_generator([
            ("最终回答", [], [])
        ])

        list(stream_chat(
            message="你好",
            provider="OpenAI",
            api_key="test-key",
            base_url="https://api.example.com/v1",
            model="test-model",
            chart_data=FLAT_ENGINE_DATA,
        ))

        call_args = mock_react.call_args
        bazi_data_arg = call_args.kwargs.get("bazi_data") or call_args[1].get("bazi_data")
        assert bazi_data_arg is FLAT_ENGINE_DATA

    @patch("backend.services.agent_service.run_react_loop_streaming")
    @patch("backend.services.agent_service.create_client")
    def test_stream_chat_with_none_chart_data(
        self, mock_create_client, mock_react
    ):
        """stream_chat should handle None chart_data gracefully."""
        mock_create_client.return_value = {
            "type": "openai",
            "client": MagicMock(),
        }
        mock_react.return_value = self._make_generator([
            ("最终回答", [], [])
        ])

        results = list(stream_chat(
            message="你好",
            provider="OpenAI",
            api_key="test-key",
            base_url="https://api.example.com/v1",
            model="test-model",
            chart_data=None,
        ))

        done_events = [r for r in results if r[0] == "done"]
        assert len(done_events) == 1

    @patch("backend.services.agent_service.create_client")
    def test_stream_chat_emits_error_on_bad_client(self, mock_create_client):
        """stream_chat should emit error event if client creation fails."""
        mock_create_client.side_effect = Exception("Bad key")

        results = list(stream_chat(
            message="你好",
            provider="OpenAI",
            api_key="bad-key",
            base_url="https://bad.example.com",
            model="test",
            chart_data=None,
        ))

        error_events = [r for r in results if r[0] == "error"]
        assert len(error_events) == 1
        assert "API" in error_events[0][1]["message"]

    @patch("backend.services.agent_service.run_react_loop_streaming")
    @patch("backend.services.agent_service.create_client")
    def test_stream_chat_yields_status_events(
        self, mock_create_client, mock_react
    ):
        """stream_chat should translate [STATUS] prefix to status events."""
        mock_create_client.return_value = {
            "type": "openai",
            "client": MagicMock(),
        }
        mock_react.return_value = self._make_generator([
            "[STATUS] 正在调用工具 get_annual_fortune...",
            "流年运势分析如下",
            ("最终回答内容", [], []),
        ])

        results = list(stream_chat(
            message="2026年运势",
            provider="OpenAI",
            api_key="test-key",
            base_url="https://api.example.com/v1",
            model="test-model",
            chart_data={},
        ))

        status_events = [r for r in results if r[0] == "status"]
        token_events = [r for r in results if r[0] == "token"]
        done_events = [r for r in results if r[0] == "done"]

        assert len(status_events) == 1
        assert "get_annual_fortune" in status_events[0][1]["message"]
        assert len(token_events) == 1
        assert token_events[0][1]["content"] == "流年运势分析如下"
        assert len(done_events) == 1

    @patch("backend.services.agent_service.run_react_loop_streaming")
    @patch("backend.services.agent_service.create_client")
    def test_stream_chat_yields_error_on_agent_exception(
        self, mock_create_client, mock_react
    ):
        """stream_chat should emit error event if agent raises."""
        mock_create_client.return_value = {
            "type": "openai",
            "client": MagicMock(),
        }
        mock_react.side_effect = RuntimeError("Agent crashed")

        results = list(stream_chat(
            message="你好",
            provider="OpenAI",
            api_key="test-key",
            base_url="https://api.example.com/v1",
            model="test-model",
            chart_data=None,
        ))

        error_events = [r for r in results if r[0] == "error"]
        assert len(error_events) == 1
        assert "错误" in error_events[0][1]["message"]

    @patch("backend.services.agent_service.run_react_loop_streaming")
    @patch("backend.services.agent_service.create_client")
    def test_stream_chat_uses_settings_defaults_when_empty(
        self, mock_create_client, mock_react
    ):
        """stream_chat should fall back to settings for missing credentials."""
        mock_create_client.return_value = {
            "type": "openai",
            "client": MagicMock(),
        }
        mock_react.return_value = self._make_generator([
            ("回答", [], [])
        ])

        # Patch the settings rather than relying on a developer's local .env —
        # otherwise this passes only on machines that happen to have one.
        with patch.multiple(
            "backend.services.agent_service.settings",
            OPENAI_API_KEY="settings-key",
            OPENAI_BASE_URL="https://settings.example.com/v1",
            OPENAI_MODEL="settings-model",
        ):
            list(stream_chat(
                message="你好",
                provider="OpenAI",
                api_key="",
                base_url="",
                model="",
            ))

        # Verify create_client was called with settings defaults
        provider_arg, key_arg, url_arg = mock_create_client.call_args[0]
        assert provider_arg == "OpenAI"
        assert key_arg == "settings-key"
        assert url_arg == "https://settings.example.com/v1"


# ---------------------------------------------------------------------------
# 5a. Streaming contract: no duplicated content, tool_call events reach the UI
# ---------------------------------------------------------------------------


class TestStreamingContract:
    """The adapter's closing tuple carries the *full* accumulation, not a chunk."""

    @patch("backend.services.agent_service.create_client")
    def test_final_content_is_not_duplicated(self, mock_create_client):
        """Joining chunks *and* the closing tuple doubled the whole answer."""
        from agent.react_agent import run_react_loop_streaming

        mock_create_client.return_value = {"type": "openai", "client": MagicMock()}

        def fake_stream(client_info, model, messages, tools=None, **kwargs):
            yield "前半段"
            yield "后半段"
            yield ("前半段后半段", [])  # adapter closes with the full text

        with patch("agent.api_adapter.call_api_streaming", fake_stream):
            items = list(run_react_loop_streaming(
                client_info={"type": "openai", "client": MagicMock()},
                model="m",
                messages=[{"role": "user", "content": "hi"}],
                tools=[],
                dispatch_tool=lambda *a, **k: "{}",
                do_fact_check=False,
            ))

        final_content = items[-1][0]
        assert final_content == "前半段后半段"
        assert final_content.count("前半段") == 1

    @patch("backend.services.agent_service.create_client")
    def test_tool_call_events_are_emitted(self, mock_create_client):
        """The frontend renders tool cards from these; the backend never sent them."""
        mock_create_client.return_value = {"type": "openai", "client": MagicMock()}

        def gen():
            yield "[STATUS] 正在调用工具 get_annual_fortune..."
            yield {
                "type": "tool_call", "id": "tc1", "name": "get_annual_fortune",
                "arguments": '{"year": 2026}', "result": None, "status": "calling",
            }
            yield {
                "type": "tool_call", "id": "tc1", "name": "get_annual_fortune",
                "arguments": '{"year": 2026}', "result": '{"ganzhi":"乙巳"}',
                "status": "done",
            }
            yield ("答案", [], [])

        with patch(
            "backend.services.agent_service.run_react_loop_streaming",
            return_value=gen(),
        ):
            events = list(stream_chat(
                message="2026 运势",
                provider="OpenAI",
                api_key="k", base_url="https://x/v1", model="m",
                chart_data=None,
            ))

        kinds = [e[0] for e in events]
        assert "tool_call" in kinds, "tool_call 事件必须发出，否则前端调用卡片是死的"

        calls = [e[1] for e in events if e[0] == "tool_call"]
        assert calls[0]["status"] == "calling"
        assert calls[-1]["status"] == "done"
        assert calls[-1]["result"]
        # 事件载荷不应把内部的 type 字段漏给前端
        assert "type" not in calls[0]

    def test_failing_tool_does_not_kill_the_stream(self):
        """单个工具抛异常时，流要继续并把错误回传给模型。"""
        from agent.react_agent import run_react_loop_streaming

        calls = {"n": 0}

        def fake_stream(client_info, model, messages, tools=None, **kwargs):
            calls["n"] += 1
            if calls["n"] == 1:
                yield ("", [{
                    "id": "tc1", "type": "function",
                    "function": {"name": "boom", "arguments": "{}"},
                }])
            else:
                yield ("收尾回答", [])

        def exploding_tool(name, args, data):
            raise RuntimeError("tool blew up")

        with patch("agent.api_adapter.call_api_streaming", fake_stream):
            items = list(run_react_loop_streaming(
                client_info={"type": "openai", "client": MagicMock()},
                model="m",
                messages=[{"role": "user", "content": "hi"}],
                tools=[],
                dispatch_tool=exploding_tool,
                do_fact_check=False,
            ))

        errored = [
            i for i in items
            if isinstance(i, dict) and i.get("status") == "error"
        ]
        assert errored, "工具异常应转成 status=error 的事件而不是中断"
        assert "boom" in errored[0]["result"]
        assert items[-1][0] == "收尾回答"


# ---------------------------------------------------------------------------
# 5b. Cloudflare Workers AI provider resolution
# ---------------------------------------------------------------------------


class TestCloudflareProviderConfig:
    """The default provider reads its credentials from server-side settings."""

    @staticmethod
    def _generator(items):
        def gen():
            yield from items
        return gen()

    def test_builds_openai_compatible_base_url(self):
        with patch.multiple(
            "backend.services.agent_service.settings",
            CF_ACCOUNT_ID="acct123",
            CF_API_TOKEN="cf-token",
            CF_MODEL="@cf/zai-org/glm-4.7-flash",
        ):
            key, url, model = _resolve_provider_config("Cloudflare", "", "", "")

        assert key == "cf-token"
        assert url == (
            "https://api.cloudflare.com/client/v4/accounts/acct123/ai/v1"
        )
        assert model == "@cf/zai-org/glm-4.7-flash"

    def test_user_supplied_values_win_over_settings(self):
        with patch.multiple(
            "backend.services.agent_service.settings",
            CF_ACCOUNT_ID="acct123",
            CF_API_TOKEN="cf-token",
        ):
            key, url, model = _resolve_provider_config(
                "Cloudflare", "own-key", "https://own.example.com/v1", "own-model"
            )

        assert (key, url, model) == (
            "own-key",
            "https://own.example.com/v1",
            "own-model",
        )

    def test_missing_account_id_raises_actionable_error(self):
        with patch.multiple(
            "backend.services.agent_service.settings",
            CF_ACCOUNT_ID="",
            CF_API_TOKEN="cf-token",
        ):
            with pytest.raises(ProviderConfigError, match="BAZI_CF_ACCOUNT_ID"):
                _resolve_provider_config("Cloudflare", "", "", "")

    def test_missing_token_raises_actionable_error(self):
        with patch.multiple(
            "backend.services.agent_service.settings",
            CF_ACCOUNT_ID="acct123",
            CF_API_TOKEN="",
        ):
            with pytest.raises(ProviderConfigError, match="BAZI_CF_API_TOKEN"):
                _resolve_provider_config("Cloudflare", "", "", "")

    def test_unconfigured_cloudflare_emits_error_event_not_crash(self):
        """A missing account id must surface as an SSE error, not a 500."""
        with patch.multiple(
            "backend.services.agent_service.settings",
            CF_ACCOUNT_ID="",
            CF_API_TOKEN="",
        ):
            results = list(stream_chat(
                message="你好",
                provider="Cloudflare",
                api_key="",
                base_url="",
                model="",
                chart_data=None,
            ))

        assert [r[0] for r in results] == ["error"]
        assert "BAZI_CF_ACCOUNT_ID" in results[0][1]["message"]

    @patch("backend.services.agent_service.run_react_loop_streaming")
    @patch("backend.services.agent_service.create_client")
    def test_cloudflare_routes_through_openai_sdk(
        self, mock_create_client, mock_react
    ):
        """Workers AI speaks the OpenAI protocol, so it must not hit the
        Anthropic code path."""
        mock_create_client.return_value = {"type": "openai", "client": MagicMock()}
        mock_react.return_value = self._generator([("回答", [], [])])

        with patch.multiple(
            "backend.services.agent_service.settings",
            CF_ACCOUNT_ID="acct123",
            CF_API_TOKEN="cf-token",
            CF_MODEL="@cf/zai-org/glm-4.7-flash",
        ):
            list(stream_chat(
                message="你好",
                provider="Cloudflare",
                api_key="",
                base_url="",
                model="",
                chart_data=None,
            ))

        provider_arg, key_arg, url_arg = mock_create_client.call_args[0]
        assert provider_arg == "Cloudflare"
        assert key_arg == "cf-token"
        assert url_arg.endswith("/accounts/acct123/ai/v1")
        assert not is_anthropic_provider("Cloudflare")


# ---------------------------------------------------------------------------
# 6. System prompt correctness after normalization
# ---------------------------------------------------------------------------


class TestSystemPromptAfterNormalization:
    """Verify the system prompt contains correct chart data after normalization."""

    def test_prompt_contains_day_master(self):
        from prompts.system_prompts import build_system_prompt

        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        prompt = build_system_prompt(result)
        assert "庚" in prompt
        assert "日主" in prompt

    def test_prompt_contains_all_pillars(self):
        from prompts.system_prompts import build_system_prompt

        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        prompt = build_system_prompt(result)
        assert "壬午" in prompt
        assert "丁未" in prompt
        assert "庚寅" in prompt
        assert "戊寅" in prompt

    def test_prompt_contains_minggong_and_taiyuan(self):
        from prompts.system_prompts import build_system_prompt

        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        prompt = build_system_prompt(result)
        assert "甲寅" in prompt  # minggong
        assert "戊戌" in prompt  # taiyuan

    def test_prompt_with_empty_chart_data(self):
        """Build prompt with empty data should not crash."""
        from prompts.system_prompts import build_system_prompt

        prompt = build_system_prompt({})
        assert "玄冥" in prompt  # persona present
        assert "命理大师" in prompt

    def test_prompt_with_flat_engine_data(self):
        from prompts.system_prompts import build_system_prompt

        prompt = build_system_prompt(FLAT_ENGINE_DATA)
        assert "庚" in prompt
        assert "壬午" in prompt
        assert "戊申" in prompt  # dayun

    def test_prompt_contains_dayun_trajectory(self):
        from prompts.system_prompts import build_system_prompt

        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        prompt = build_system_prompt(result)
        # Dayun should appear in the prompt
        assert "大运" in prompt
        assert "戊申" in prompt

    def test_prompt_shows_hidden_stems(self):
        """The tg_zhi (hidden stems) should appear in the prompt."""
        from prompts.system_prompts import build_system_prompt

        result = _normalize_chart_data(FRONTEND_BAZI_READING)
        prompt = build_system_prompt(result)
        # 藏 column should show the hidden stems
        assert "丁己" in prompt  # year hidden stems
        assert "甲壬" in prompt  # hour hidden stems


# ---------------------------------------------------------------------------
# 7. Additional edge cases
# ---------------------------------------------------------------------------


class TestAdditionalEdgeCases:
    """Various edge cases and corner conditions."""

    def test_chart_with_null_pillar_key(self):
        """A pillar key maps to None."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
                "month_pillar": None,
                "day_pillar": None,
                "hour_pillar": None,
            }
        }
        # year_pillar has "stem" so has_nested is True
        result = _normalize_chart_data(data)
        assert result["pillars"][0] == "甲子"
        assert result["pillars"][1] == ""
        assert result["pillars"][2] == ""
        assert result["pillars"][3] == ""

    def test_chart_with_empty_string_pillars(self):
        """Pillar has stem/branch as empty strings."""
        data = {
            "chart": {
                "year_pillar": {"stem": "", "branch": ""},
            }
        }
        # stem is "" and branch is "" — pillar is "" (both falsy)
        # But "stem" IS in the dict, so has_nested triggers
        result = _normalize_chart_data(data)
        assert result["pillars"][0] == ""

    def test_chart_with_extra_keys(self):
        """Extra keys in chart should not interfere with normalization."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
                "extra_key": "value",
                "another": 123,
            }
        }
        result = _normalize_chart_data(data)
        assert result["pillars"][0] == "甲子"

    def test_wuxing_from_chart_subdict(self):
        """wuxing from chart sub-dict when element_balance is absent."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
                "wuxing": {"金": 0, "木": 3, "水": 2},
            }
        }
        result = _normalize_chart_data(data)
        assert result["wuxing"] == {"金": 0, "木": 3, "水": 2}

    def test_element_balance_overrides_chart_wuxing(self):
        """element_balance should take priority over chart.wuxing."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
                "wuxing": {"金": 0, "木": 3},
            },
            "element_balance": {"金": 5, "木": 5},
        }
        result = _normalize_chart_data(data)
        assert result["wuxing"] == {"金": 5, "木": 5}

    def test_nayin_with_empty_string(self):
        """nayin as empty string in pillar objects."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子", "nayin": ""},
                "month_pillar": {"stem": "乙", "branch": "丑", "nayin": None},
                "day_pillar": {"stem": "丙", "branch": "寅"},
                "hour_pillar": {"stem": "丁", "branch": "卯", "nayin": "炉中火"},
            }
        }
        result = _normalize_chart_data(data)
        assert result["nayin"][0] == ""
        assert result["nayin"][1] == ""
        assert result["nayin"][2] == ""
        assert result["nayin"][3] == "炉中火"

    def test_all_shensha_empty_list(self):
        """all_shensha as empty list should not create shensha key."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
            },
            "all_shensha": [],
        }
        result = _normalize_chart_data(data)
        assert "shensha" not in result

    def test_stream_chat_with_empty_chart_data_dict(
        self,
    ):
        """Verify stream_chat handles empty chart_data dict."""
        with patch(
            "backend.services.agent_service.run_react_loop_streaming"
        ) as mock_react, patch(
            "backend.services.agent_service.create_client"
        ) as mock_client:
            mock_client.return_value = {
                "type": "openai",
                "client": MagicMock(),
            }
            mock_react.return_value = iter([("回答", [], [])])

            results = list(stream_chat(
                message="你好",
                provider="OpenAI",
                api_key="k",
                base_url="https://api.example.com/v1",
                model="m",
                chart_data={},
            ))

            done_events = [r for r in results if r[0] == "done"]
            assert len(done_events) == 1


# ---------------------------------------------------------------------------
# 8. Regression: xingchong type preservation
# ---------------------------------------------------------------------------


class TestXingchongTypeHandling:
    """Ensure xingchong is properly handled whether list or dict."""

    def test_frontend_xingchong_list_preserved(self):
        """Frontend sends xingchong as list of strings."""
        data = dict(FRONTEND_BAZI_READING)
        result = _normalize_chart_data(data)
        # The frontend sends a list; the function should preserve it
        assert result["xingchong"] is not None
        # Even if it's a list, it should not crash

    def test_backend_xingchong_dict_preserved(self):
        """Backend engine format sends xingchong as dict."""
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
            },
            "xingchong": {"冲": ["寅申冲"], "合": [], "刑": []},
        }
        result = _normalize_chart_data(data)
        assert isinstance(result["xingchong"], dict)
        assert result["xingchong"]["冲"] == ["寅申冲"]

    def test_xingchong_none_returns_empty_dict(self):
        data = {
            "chart": {
                "year_pillar": {"stem": "甲", "branch": "子"},
            },
            "xingchong": None,
        }
        result = _normalize_chart_data(data)
        # None falls through to chart.get("xingchong") which is also None
        # Final fallback: or {} gives empty dict
        assert result["xingchong"] == {}
