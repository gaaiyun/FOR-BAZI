/**
 * Luck Pillars page (大运).
 * Displays the dayun (大运) timeline with colored bars, year ranges,
 * and a year-by-year liunian breakdown for the selected dayun period.
 * Uses ECharts for the timeline visualization and shadcn Tabs for view switching.
 */

import { useState, useMemo } from "react";
import DayunTimeline from "@/components/bazi/DayunTimeline";
import { useBaziStore } from "@/stores/useBaziStore";
import { getCharColor } from "@/lib/wuxing-colors";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Current year for highlighting. */
const CURRENT_YEAR = new Date().getFullYear();

export default function LuckPillars() {
  const reading = useBaziStore((s) => s.reading);
  const [selectedDayunIdx, setSelectedDayunIdx] = useState<number | null>(null);

  /* ── Derive dayun entries from reading ────────────────────────── */
  const dayunEntries = useMemo(() => {
    if (!reading) return [];
    // Prefer the extended dayun field; fall back to luck_pillars.
    if (reading.dayun && reading.dayun.length > 0) {
      return reading.dayun.map((d, i) => ({
        idx: i,
        stem: d.stem,
        branch: d.branch,
        ganzhi: d.ganzhi ?? `${d.stem}${d.branch}`,
        startAge: d.start_age,
        endAge: d.end_age,
        startYear: d.start_year,
        endYear: d.end_year,
        isCurrent: d.is_current ?? (CURRENT_YEAR >= d.start_year && CURRENT_YEAR <= d.end_year),
        color: getCharColor(d.stem),
      }));
    }
    return reading.luck_pillars.map((lp, i) => ({
      idx: i,
      stem: lp.stem,
      branch: lp.branch,
      ganzhi: `${lp.stem}${lp.branch}`,
      startAge: parseInt(lp.age_range) || i * 10,
      endAge: (parseInt(lp.age_range) || i * 10) + 9,
      startYear: lp.start_year,
      endYear: lp.end_year,
      isCurrent: CURRENT_YEAR >= lp.start_year && CURRENT_YEAR <= lp.end_year,
      color: getCharColor(lp.stem),
    }));
  }, [reading]);

  /* ── Derive liunian (流年) for the selected dayun ──────────────── */
  const liunianList = useMemo(() => {
    if (!reading) return [];
    const sel = selectedDayunIdx ?? dayunEntries.findIndex((d) => d.isCurrent);
    if (sel < 0 || sel >= dayunEntries.length) return [];
    const de = dayunEntries[sel];
    // Filter annual_pillars to the selected dayun's year range.
    return reading.annual_pillars
      .filter((ap) => ap.year >= de.startYear && ap.year <= de.endYear)
      .map((ap) => ({
        ...ap,
        isCurrent: ap.year === CURRENT_YEAR,
        stemColor: getCharColor(ap.stem),
        branchColor: getCharColor(ap.branch),
      }));
  }, [reading, selectedDayunIdx, dayunEntries]);

  /* ── No data state ────────────────────────────────────────────── */
  if (!reading) {
    return (
      <div className="animate-fade-in">
        <h1 className="font-heading text-2xl font-semibold text-gold">
          大运 · Luck Pillars
        </h1>
        <p className="mt-2 text-muted-foreground">
          请先在排盘页面输入出生信息，再查看大运。
        </p>
        <div className="mt-8 rounded-lg border border-[#30363d] bg-[#161b22]/60 p-6">
          <p className="text-sm text-muted-foreground">
            暂无命盘数据。请先进行排盘计算。
          </p>
        </div>
      </div>
    );
  }

  /* ── Determine selected dayun for display ─────────────────────── */
  const activeIdx =
    selectedDayunIdx ?? dayunEntries.findIndex((d) => d.isCurrent);
  const activeDayun = activeIdx >= 0 ? dayunEntries[activeIdx] : null;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-gold">
          大运 · Luck Pillars
        </h1>
        <p className="mt-2 text-muted-foreground">
          Ten-year luck pillars and their influence on destiny.
        </p>
      </div>

      {/* ── Tabs: Timeline vs List ──────────────────────────────── */}
      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">时间线</TabsTrigger>
          <TabsTrigger value="list">列表视图</TabsTrigger>
        </TabsList>

        {/* ── Timeline View ─────────────────────────────────────── */}
        <TabsContent value="timeline">
          <section className="surface-panel rounded-xl p-6">
            <h2 className="rule-accent font-heading text-base font-semibold text-foreground">
              大运时间线
            </h2>
            <p className="mt-1 mb-5 text-xs text-muted-foreground">
              段宽按实际年数比例排布，点击可查看该步的流年详情
            </p>
            <DayunTimeline
              dayun={reading?.dayun ?? []}
              selectedIndex={selectedDayunIdx ?? undefined}
              onSelect={setSelectedDayunIdx}
            />
          </section>
        </TabsContent>

        {/* ── List View ─────────────────────────────────────────── */}
        <TabsContent value="list">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dayunEntries.map((d) => (
              <Card
                key={d.idx}
                className={`cursor-pointer transition-colors ${
                  d.isCurrent
                    ? "border-[#e94560]/60 bg-[#e94560]/10"
                    : "bg-[#161b22]/60 border-[#30363d] hover:border-[#d4af37]/40"
                }`}
                onClick={() => setSelectedDayunIdx(d.idx)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle
                      className="text-2xl font-heading"
                      style={{ color: d.color }}
                    >
                      {d.ganzhi}
                    </CardTitle>
                    {d.isCurrent && (
                      <Badge variant="destructive" className="text-xs">
                        当前
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {d.startAge} - {d.endAge} 岁
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {d.startYear} - {d.endYear} 年
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Liunian (流年) breakdown for selected dayun ─────────── */}
      {activeDayun && (
        <Card className="bg-[#161b22]/60 border-[#30363d]">
          <CardHeader>
            <CardTitle className="text-foreground">
              流年详情 — {activeDayun.ganzhi} 大运
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({activeDayun.startYear} - {activeDayun.endYear})
              </span>
            </CardTitle>
            <CardDescription>
              {activeDayun.startAge} - {activeDayun.endAge} 岁期间的逐年运势
            </CardDescription>
          </CardHeader>
          <CardContent>
            {liunianList.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {liunianList.map((ln) => (
                  <div
                    key={ln.year}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                      ln.isCurrent
                        ? "border-[#e94560]/60 bg-[#e94560]/10"
                        : "border-[#30363d] bg-[#0d1117]/60"
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${
                        ln.isCurrent ? "text-[#e94560]" : "text-muted-foreground"
                      }`}
                    >
                      {ln.year}
                    </span>
                    <span className="text-lg font-heading">
                      <span style={{ color: ln.stemColor }}>{ln.stem}</span>
                      <span style={{ color: ln.branchColor }}>{ln.branch}</span>
                    </span>
                    {ln.isCurrent && (
                      <Badge variant="destructive" className="ml-auto text-[10px]">
                        今年
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                暂无该大运期间的流年数据
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
