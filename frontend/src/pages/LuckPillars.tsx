/**
 * 大运页（/luck-pillars）。
 *
 * 上面是整条大运轨道，点一步看这步运的十神、纳音和它与原局的关系；
 * 下面是这步运里的十个流年，点一年在页内展开当年详情。
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Section, Facts, EmptyState } from "@/components/layout/Page";
import { useChartView } from "@/hooks/useChartView";
import DayunTimeline from "@/components/bazi/DayunTimeline";
import YearGrid from "@/components/bazi/YearGrid";
import YearDetail from "@/components/bazi/YearDetail";
import { relationsWith } from "@/lib/relations";
import { nayinOf } from "@/lib/ganzhi";
import { getCharColor } from "@/lib/wuxing-colors";

const THIS_YEAR = new Date().getFullYear();

export default function LuckPillars() {
  const { reading, view } = useChartView();
  const [picked, setPicked] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);

  const natal = useMemo(() => view?.pillars.map((p) => p.stem + p.branch) ?? [], [view]);

  if (!reading || !view) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="大运" description="十年一步，男女顺逆不同。" />
        <EmptyState />
      </div>
    );
  }

  if (!view.dayun.length) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="大运" />
        <EmptyState title="没有大运数据" description="这份命盘未能推出大运，请回到排盘页重新排一次。" />
      </div>
    );
  }

  const currentIdx = view.dayun.findIndex((d) => d.isCurrent);
  const idx = picked ?? (currentIdx >= 0 ? currentIdx : 0);
  const d = view.dayun[idx];
  const rel = relationsWith(d.ganzhi, natal);
  // 默认选中年：这步运包含今年就选今年，否则选第一年
  const selYear =
    year !== null && year >= d.startYear && year <= d.endYear
      ? year
      : THIS_YEAR >= d.startYear && THIS_YEAR <= d.endYear
        ? THIS_YEAR
        : d.startYear;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="大运"
        description={`${view.genderLabel}，年干${view.pillars[0].stem}，大运${view.direction}；虚岁 ${view.dayun[0].startAge} 岁（${view.dayun[0].startYear} 年）起运。`}
      />

      <div className="border-t border-foreground pt-6">
        <DayunTimeline
          dayun={view.dayun}
          selectedIndex={idx}
          onSelect={(i) => {
            setPicked(i);
            setYear(null);
          }}
        />
      </div>

      <Section
        className="mt-8"
        title={
          <span>
            <span style={{ color: getCharColor(d.stem) }}>{d.stem}</span>
            <span style={{ color: getCharColor(d.branch) }}>{d.branch}</span> 运
          </span>
        }
        description={`第 ${idx + 1} 步，共 ${view.dayun.length} 步${d.isCurrent ? "；现行大运" : ""}。`}
      >
        <Facts
          items={[
            { k: "年份", v: <span className="tabular">{d.startYear} – {d.endYear}</span> },
            { k: "虚岁", v: <span className="tabular">{d.startAge} – {d.endAge}</span> },
            { k: "天干十神", v: d.stemGod || "—" },
            { k: "地支十神", v: d.branchGod || "—" },
            { k: "纳音", v: nayinOf(d.ganzhi) || "—" },
          ]}
        />
        <div className="mt-6">
          <p className="eyebrow mb-3">与原局四柱</p>
          {rel.length ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-[0.9375rem]">
              {rel.map((r, i) => (
                <li key={i}>{r.text}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">这步运的干支与原局四柱没有合冲刑害。</p>
          )}
        </div>
      </Section>

      <Section title="流年" description="右上角带点的年份，与原局有冲、伏吟或反吟。">
        <YearGrid
          startYear={d.startYear}
          endYear={d.endYear}
          dayMaster={view.dayMaster}
          birthYear={view.birthYear}
          pillars={natal}
          selectedYear={selYear}
          onSelect={setYear}
        />
        <div className="mt-8">
          <YearDetail view={view} year={selYear} />
        </div>
        <p className="no-print mt-6">
          <Link to={`/annual?year=${selYear}`} className="link text-sm">
            在流年页查看 {selYear} 年
          </Link>
        </p>
      </Section>

      <Section title="全部大运">
        <div className="overflow-x-auto">
          <table className="ledger min-w-[26rem]">
            <thead>
              <tr>
                <th>大运</th>
                <th>十神</th>
                <th>年份</th>
                <th>虚岁</th>
                <th>纳音</th>
              </tr>
            </thead>
            <tbody>
              {view.dayun.map((x, i) => (
                <tr key={x.startYear}>
                  <td className="whitespace-nowrap">
                    <button
                      type="button"
                      className="font-heading text-lg font-semibold"
                      onClick={() => {
                        setPicked(i);
                        setYear(null);
                      }}
                    >
                      <span style={{ color: getCharColor(x.stem) }}>{x.stem}</span>
                      <span style={{ color: getCharColor(x.branch) }}>{x.branch}</span>
                    </button>
                    {x.isCurrent && <span className="ml-2 text-xs text-primary">现行</span>}
                  </td>
                  <td className="whitespace-nowrap">
                    {x.stemGod} / {x.branchGod}
                  </td>
                  <td className="tabular whitespace-nowrap">
                    {x.startYear}–{x.endYear}
                  </td>
                  <td className="tabular whitespace-nowrap">
                    {x.startAge}–{x.endAge}
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">{nayinOf(x.ganzhi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
