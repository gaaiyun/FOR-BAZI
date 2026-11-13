/**
 * 一步大运里的十个流年。
 *
 * 手机上排成 5 列 × 2 行，宽屏排成一行 10 列。每格是年份、干支、天干十神，
 * 与原局有冲合的年份在右上角标一个小点；点哪一年，哪一年就成为选中年。
 */

import { useMemo } from "react";
import { yearView } from "@/lib/chart-view";
import { relationsWith } from "@/lib/relations";
import { getCharColor } from "@/lib/wuxing-colors";
import { cn } from "@/lib/utils";

export interface YearGridProps {
  startYear: number;
  endYear: number;
  dayMaster: string;
  birthYear: number | null;
  /** 原局四柱，用于标出有冲合的年份 */
  pillars: string[];
  selectedYear?: number;
  onSelect?: (year: number) => void;
  now?: Date;
}

export default function YearGrid({
  startYear, endYear, dayMaster, birthYear, pillars, selectedYear, onSelect, now = new Date(),
}: YearGridProps) {
  const years = useMemo(() => {
    const out = [];
    for (let y = startYear; y <= endYear; y++) {
      const v = yearView(y, dayMaster, birthYear);
      const rel = relationsWith(v.ganzhi, pillars);
      out.push({ ...v, clash: rel.some((r) => r.kind === "六冲" || r.kind === "反吟" || r.kind === "伏吟") });
    }
    return out;
  }, [startYear, endYear, dayMaster, birthYear, pillars]);

  const thisYear = now.getFullYear();

  return (
    <div className="grid grid-cols-5 border-l border-t border-rule sm:grid-cols-10">
      {years.map((y) => {
        const on = y.year === selectedYear;
        const isNow = y.year === thisYear;
        return (
          <button
            key={y.year}
            type="button"
            onClick={() => onSelect?.(y.year)}
            aria-pressed={on}
            aria-label={`${y.year} 年 ${y.ganzhi}，${y.stemGod}${y.clash ? "，与原局有冲" : ""}`}
            className={cn(
              "relative flex flex-col items-center border-b border-r border-rule px-1 py-3 transition-colors duration-[var(--dur-fast)]",
              on ? "bg-foreground text-background" : "hover:bg-wash"
            )}
          >
            <span className={cn("tabular text-xs", on ? "" : isNow ? "font-medium text-primary" : "text-muted-foreground")}>
              {y.year}
            </span>
            <span className="glyph mt-2 flex flex-col gap-0.5 text-xl">
              <span style={{ color: on ? undefined : getCharColor(y.stem) }}>{y.stem}</span>
              <span style={{ color: on ? undefined : getCharColor(y.branch) }}>{y.branch}</span>
            </span>
            <span className={cn("mt-2 text-xs", on ? "opacity-80" : "text-muted-foreground")}>{y.stemGod}</span>
            {y.clash && (
              <span
                aria-hidden
                className={cn("absolute right-1.5 top-1.5 size-1 rounded-full", on ? "bg-background" : "bg-primary")}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
