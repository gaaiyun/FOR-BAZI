/**
 * 大运轨道。
 *
 * 每步大运占一段，段宽按实际年数比例排布，所以「现在」那条朱砂细线落在
 * 段内的位置就是这步运走了多少。段上只有干支和起运虚岁，选中的一段
 * 顶线加粗；不用色块填充。
 */

import { useMemo } from "react";
import type { DayunView } from "@/lib/chart-view";
import { getCharColor } from "@/lib/wuxing-colors";
import { cn } from "@/lib/utils";

export interface DayunTimelineProps {
  dayun: DayunView[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  now?: Date;
}

export default function DayunTimeline({ dayun, selectedIndex, onSelect, now = new Date() }: DayunTimelineProps) {
  const layout = useMemo(() => {
    if (!dayun.length) return null;
    const first = dayun[0].startYear;
    const last = dayun[dayun.length - 1].endYear + 1;
    const span = Math.max(1, last - first);
    // 精确到月，线才不会整年整年地跳
    const t = now.getFullYear() + now.getMonth() / 12;
    return {
      first,
      last: last - 1,
      nowPct: t >= first && t <= last ? ((t - first) / span) * 100 : null,
      thisYear: now.getFullYear(),
    };
  }, [dayun, now]);

  if (!layout) return <p className="text-sm text-muted-foreground">暂无大运数据。</p>;

  const active = selectedIndex ?? dayun.findIndex((d) => d.isCurrent);

  return (
    <div className="relative pt-6">
      {layout.nowPct !== null && (
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-primary"
          style={{ left: `${layout.nowPct}%` }}
          aria-hidden
        >
          <span
            className={cn(
              "tabular absolute top-0 whitespace-nowrap text-xs leading-none text-primary",
              layout.nowPct > 85 ? "right-1.5" : "left-1.5"
            )}
          >
            {layout.thisYear}
          </span>
        </div>
      )}

      <div className="flex w-full">
        {dayun.map((d, i) => {
          const on = i === active;
          return (
            <button
              key={`${d.ganzhi}-${d.startYear}`}
              type="button"
              onClick={() => onSelect?.(i)}
              aria-pressed={on}
              aria-label={`${d.ganzhi}运，${d.startYear} 至 ${d.endYear} 年，虚岁 ${d.startAge} 至 ${d.endAge}`}
              className={cn(
                "group flex min-w-0 flex-col items-center border-t pb-1 pt-3 transition-colors duration-[var(--dur-fast)]",
                on ? "border-t-2 border-foreground" : "border-rule hover:border-muted-foreground"
              )}
              style={{ flexGrow: d.endYear - d.startYear + 1, flexBasis: 0, marginTop: on ? "-1px" : 0 }}
            >
              <span
                className={cn(
                  "glyph flex flex-col gap-1 text-[clamp(1.05rem,4.6vw,1.6rem)] transition-opacity",
                  on ? "opacity-100" : "opacity-45 group-hover:opacity-80"
                )}
              >
                <span style={{ color: getCharColor(d.stem) }}>{d.stem}</span>
                <span style={{ color: getCharColor(d.branch) }}>{d.branch}</span>
              </span>
              <span className={cn("tabular mt-2 text-xs", on ? "text-foreground" : "text-faint")}>{d.startAge}</span>
            </button>
          );
        })}
      </div>

      <div className="tabular mt-1 flex justify-between text-xs text-faint">
        <span>{layout.first}</span>
        <span>虚岁</span>
        <span>{layout.last}</span>
      </div>
    </div>
  );
}
