/**
 * 大运时间轴。
 *
 * 这里刻意不用图表库：原来的 ECharts 版有两个硬伤——
 *   1. 画的是「年数」，每步大运都是 10 年，所有柱子等长，等于没信息；
 *   2. 另一版把年份画在 type:"value" 轴上又没设 min，2008–2088 被压在
 *      0–2000 的尺子最右端，成了几根小竖线。
 * 而且默认调色板（红绿蓝灰黄）与五行体系毫无关系。
 *
 * 换成按真实时间比例排布的自绘轨道：段宽 = 该步大运的实际跨度，
 * 颜色取自天干五行，当前大运高亮并标出「现在」的位置。
 */

import { useMemo } from "react";
import { WUXING_CHAR_COLORS } from "@/lib/wuxing-colors";
import type { DayunEntry } from "@/types/bazi";

export interface DayunTimelineProps {
  dayun: DayunEntry[];
  /** 当前选中的大运索引 */
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}

function colorOf(char: string): string {
  return WUXING_CHAR_COLORS[char] ?? "var(--muted-foreground)";
}

export default function DayunTimeline({
  dayun,
  selectedIndex,
  onSelect,
}: DayunTimelineProps) {
  const layout = useMemo(() => {
    if (!dayun.length) return null;
    const first = dayun[0].start_year;
    const last = dayun[dayun.length - 1].end_year;
    const span = Math.max(1, last - first);
    const thisYear = new Date().getFullYear();
    return {
      first,
      last,
      span,
      thisYear,
      // 「现在」在整条轨道上的百分比位置；超出范围则不显示
      nowPct:
        thisYear >= first && thisYear <= last
          ? ((thisYear - first) / span) * 100
          : null,
      segments: dayun.map((d, i) => ({
        d,
        i,
        leftPct: ((d.start_year - first) / span) * 100,
        widthPct: ((d.end_year - d.start_year + 1) / span) * 100,
      })),
    };
  }, [dayun]);

  if (!layout) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">暂无大运数据</p>
    );
  }

  const activeIdx =
    selectedIndex ?? layout.segments.findIndex((s) => s.d.is_current);

  return (
    <div className="space-y-5">
      {/* ── 轨道 ─────────────────────────────────────────────── */}
      <div className="relative pt-6">
        {/* 「现在」标记 */}
        {layout.nowPct !== null && (
          <div
            className="pointer-events-none absolute top-0 bottom-6 z-10 w-px bg-gold/50"
            style={{ left: `${layout.nowPct}%` }}
          >
            <span className="absolute -top-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-gold px-1.5 py-px text-[10px] font-medium text-background">
              {layout.thisYear}
            </span>
          </div>
        )}

        <div className="flex h-16 w-full gap-[3px] overflow-hidden rounded-lg">
          {layout.segments.map(({ d, i, widthPct }) => {
            const stemColor = colorOf(d.stem);
            const branchColor = colorOf(d.branch);
            const active = i === activeIdx;
            return (
              <button
                key={`${d.ganzhi}-${d.start_year}`}
                type="button"
                onClick={() => onSelect?.(i)}
                title={`${d.ganzhi} ${d.start_year}–${d.end_year} · ${d.start_age}–${d.end_age} 岁`}
                className="group relative flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-md transition-[transform,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out-quart)] hover:z-20 hover:scale-[1.04]"
                style={{
                  width: `${widthPct}%`,
                  background: active
                    ? `linear-gradient(180deg, ${stemColor}38, ${branchColor}20)`
                    : "rgb(255 255 255 / 0.035)",
                  boxShadow: active
                    ? `inset 0 0 0 1px ${stemColor}80`
                    : "inset 0 0 0 1px rgb(255 255 255 / 0.06)",
                }}
              >
                {/* 顶部一道天干五行色，作为该步大运的色彩身份 */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{ background: stemColor, opacity: active ? 0.95 : 0.4 }}
                />
                <span className="flex flex-col leading-none">
                  <span
                    className="font-heading text-[15px] font-bold"
                    style={{ color: active ? stemColor : "var(--foreground)", opacity: active ? 1 : 0.7 }}
                  >
                    {d.stem}
                  </span>
                  <span
                    className="font-heading text-[15px] font-bold"
                    style={{ color: active ? branchColor : "var(--foreground)", opacity: active ? 1 : 0.7 }}
                  >
                    {d.branch}
                  </span>
                </span>
                <span className="tabular mt-1 text-[9px] text-muted-foreground">
                  {d.start_age}
                </span>
              </button>
            );
          })}
        </div>

        {/* 年份刻度：只标首尾与中点，避免密集标签互相打架 */}
        <div className="tabular mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{layout.first}</span>
          <span>{Math.round((layout.first + layout.last) / 2)}</span>
          <span>{layout.last}</span>
        </div>
      </div>

      {/* ── 选中步的详情 ───────────────────────────────────── */}
      {activeIdx >= 0 && layout.segments[activeIdx] && (
        <div className="surface-inset flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg px-4 py-3">
          {(() => {
            const d = layout.segments[activeIdx].d;
            return (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-2xl font-bold" style={{ color: colorOf(d.stem) }}>
                    {d.stem}
                  </span>
                  <span className="font-heading text-2xl font-bold" style={{ color: colorOf(d.branch) }}>
                    {d.branch}
                  </span>
                  {d.is_current && (
                    <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-gold">
                      当前大运
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">年份</p>
                  <p className="tabular text-sm text-foreground">
                    {d.start_year} – {d.end_year}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">岁数</p>
                  <p className="tabular text-sm text-foreground">
                    {d.start_age} – {d.end_age}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">第几步</p>
                  <p className="tabular text-sm text-foreground">{activeIdx + 1} / {dayun.length}</p>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
