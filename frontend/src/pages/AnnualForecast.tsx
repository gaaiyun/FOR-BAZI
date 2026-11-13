/**
 * 流年页（/annual）。
 *
 * 任选一年，看这一年的干支落在命盘上是什么十神、与原局和所在大运
 * 有哪些合冲刑害。年份写在地址栏（?year=），可以直接收藏或分享某一年。
 *
 * 旧版这里有一段「喜用神之年运势向好 / 忌神之年防小人破财」的自动断语，
 * 依据只是五行个数，已删去——这一页只陈述干支关系，判断交给解读。
 */

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader, Section, EmptyState } from "@/components/layout/Page";
import { useChartView } from "@/hooks/useChartView";
import YearDetail from "@/components/bazi/YearDetail";
import { yearView } from "@/lib/chart-view";
import { relationsWith } from "@/lib/relations";
import { getCharColor } from "@/lib/wuxing-colors";
import { cn } from "@/lib/utils";

const THIS_YEAR = new Date().getFullYear();
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function clampYear(y: number): number {
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, y));
}

export default function AnnualForecast() {
  const { reading, view } = useChartView();
  const [params, setParams] = useSearchParams();

  const raw = Number(params.get("year"));
  const year = Number.isInteger(raw) && raw >= MIN_YEAR && raw <= MAX_YEAR ? raw : THIS_YEAR;
  const setYear = (y: number) => setParams({ year: String(clampYear(y)) }, { replace: true });

  // 前后各六年的一条年带
  const strip = useMemo(() => {
    if (!view) return [];
    const natal = view.pillars.map((p) => p.stem + p.branch);
    const out = [];
    for (let y = year - 5; y <= year + 6; y++) {
      if (y < MIN_YEAR || y > MAX_YEAR) continue;
      const v = yearView(y, view.dayMaster, view.birthYear);
      out.push({ ...v, relations: relationsWith(v.ganzhi, natal) });
    }
    return out;
  }, [view, year]);

  if (!reading || !view) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="流年" description="任选一年，看它与命盘的关系。" />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="流年"
        description="流年干支以立春为界。这里列出的是该年干支与原局、与所在大运之间的关系。"
        actions={
          <div className="flex items-center">
            <button type="button" className="btn btn-line btn-sm" onClick={() => setYear(year - 1)} aria-label="上一年">
              ←
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={year}
              aria-label="年份"
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= MIN_YEAR && n <= MAX_YEAR) setYear(n);
              }}
              className="tabular h-9 w-20 border-y border-input bg-transparent text-center outline-none focus:border-foreground"
            />
            <button type="button" className="btn btn-line btn-sm" onClick={() => setYear(year + 1)} aria-label="下一年">
              →
            </button>
            {year !== THIS_YEAR && (
              <button type="button" className="link ml-4 text-sm" onClick={() => setYear(THIS_YEAR)}>
                回到今年
              </button>
            )}
          </div>
        }
      />

      <div className="border-t border-foreground pt-8">
        <YearDetail view={view} year={year} />
      </div>

      <Section className="mt-10" title="前后各年" description="点任意一年切换。">
        <div className="overflow-x-auto">
          <table className="ledger min-w-[30rem]">
            <thead>
              <tr>
                <th>年份</th>
                <th>干支</th>
                <th>十神</th>
                <th>虚岁</th>
                <th>与原局</th>
              </tr>
            </thead>
            <tbody>
              {strip.map((y) => {
                const on = y.year === year;
                return (
                  <tr
                    key={y.year}
                    onClick={() => setYear(y.year)}
                    className={cn("cursor-pointer transition-colors hover:bg-wash", on && "bg-wash")}
                  >
                    <td className="tabular whitespace-nowrap">
                      <button type="button" className={cn(on && "font-semibold")} onClick={() => setYear(y.year)}>
                        {y.year}
                      </button>
                      {y.year === THIS_YEAR && <span className="ml-2 text-xs text-primary">今年</span>}
                    </td>
                    <td className="whitespace-nowrap font-heading text-lg font-semibold">
                      <span style={{ color: getCharColor(y.stem) }}>{y.stem}</span>
                      <span style={{ color: getCharColor(y.branch) }}>{y.branch}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      {y.stemGod} / {y.branchGod}
                    </td>
                    <td className="tabular">{y.age > 0 ? y.age : "—"}</td>
                    <td className="text-muted-foreground">
                      {y.relations.length ? y.relations.map((r) => r.text.replace(/（.+?）/, "")).join("、") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
