"""生成干支大字用的字体子集。

四柱、大运、流年里的大字只会是 22 个干支加五行，没必要为它们加载整套
900 字重的思源宋体（1.4 MB）。这里从 @fontsource/noto-serif-sc 里切出
这几十个字，得到一个十几 KB 的 woff2，随首屏一起加载。

用法（需要 fonttools 与 brotli）：
    python scripts/subset_glyph_font.py
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "node_modules/@fontsource/noto-serif-sc/files/noto-serif-sc-chinese-simplified-900-normal.woff2"
OUT = ROOT / "src/assets/fonts/ming-glyph-900.woff2"

CHARS = (
    "甲乙丙丁戊己庚辛壬癸"      # 天干
    "子丑寅卯辰巳午未申酉戌亥"  # 地支
    "木火土金水"                # 五行
    "玄冥"                      # 站名
)


def main() -> None:
    font = TTFont(SRC)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = [1, 2]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=CHARS)
    subsetter.subset(font)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(OUT)
    missing = [c for c in CHARS if ord(c) not in font.getBestCmap()]
    print(f"wrote {OUT.relative_to(ROOT)}: {OUT.stat().st_size} bytes, {len(CHARS)} chars, missing={missing}")


if __name__ == "__main__":
    main()
