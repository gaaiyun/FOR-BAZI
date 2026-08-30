/**
 * ChartVisualization page (/chart) -- displays the full Bazi chart
 * with four pillars, wuxing analysis, dayun timeline, and geju details.
 * Supports Professional/Basic toggle for advanced fields.
 */

import { useState, useMemo, useEffect } from "react";
import { Section } from "@/components/layout/Page";
import { useNavigate } from "react-router-dom";
import { useBaziStore } from "@/stores/useBaziStore";
import FourPillarGrid from "@/components/bazi/FourPillarGrid";
import WuxingRadar from "@/components/bazi/WuxingRadar";
import WuxingBar from "@/components/bazi/WuxingBar";
import DayunTimeline from "@/components/bazi/DayunTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getElementColor, getCharColor } from "@/lib/wuxing-colors";

// ── Component ─────────────────────────────────────────────────────

export default function ChartVisualization() {
  const navigate = useNavigate();
  const { reading, isLoading } = useBaziStore();
  const [isProfessional, setIsProfessional] = useState(false);

  // Redirect to calculator if no reading is available
  useEffect(() => {
    if (!reading && !isLoading) {
      navigate("/");
    }
  }, [reading, isLoading, navigate]);

  // Derive wuxing power from element_balance as fallback
  const wuxingPower = useMemo(() => {
    if (reading?.wuxing_power) return reading.wuxing_power;
    if (reading?.element_balance) return reading.element_balance;
    return { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
  }, [reading]);

  // Derive dayun entries from luck_pillars as fallback
  const dayunEntries = useMemo(() => {
    if (reading?.dayun) return reading.dayun;
    if (reading?.luck_pillars) {
      return reading.luck_pillars.map((lp, i) => ({
        stem: lp.stem,
        branch: lp.branch,
        ganzhi: `${lp.stem}${lp.branch}`,
        start_age: i * 10,
        end_age: i * 10 + 9,
        start_year: lp.start_year,
        end_year: lp.end_year,
        is_current: i === 0,
      }));
    }
    return [];
  }, [reading]);

  // ── Loading state ────────────────────────────────────────────

  if (isLoading || !reading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Safe accessor for pillar annotations ─────────────────────

  const mingGong = reading.ming_gong ?? "—";
  const taiYuan = reading.tai_yuan ?? "—";
  const shenGong = reading.shen_gong ?? "—";
  const taiXi = reading.tai_xi ?? "—";

  // ── Main render ──────────────────────────────────────────────

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-gold">
            命盘 · Chart Visualization
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            日主:{" "}
            <span style={{ color: getCharColor(reading.chart.day_master) }}>
              {reading.chart.day_master}
            </span>{" "}
            ({reading.chart.day_master_element})
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsProfessional((v) => !v)}
          className="border-border text-muted-foreground hover:border-gold hover:text-gold"
        >
          {isProfessional ? "切换专业模式 ✓" : "切换专业模式"}
        </Button>
      </div>

      {/* ── Four Pillar Grid ──────────────────────────────────── */}
      <FourPillarGrid reading={reading} isProfessional={isProfessional} />

      {/* ── Ming Gong / Tai Yuan / Shen Gong / Tai Xi ─────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "命宫", value: mingGong },
          { label: "胎元", value: taiYuan },
          { label: "身宫", value: shenGong },
          { label: "胎息", value: taiXi },
        ].map(({ label, value }) => (
          <Card
            key={label}
            className="border border-border bg-card/60 backdrop-blur-md"
          >
            <CardContent className="flex flex-col items-center gap-1 py-3">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-lg font-bold text-gold">{value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Wuxing Charts ─────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="五行力量雷达">
            <WuxingRadar wuxingPower={wuxingPower} dayMasterElement={reading.chart.day_master_element} />
          </Section>
        <Section title="五行力量柱状">
            <WuxingBar wuxingPower={wuxingPower} dayMasterElement={reading.chart.day_master_element} />
          </Section>
      </div>

      {/* ── Tabbed Detail Sections ────────────────────────────── */}
      <Tabs defaultValue="dayun">
        <TabsList className="bg-muted">
          <TabsTrigger value="dayun">大运流年</TabsTrigger>
          <TabsTrigger value="geju">格局神煞</TabsTrigger>
          <TabsTrigger value="wuxing">五行精算</TabsTrigger>
        </TabsList>

        {/* Tab 1: Dayun / Annual Pillars */}
        <TabsContent value="dayun" className="mt-4 space-y-4">
          <Section title="大运流年">
              {dayunEntries.length > 0 ? (
                <DayunTimeline dayun={dayunEntries} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  暂无大运数据
                </p>
              )}
            </Section>

          {/* Dayun list table */}
          {dayunEntries.length > 0 && (
            <Card className="border border-border bg-card/60 backdrop-blur-md">
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="px-3 py-2 text-left">干支</th>
                        <th className="px-3 py-2 text-left">起始年龄</th>
                        <th className="px-3 py-2 text-left">起始年份</th>
                        <th className="px-3 py-2 text-left">结束年份</th>
                        <th className="px-3 py-2 text-left">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayunEntries.map((d, i) => (
                        <tr
                          key={i}
                          className={`border-b border-border/50 ${
                            d.is_current ? "bg-crimson/10" : ""
                          }`}
                        >
                          <td className="px-3 py-2 font-medium">
                            <span style={{ color: getCharColor(d.stem) }}>
                              {d.stem}
                            </span>
                            <span style={{ color: getCharColor(d.branch) }}>
                              {d.branch}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {d.start_age} - {d.end_age} 岁
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {d.start_year}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {d.end_year}
                          </td>
                          <td className="px-3 py-2">
                            {d.is_current ? (
                              <Badge className="bg-crimson/20 text-crimson border-crimson/30 text-xs">
                                当前
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Annual pillars preview */}
          {reading.annual_pillars?.length > 0 && (
            <Section title="近年流年">
                <div className="flex flex-wrap gap-2">
                  {reading.annual_pillars.slice(0, 12).map((ap, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <span className="text-xs text-muted-foreground">{ap.year}</span>
                      <span style={{ color: getCharColor(ap.stem) }}>
                        {ap.stem}
                      </span>
                      <span style={{ color: getCharColor(ap.branch) }}>
                        {ap.branch}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
          )}
        </TabsContent>

        {/* Tab 2: Geju / ShenSha / XingChong */}
        <TabsContent value="geju" className="mt-4 space-y-4">
          {/* Geju analysis */}
          {reading.geju ? (
            <Card className="border border-border bg-card/60 backdrop-blur-md">
              <CardHeader className="pb-0">
                <CardTitle className="text-foreground">
                  格局: {reading.geju.geju_type}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {reading.geju.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground">喜用神:</span>
                  {reading.geju.favorable_elements.map((el, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="text-xs"
                      style={{
                        backgroundColor: `${getElementColor(el)}15`,
                        color: getElementColor(el),
                        borderColor: `${getElementColor(el)}30`,
                      }}
                    >
                      {el}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground">忌神:</span>
                  {reading.geju.unfavorable_elements.map((el, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="text-xs"
                      style={{
                        backgroundColor: `${getElementColor(el)}15`,
                        color: getElementColor(el),
                        borderColor: `${getElementColor(el)}30`,
                      }}
                    >
                      {el}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border bg-card/60 backdrop-blur-md">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                暂无格局分析数据
              </CardContent>
            </Card>
          )}

          {/* ShenSha list */}
          {reading.all_shensha && reading.all_shensha.length > 0 && (
            <Section title="神煞一览">
                {/* 只渲染真正有神煞的柱：空柱此前也画成带绿点的整行，
                    看起来像有内容，实际是空的。 */}
                {(() => {
                  const hits = reading.all_shensha.filter((s) => s.name?.trim());
                  if (!hits.length) {
                    return (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        此命盘四柱未见收录的神煞
                      </p>
                    );
                  }
                  return (
                    <ul className="stagger space-y-2">
                      {hits.map((ss, i) => (
                        <li
                          key={i}
                          className="surface-inset flex items-baseline gap-3 rounded-lg px-3 py-2.5"
                        >
                          <span className="shrink-0 rounded-full border border-jade/25 bg-jade/10 px-2 py-0.5 text-[11px] font-medium text-jade">
                            {ss.name}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {ss.pillar}
                          </span>
                          <span className="flex-1 text-xs leading-relaxed text-foreground/75">
                            {ss.description}
                          </span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </Section>
          )}

          {/* XingChong */}
          {reading.xingchong && reading.xingchong.length > 0 && (
            <Section title="刑冲合害">
                <div className="flex flex-wrap gap-2">
                  {reading.xingchong.map((xc, i) => (
                    <Badge
                      key={i}
                      variant="destructive"
                      className="bg-crimson/10 text-crimson border-crimson/30 text-xs"
                    >
                      {xc}
                    </Badge>
                  ))}
                </div>
              </Section>
          )}
        </TabsContent>

        {/* Tab 3: Wuxing detail breakdown */}
        <TabsContent value="wuxing" className="mt-4 space-y-4">
          <Section title="五行精算">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-3 py-2 text-left">五行</th>
                      <th className="px-3 py-2 text-left">力量</th>
                      <th className="px-3 py-2 text-left">占比</th>
                      <th className="px-3 py-2 text-left">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["金", "木", "水", "火", "土"] as const).map((el) => {
                      const val = wuxingPower[el] ?? 0;
                      const total =
                        Object.values(wuxingPower).reduce((a, b) => a + b, 0) ||
                        1;
                      const pct = ((val / total) * 100).toFixed(1);
                      const color = getElementColor(el);
                      const isFavorable =
                        reading.favorable_elements?.includes(el);
                      const isUnfavorable =
                        reading.unfavorable_elements?.includes(el);

                      return (
                        <tr
                          key={el}
                          className="border-b border-border/50"
                        >
                          <td className="px-3 py-2">
                            <span
                              className="text-lg font-bold"
                              style={{ color }}
                            >
                              {el}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{val}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-border">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: color,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {pct}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {isFavorable && (
                              <Badge
                                variant="secondary"
                                className="bg-jade/15 text-jade border-jade/30 text-xs"
                              >
                                喜用
                              </Badge>
                            )}
                            {isUnfavorable && (
                              <Badge
                                variant="destructive"
                                className="bg-crimson/10 text-crimson border-crimson/30 text-xs"
                              >
                                忌神
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>

          {/* Ten gods overview */}
          {reading.ten_gods?.length > 0 && (
            <Section title="十神一览">
                <div className="flex flex-wrap gap-2">
                  {reading.ten_gods.map((tg, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <span
                        className="font-bold"
                        style={{ color: getElementColor(tg.element) }}
                      >
                        {tg.character}
                      </span>
                      <span className="text-xs text-muted-foreground">{tg.name}</span>
                      {tg.is_favorable ? (
                        <Badge
                          variant="secondary"
                          className="bg-jade/15 text-jade border-jade/30 text-[10px]"
                        >
                          吉
                        </Badge>
                      ) : (
                        <Badge
                          variant="destructive"
                          className="bg-crimson/10 text-crimson border-crimson/30 text-[10px]"
                        >
                          凶
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
          )}

          {/* Favorable / Unfavorable summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <Section title="喜用神">
                <div className="flex flex-wrap gap-2">
                  {(reading.favorable_elements ?? []).map((el, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      style={{
                        backgroundColor: `${getElementColor(el)}15`,
                        color: getElementColor(el),
                        borderColor: `${getElementColor(el)}30`,
                      }}
                    >
                      {el}
                    </Badge>
                  ))}
                  {(!reading.favorable_elements ||
                    reading.favorable_elements.length === 0) && (
                    <span className="text-xs text-muted-foreground">暂无数据</span>
                  )}
                </div>
              </Section>
            <Section title="忌神">
                <div className="flex flex-wrap gap-2">
                  {(reading.unfavorable_elements ?? []).map((el, i) => (
                    <Badge
                      key={i}
                      variant="destructive"
                      style={{
                        backgroundColor: `${getElementColor(el)}15`,
                        color: getElementColor(el),
                        borderColor: `${getElementColor(el)}30`,
                      }}
                    >
                      {el}
                    </Badge>
                  ))}
                  {(!reading.unfavorable_elements ||
                    reading.unfavorable_elements.length === 0) && (
                    <span className="text-xs text-muted-foreground">暂无数据</span>
                  )}
                </div>
              </Section>
          </div>

          {/* Summary */}
          {reading.summary && (
            <Section title="命理总论">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {reading.summary}
                </p>
              </Section>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
