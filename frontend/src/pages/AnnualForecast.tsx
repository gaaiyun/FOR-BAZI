/**
 * Annual Forecast page (流年).
 * Displays the current year's ganzhi, its interaction with the natal chart,
 * and key events/predictions derived from the chart data.
 */

import { useMemo } from "react";
import { PageHeader, Section, EmptyState } from "@/components/layout/Page";
import { useBaziStore } from "@/stores/useBaziStore";
import { getCharColor } from "@/lib/wuxing-colors";
import type { BaziChart } from "@/types/bazi";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Current year. */
const CURRENT_YEAR = new Date().getFullYear();

/**
 * Derive interaction descriptions between the annual pillar and natal chart.
 * This is a simplified heuristic; the backend provides richer data.
 */
function getInteractions(
  annual: { stem: string; branch: string; element: string },
  chart: BaziChart
): string[] {
  const interactions: string[] = [];
  const dayMasterEl = (chart as BaziChart).day_master_element;

  // Element interaction with Day Master.
  const productive: Record<string, string> = {
    金: "水", 水: "木", 木: "火", 火: "土", 土: "金",
  };
  const destructive: Record<string, string> = {
    金: "木", 木: "土", 土: "水", 水: "火", 火: "金",
  };

  if (annual.element === dayMasterEl) {
    interactions.push(`流年天干${annual.stem}与日主同属${annual.element}，比和之年，主竞争与合作并存。`);
  } else if (productive[dayMasterEl] === annual.element) {
    interactions.push(`流年${annual.element}生助日主${dayMasterEl}，为印绶之年，利学业与贵人。`);
  } else if (productive[annual.element] === dayMasterEl) {
    interactions.push(`日主${dayMasterEl}生流年${annual.element}，为食伤之年，利创作表达与子女。`);
  } else if (destructive[dayMasterEl] === annual.element) {
    interactions.push(`日主${dayMasterEl}克流年${annual.element}，为财星之年，利求财与感情。`);
  } else if (destructive[annual.element] === dayMasterEl) {
    interactions.push(`流年${annual.element}克日主${dayMasterEl}，为官杀之年，主压力与权力变动。`);
  }

  // Branch interactions with natal branches (simplified).
  const natalBranches = [
    chart.year_pillar.branch,
    chart.month_pillar.branch,
    chart.day_pillar.branch,
    chart.hour_pillar.branch,
  ];
  const pillarNames = ["年支", "月支", "日支", "时支"];

  natalBranches.forEach((nb, i) => {
    if (annual.branch === nb) {
      interactions.push(`流年地支${annual.branch}与${pillarNames[i]}${nb}相同，伏吟之象，主反复变动。`);
    }
  });

  return interactions;
}

export default function AnnualForecast() {
  const reading = useBaziStore((s) => s.reading);

  /* ── Find current year's annual pillar ────────────────────────── */
  const currentAnnual = useMemo(() => {
    if (!reading) return null;
    return reading.annual_pillars.find((ap) => ap.year === CURRENT_YEAR) ?? null;
  }, [reading]);

  /* ── Get nearby years (5 before, 5 after) ─────────────────────── */
  const nearbyYears = useMemo(() => {
    if (!reading) return [];
    return reading.annual_pillars
      .filter(
        (ap) => ap.year >= CURRENT_YEAR - 5 && ap.year <= CURRENT_YEAR + 5
      )
      .map((ap) => ({
        ...ap,
        isCurrent: ap.year === CURRENT_YEAR,
        stemColor: getCharColor(ap.stem),
        branchColor: getCharColor(ap.branch),
      }));
  }, [reading]);

  /* ── Interactions for current year ────────────────────────────── */
  const interactions = useMemo(() => {
    if (!currentAnnual || !reading) return [];
    return getInteractions(currentAnnual, reading.chart);
  }, [currentAnnual, reading]);

  /* ── Derive predictions from favorable/unfavorable elements ───── */
  const predictions = useMemo(() => {
    if (!currentAnnual || !reading) return [];
    const preds: string[] = [];
    const el = currentAnnual.element;

    if (reading.favorable_elements?.includes(el)) {
      preds.push(`流年五行${el}为喜用神，今年运势整体向好，把握机遇。`);
    } else if (reading.unfavorable_elements?.includes(el)) {
      preds.push(`流年五行${el}为忌神，今年需谨慎行事，防小人与破财。`);
    } else {
      preds.push(`流年五行${el}对命局影响中性，运势平稳。`);
    }

    // Strengths and weaknesses context.
    if (reading.strengths?.length > 0) {
      preds.push(`命局优势: ${reading.strengths[0]}`);
    }
    if (reading.weaknesses?.length > 0) {
      preds.push(`命局注意: ${reading.weaknesses[0]}`);
    }

    return preds;
  }, [currentAnnual, reading]);

  /* ── No data state ────────────────────────────────────────────── */
  if (!reading) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="流年" en="Annual Forecast" description="逐年干支与当年运势，可切换大运区间" />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="流年" en="Annual Forecast" description="逐年干支与当年运势，可切换大运区间" />

      {/* ── Current Year Highlight ──────────────────────────────── */}
      {currentAnnual && (
        <Card className="bg-card/60 border-gold/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground text-xl">
                  {CURRENT_YEAR} 年流年
                </CardTitle>
                <CardDescription>今年的流年运势分析</CardDescription>
              </div>
              <div className="text-right">
                <span
                  className="text-4xl font-heading font-bold"
                  style={{ color: getCharColor(currentAnnual.stem) }}
                >
                  {currentAnnual.stem}
                </span>
                <span
                  className="text-4xl font-heading font-bold"
                  style={{ color: getCharColor(currentAnnual.branch) }}
                >
                  {currentAnnual.branch}
                </span>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentAnnual.element}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Interactions */}
              {interactions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">
                    命局互动
                  </h3>
                  <div className="space-y-2">
                    {interactions.map((text, i) => (
                      <p
                        key={i}
                        className="text-sm text-muted-foreground pl-3 border-l-2 border-gold/40"
                      >
                        {text}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Predictions */}
              {predictions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">
                    运势提示
                  </h3>
                  <div className="space-y-2">
                    {predictions.map((text, i) => (
                      <p
                        key={i}
                        className="text-sm text-muted-foreground pl-3 border-l-2 border-jade/40"
                      >
                        {text}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Nearby Years Grid ───────────────────────────────────── */}
      <Section
        title="近十年流年"
        description={`${CURRENT_YEAR - 5} 至 ${CURRENT_YEAR + 5} 年流年干支一览`}
      >
          {nearbyYears.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {nearbyYears.map((ny) => (
                <div
                  key={ny.year}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    ny.isCurrent
                      ? "border-gold/60 bg-gold/10"
                      : "border-border bg-background/60"
                  }`}
                >
                  <span
                    className={`text-sm font-medium min-w-[3.5rem] ${
                      ny.isCurrent ? "text-gold" : "text-muted-foreground"
                    }`}
                  >
                    {ny.year}
                  </span>
                  <span className="text-lg font-heading">
                    <span style={{ color: ny.stemColor }}>{ny.stem}</span>
                    <span style={{ color: ny.branchColor }}>{ny.branch}</span>
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {ny.element}
                  </span>
                  {ny.isCurrent && (
                    <Badge variant="default" className="text-[10px]">
                      今年
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无流年数据</p>
          )}
        </Section>

      {/* ── Summary from reading ────────────────────────────────── */}
      {reading.summary && (
        <Section title="命理总论" description="综合命局分析摘要">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {reading.summary}
            </p>
          </Section>
      )}
    </div>
  );
}
