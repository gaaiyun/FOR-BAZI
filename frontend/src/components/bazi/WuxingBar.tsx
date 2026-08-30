/**
 * 五行力量条。
 *
 * 只有五个固定条目，用 ECharts 是杀鸡用牛刀：多带 1MB 依赖、样式受默认主题
 * 牵制、还要和页面其余部分对齐字体与间距。改成自绘后更轻，也能把日主、
 * 最旺、最弱这些语义直接标在条上——图表库做不到这种贴合。
 */

import { useMemo } from "react";
import { ELEMENT_COLORS } from "@/lib/wuxing-colors";
import type { WuxingPower, ElementBalance } from "@/types/bazi";

export interface WuxingBarProps {
  /** 接受加权力量或计数两种来源 */
  wuxingPower: WuxingPower | ElementBalance | Record<string, number>;
  /** 日主五行，会额外标注 */
  dayMasterElement?: string;
}

const ELEMENTS = ["金", "木", "水", "火", "土"] as const;
const EN: Record<string, string> = {
  金: "Metal", 木: "Wood", 水: "Water", 火: "Fire", 土: "Earth",
};

function colorOf(el: string): string {
  return ELEMENT_COLORS[el] ?? "var(--muted-foreground)";
}

export default function WuxingBar({ wuxingPower, dayMasterElement }: WuxingBarProps) {
  const rows = useMemo(() => {
    const src = wuxingPower as unknown as Record<string, number>;
    const vals = ELEMENTS.map((el) => src[el] ?? 0);
    const max = Math.max(...vals, 1);
    const strongest = ELEMENTS[vals.indexOf(Math.max(...vals))];
    const weakest = ELEMENTS[vals.indexOf(Math.min(...vals))];
    return ELEMENTS.map((el, i) => ({
      el,
      value: vals[i],
      pct: (vals[i] / max) * 100,
      isStrongest: el === strongest,
      isWeakest: el === weakest,
      isDayMaster: el === dayMasterElement,
    }));
  }, [wuxingPower, dayMasterElement]);

  return (
    <ul className="stagger space-y-3">
      {rows.map((r) => (
        <li key={r.el} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          {/* 五行字 + 英文 */}
          <div className="flex w-16 items-baseline gap-1.5">
            <span
              className="font-heading text-lg font-bold leading-none"
              style={{ color: colorOf(r.el) }}
            >
              {r.el}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {EN[r.el]}
            </span>
          </div>

          {/* 力量条 */}
          <div className="relative h-6 overflow-hidden rounded-md bg-black/25">
            <div
              className="h-full rounded-md transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out-expo)]"
              style={{
                width: `${r.pct}%`,
                background: `linear-gradient(90deg, ${colorOf(r.el)}cc, ${colorOf(r.el)}66)`,
              }}
            />
            {/* 语义标注贴在条内，图表库做不到这种贴合 */}
            <span className="absolute inset-y-0 right-2 flex items-center gap-1.5">
              {r.isDayMaster && (
                <span className="rounded bg-background/70 px-1.5 py-px text-[9px] font-medium text-gold">
                  日主
                </span>
              )}
              {r.isStrongest && (
                <span className="rounded bg-background/70 px-1.5 py-px text-[9px] text-muted-foreground">
                  最旺
                </span>
              )}
              {r.isWeakest && (
                <span className="rounded bg-background/70 px-1.5 py-px text-[9px] text-muted-foreground">
                  最弱
                </span>
              )}
            </span>
          </div>

          {/* 数值 */}
          <span className="tabular w-14 text-right text-sm font-medium text-foreground">
            {r.value.toFixed(1)}%
          </span>
        </li>
      ))}
    </ul>
  );
}
