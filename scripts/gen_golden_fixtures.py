# -*- coding: utf-8 -*-
"""
从 Python 引擎生成黄金基准，供 TypeScript 移植版做逐字段比对。

移植计算逻辑最大的风险是"看起来对但边界错了"。这里刻意覆盖：
闰月、节气交界、子时跨日、年初年末、不同性别（大运顺逆）、
以及会触发三合/三会/自刑/从格边界的组合。

用法：python scripts/gen_golden_fixtures.py <输出路径>
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine.bazi_engine import calculate_professional_bazi
from tools.wuxing_calculator import calculate_wuxing_power
from tools.geju_analyzer import analyze_geju

MALE = "乾造 (Male)"
FEMALE = "坤造 (Female)"

# (year, month, day, hour, minute, gender, 为什么选这个日期)
CASES = [
    (1985, 6, 15, 9, 20, MALE, "常规命例（现有测试基准）"),
    (1988, 5, 27, 9, 20, MALE, "从格力量条件触发但阳干见印比 -> 非从格"),
    (1990, 1, 1, 0, 0, MALE, "元旦零点，年初边界 + 子时"),
    (1990, 1, 1, 0, 0, FEMALE, "同上但坤造，检验大运顺逆"),
    (2000, 3, 15, 12, 0, FEMALE, "常规坤造"),
    (2024, 2, 10, 23, 59, FEMALE, "农历新年边界 + 晚子时跨日"),
    (2024, 2, 9, 23, 30, MALE, "除夕晚子时，年柱是否换柱"),
    (1999, 12, 31, 23, 59, MALE, "世纪末边界"),
    (2000, 2, 29, 12, 0, MALE, "闰年 2 月 29 日"),
    (2004, 2, 4, 19, 56, MALE, "立春交节前后（节气边界最易错）"),
    (2004, 2, 4, 20, 10, MALE, "同日立春之后"),
    (1976, 8, 8, 3, 30, MALE, "寅时"),
    (1968, 11, 11, 11, 11, FEMALE, "随机中段日期"),
    (2010, 5, 5, 5, 5, MALE, "立夏附近"),
    (1995, 9, 23, 6, 0, FEMALE, "秋分附近"),
    (2026, 8, 29, 14, 0, MALE, "近期日期"),
    (1930, 1, 30, 8, 0, MALE, "较早年份，检验历法范围"),
    (2050, 12, 21, 18, 0, FEMALE, "未来日期 + 冬至附近"),
]


def build() -> list[dict]:
    out = []
    for y, m, d, h, mi, gender, why in CASES:
        dt = datetime(y, m, d, h, mi)
        chart = calculate_professional_bazi(dt, gender)
        out.append({
            "input": {
                "year": y, "month": m, "day": d,
                "hour": h, "minute": mi, "gender": gender,
            },
            "why": why,
            "chart": chart,
            "wuxing_power": json.loads(calculate_wuxing_power(chart)),
            "geju": json.loads(analyze_geju(chart)),
        })
    return out


if __name__ == "__main__":
    dest = Path(sys.argv[1] if len(sys.argv) > 1 else "tests/fixtures/golden_charts.json")
    dest.parent.mkdir(parents=True, exist_ok=True)
    data = build()
    dest.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"[OK] {len(data)} 个基准命例 -> {dest}")
