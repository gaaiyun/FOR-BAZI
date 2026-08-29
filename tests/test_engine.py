# -*- coding: utf-8 -*-
"""
Engine calculation tests for FOR-BAZI.

Tests the core bazi calculation engine (calculate_professional_bazi) to ensure
correct pillar generation, day master extraction, wuxing stats, and gender
validation.
"""

import pytest

from engine.bazi_engine import calculate_professional_bazi


class TestBaziEngine:
    """Tests for calculate_professional_bazi."""

    def test_basic_calculation(self):
        """Basic calculation should return 4 pillars."""
        from datetime import datetime
        dt = datetime(1985, 6, 15, 9, 20)
        result = calculate_professional_bazi(dt, "乾造 (Male)")
        assert result is not None
        assert "pillars" in result
        assert len(result["pillars"]) == 4

    def test_day_master(self):
        """Day master should be one of the 10 heavenly stems."""
        from datetime import datetime
        dt = datetime(1985, 6, 15, 9, 20)
        result = calculate_professional_bazi(dt, "乾造 (Male)")
        assert "day_master" in result
        assert result["day_master"] in "甲乙丙丁戊己庚辛壬癸"

    def test_wuxing(self):
        """Wuxing section should contain all 5 element counts."""
        from datetime import datetime
        dt = datetime(2000, 3, 15, 12, 0)
        result = calculate_professional_bazi(dt, "坤造 (Female)")
        assert "wuxing" in result
        wuxing = result["wuxing"]
        # All 5 elements should be present as keys
        expected_keys = {"金(Metal)", "木(Wood)", "水(Water)", "火(Fire)", "土(Earth)"}
        assert expected_keys.issubset(set(wuxing.keys()))

    def test_nayin(self):
        """Each pillar should have a nayin (melodic element)."""
        from datetime import datetime
        dt = datetime(1985, 6, 15, 9, 20)
        result = calculate_professional_bazi(dt, "乾造 (Male)")
        assert "nayin" in result
        assert len(result["nayin"]) == 4
        for n in result["nayin"]:
            assert isinstance(n, str)
            assert len(n) > 0

    def test_shensha(self):
        """Shensha list should be present (may be empty)."""
        from datetime import datetime
        dt = datetime(1985, 6, 15, 9, 20)
        result = calculate_professional_bazi(dt, "乾造 (Male)")
        assert "shensha" in result
        assert isinstance(result["shensha"], list)

    def test_dayun(self):
        """Dayun list should be present with start_age and ganzhi."""
        from datetime import datetime
        dt = datetime(1985, 6, 15, 9, 20)
        result = calculate_professional_bazi(dt, "乾造 (Male)")
        assert "dayun" in result
        assert isinstance(result["dayun"], list)
        if len(result["dayun"]) > 0:
            first = result["dayun"][0]
            assert "start_age" in first
            assert "ganzhi" in first

    def test_xingchong(self):
        """Xingchong dict should contain all expected relation types."""
        from datetime import datetime
        dt = datetime(1985, 6, 15, 9, 20)
        result = calculate_professional_bazi(dt, "乾造 (Male)")
        assert "xingchong" in result
        xc = result["xingchong"]
        expected_types = {"冲", "合", "刑", "害", "破", "穿", "三合", "三会", "半三合"}
        assert expected_types.issubset(set(xc.keys()))

    def test_gender_stored(self):
        """Gender string should be stored as-is in result."""
        from datetime import datetime
        dt = datetime(1985, 6, 15, 9, 20)
        result = calculate_professional_bazi(dt, "乾造 (Male)")
        assert result["gender"] == "乾造 (Male)"

    def test_female_gender_stored(self):
        """Female gender should be stored correctly."""
        from datetime import datetime
        dt = datetime(2000, 3, 15, 12, 0)
        result = calculate_professional_bazi(dt, "坤造 (Female)")
        assert result["gender"] == "坤造 (Female)"

    def test_dishi(self):
        """DiShi (十二长生) should have 4 entries."""
        from datetime import datetime
        dt = datetime(1985, 6, 15, 9, 20)
        result = calculate_professional_bazi(dt, "乾造 (Male)")
        assert "dishi" in result
        assert len(result["dishi"]) == 4

    def test_xunkong(self):
        """XunKong (旬空) should have 4 entries."""
        from datetime import datetime
        dt = datetime(1985, 6, 15, 9, 20)
        result = calculate_professional_bazi(dt, "乾造 (Male)")
        assert "xunkong" in result
        assert len(result["xunkong"]) == 4

    def test_special_palaces(self):
        """MingGong, TaiYuan, TaiXi, ShenGong should be present."""
        from datetime import datetime
        dt = datetime(1985, 6, 15, 9, 20)
        result = calculate_professional_bazi(dt, "乾造 (Male)")
        assert "minggong" in result
        assert "taiyuan" in result
        assert "taixi" in result
        assert "shengong" in result
