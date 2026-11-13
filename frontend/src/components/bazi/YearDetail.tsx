/**
 * 某一年的流年详情：干支、十神、纳音、虚岁、所在大运，以及这一年的干支
 * 与原局四柱、与所在大运之间的合冲刑害。只列事实，不写吉凶。
 */

import { useMemo } from "react";
import type { ChartView } from "@/lib/chart-view";
import { yearView } from "@/lib/chart-view";
import { relationsWith, type Relation } from "@/lib/relations";
import { getCharColor } from "@/lib/wuxing-colors";
import { Facts } from "@/components/layout/Page";

const STRONG = new Set(["六冲", "反吟", "伏吟", "干克"]);

function RelationList({ items, empty }: { items: Relation[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1.5 text-[0.9375rem]">
      {items.map((r, i) => (
        <li key={i} className="flex items-baseline gap-3">
          <span className={STRONG.has(r.kind) ? "w-12 shrink-0 text-xs text-primary" : "w-12 shrink-0 text-xs text-muted-foreground"}>
            {r.kind}
          </span>
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

export default function YearDetail({ view, year }: { view: ChartView; year: number }) {
  const data = useMemo(() => {
    const y = yearView(year, view.dayMaster, view.birthYear);
    const natal = view.pillars.map((p) => p.stem + p.branch);
    const dayun = view.dayun.find((d) => year >= d.startYear && year <= d.endYear) ?? null;
    return {
      y,
      dayun,
      withNatal: relationsWith(y.ganzhi, natal),
      // 与大运只有一柱可比，把柱名换成「运」
      withDayun: dayun
        ? relationsWith(y.ganzhi, [dayun.ganzhi]).map((r) => ({
            ...r,
            text: r.text.replace(/年柱/g, "大运").replace(/年干/g, "运干").replace(/年支/g, "运支"),
          }))
        : [],
    };
  }, [view, year]);

  const { y, dayun, withNatal, withDayun } = data;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
        <div className="flex items-end gap-4">
          <span className="glyph flex gap-1 text-[4rem] sm:text-[5rem]" key={y.ganzhi}>
            <span style={{ color: getCharColor(y.stem), animation: "ink-in 500ms var(--ease-out-expo) both" }}>{y.stem}</span>
            <span style={{ color: getCharColor(y.branch), animation: "ink-in 500ms var(--ease-out-expo) 70ms both" }}>
              {y.branch}
            </span>
          </span>
          <span className="tabular pb-2 text-sm text-muted-foreground">{year} 年</span>
        </div>
        <Facts
          className="pb-1"
          items={[
            { k: "天干十神", v: y.stemGod || "—" },
            { k: "地支十神", v: y.branchGod || "—" },
            { k: "纳音", v: y.nayin || "—" },
            ...(y.age > 0 ? [{ k: "虚岁", v: <span className="tabular">{y.age}</span> }] : []),
            {
              k: "所在大运",
              v: dayun ? (
                <span>
                  <span className="font-heading font-semibold">{dayun.ganzhi}</span>
                  <span className="ml-1.5 text-muted-foreground">
                    {dayun.stemGod} / {dayun.branchGod}
                  </span>
                </span>
              ) : (
                "未起运"
              ),
            },
          ]}
        />
      </div>

      <div className="mt-8 grid gap-x-12 gap-y-6 sm:grid-cols-2">
        <div>
          <p className="eyebrow mb-3">与原局四柱</p>
          <RelationList items={withNatal} empty="这一年的干支与原局四柱没有合冲刑害。" />
        </div>
        {dayun && (
          <div>
            <p className="eyebrow mb-3">与 {dayun.ganzhi} 大运</p>
            <RelationList items={withDayun} empty="与所在大运没有合冲刑害。" />
          </div>
        )}
      </div>
    </div>
  );
}
