# -*- coding: utf-8 -*-
"""第二批神煞（2026-11 补入）的规则测试。

每个命例都按古法查表手算过，断言的是「某柱应有 / 不应有某煞」，
不依赖引擎自己生成的黄金基准，避免拿结果验证结果。
"""

import json

import pytest

from engine.shensha import calculate_shensha
from tools.bazi_tools import _SHENSHA_GLOSSARY, explain_shensha

YEAR, MONTH, DAY, HOUR = 0, 1, 2, 3


def at(pillars, idx):
    return calculate_shensha(pillars)[idx]


class TestRules:
    def test_taiji_by_day_gan(self):
        # 乙日：太极在子午；月支午
        assert "太极贵人" in at(["乙丑", "壬午", "乙酉", "辛巳"], MONTH)

    def test_jinyu_by_day_gan(self):
        # 乙日金舆在巳；时支巳
        assert "金舆" in at(["乙丑", "壬午", "乙酉", "辛巳"], HOUR)

    def test_kuigang_only_on_day_pillar(self):
        r = calculate_shensha(["戊辰", "甲寅", "庚戌", "丙子"])
        assert "魁罡" in r[DAY]
        assert all("魁罡" not in r[i] for i in (YEAR, MONTH, HOUR))

    @pytest.mark.parametrize("day", ["庚辰", "庚戌", "壬辰", "戊戌"])
    def test_kuigang_four_days(self, day):
        assert "魁罡" in at(["甲子", "丙寅", day, "癸卯"], DAY)

    def test_kuigang_not_for_other_chen_xu(self):
        assert "魁罡" not in at(["甲子", "丙寅", "甲辰", "癸卯"], DAY)

    def test_yuede_checks_stems(self):
        # 寅月月德在丙；时干丙
        assert "月德贵人" in at(["戊辰", "甲寅", "庚戌", "丙子"], HOUR)

    def test_tiande_stem_target(self):
        # 寅月天德在丁；时干丁
        assert "天德贵人" in at(["甲子", "丙寅", "壬辰", "丁未"], HOUR)

    def test_tiande_branch_target(self):
        # 卯月天德在申；时支申
        assert "天德贵人" in at(["甲子", "丁卯", "壬辰", "戊申"], HOUR)

    def test_hongluan_tianxi_by_year_zhi(self):
        # 子年：红鸾卯、天喜酉
        r = calculate_shensha(["甲子", "丙寅", "壬辰", "癸卯"])
        assert "红鸾" in r[HOUR]
        r2 = calculate_shensha(["甲子", "丙寅", "壬辰", "己酉"])
        assert "天喜" in r2[HOUR]

    def test_guchen_guasu_by_year_zhi(self):
        # 子年：孤辰寅、寡宿戌
        assert "孤辰" in at(["甲子", "丙寅", "壬辰", "癸卯"], MONTH)
        assert "寡宿" in at(["甲子", "丙寅", "壬辰", "壬戌"], HOUR)

    def test_jiesha_wangshen_year_and_day(self):
        # 子年劫煞巳、亡神亥；日支午（寅午戌）劫煞亥、亡神巳——两套都要查到
        r = calculate_shensha(["甲子", "己巳", "丙午", "己亥"])
        assert "劫煞" in r[MONTH] and "亡神" in r[MONTH]
        assert "亡神" in r[HOUR] and "劫煞" in r[HOUR]

    def test_no_duplicates_in_a_pillar(self):
        for pillars in (["甲子", "己巳", "丙午", "己亥"], ["戊辰", "甲寅", "庚戌", "丙子"]):
            for names in calculate_shensha(pillars).values():
                assert len(names) == len(set(names))


class TestFirstBatchOrderPreserved:
    def test_first_batch_comes_first(self):
        first = {"桃花", "驿马", "华盖", "将星", "天乙贵人", "禄神", "羊刃", "文昌"}
        r = calculate_shensha(["乙丑", "壬午", "乙酉", "辛巳"])
        for names in r.values():
            seen_second = False
            for n in names:
                if n not in first:
                    seen_second = True
                elif seen_second:
                    pytest.fail(f"第一批神煞 {n} 出现在第二批之后：{names}")


class TestGlossaryCoverage:
    ALL = {
        "桃花", "驿马", "华盖", "将星", "天乙贵人", "禄神", "羊刃", "文昌",
        "太极贵人", "天德贵人", "月德贵人", "金舆", "红鸾", "天喜",
        "孤辰", "寡宿", "劫煞", "亡神", "魁罡",
    }

    def test_every_emitted_name_has_glossary(self):
        assert self.ALL <= set(_SHENSHA_GLOSSARY)

    def test_explain_multi(self):
        out = json.loads(explain_shensha("魁罡 红鸾"))
        assert "魁罡：" in out["description"] and "红鸾：" in out["description"]
