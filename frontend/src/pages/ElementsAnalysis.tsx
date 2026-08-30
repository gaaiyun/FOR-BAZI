/**
 * Five Elements Analysis page (五行).
 * Displays radar chart, bar chart, and detailed breakdown of element power.
 * Includes strong/weak assessment with explanation.
 */

import { useMemo } from "react";
import { PageHeader, Section, EmptyState } from "@/components/layout/Page";
import { useBaziStore } from "@/stores/useBaziStore";
import { ELEMENT_COLORS } from "@/lib/wuxing-colors";
import type { WuxingPower } from "@/types/bazi";
import WuxingRadar from "@/components/bazi/WuxingRadar";
import WuxingBar from "@/components/bazi/WuxingBar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const ELEMENTS = ["金", "木", "水", "火", "土"] as const;

/** English labels for elements. */
const ELEMENT_EN: Record<string, string> = {
  金: "Metal",
  木: "Wood",
  水: "Water",
  火: "Fire",
  土: "Earth",
};

/**
 * Determine which pillars contribute to each element.
 * Returns a map of element -> list of pillar labels.
 */
function getSourcePillars(
  reading: NonNullable<ReturnType<typeof useBaziStore.getState>["reading"]>
): Record<string, string[]> {
  const sources: Record<string, string[]> = { 金: [], 木: [], 水: [], 火: [], 土: [] };
  const pillarLabels = ["年柱", "月柱", "日柱", "时柱"] as const;
  const pillars = [
    reading.chart.year_pillar,
    reading.chart.month_pillar,
    reading.chart.day_pillar,
    reading.chart.hour_pillar,
  ];

  pillars.forEach((p, i) => {
    if (sources[p.element]) {
      sources[p.element].push(pillarLabels[i]);
    }
    // Hidden stems also count toward the pillar's element.
    // (Simplified: attribute hidden stems to the same element as the pillar.)
  });

  return sources;
}

/**
 * Calculate total power as percentage.
 */
function toPercentages(
  balance: Record<string, number>
): Record<string, number> {
  const total = Object.values(balance).reduce((s, v) => s + v, 0);
  if (total === 0) return { 金: 20, 木: 20, 水: 20, 火: 20, 土: 20 };
  const result: Record<string, number> = {};
  for (const el of ELEMENTS) {
    result[el] = ((balance[el] ?? 0) / total) * 100;
  }
  return result;
}

export default function ElementsAnalysis() {
  const reading = useBaziStore((s) => s.reading);

  /* ── Derive element data ──────────────────────────────────────── */
  const elementData = useMemo(() => {
    if (!reading) return null;

    // Use wuxing_power if available; otherwise fall back to element_balance.
    const raw: WuxingPower = reading.wuxing_power ?? {
      金: reading.element_balance.金,
      木: reading.element_balance.木,
      水: reading.element_balance.水,
      火: reading.element_balance.火,
      土: reading.element_balance.土,
    };
    const percentages = toPercentages(raw as unknown as Record<string, number>);
    const sources = getSourcePillars(reading);

    // Determine strongest and weakest elements.
    const sorted = [...ELEMENTS].sort(
      (a, b) => (percentages[b] ?? 0) - (percentages[a] ?? 0)
    );
    const strongest = sorted[0];
    const weakest = sorted[sorted.length - 1];

    return { raw, percentages, sources, strongest, weakest };
  }, [reading]);

  /* ── No data state ────────────────────────────────────────────── */
  if (!reading || !elementData) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="五行" en="Five Elements" description="含藏干、月令加权与十二长生的力量精算" />
        <EmptyState />
      </div>
    );
  }

  const { raw, percentages, sources, strongest, weakest } = elementData;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="五行" en="Five Elements" description="含藏干、月令加权与十二长生的力量精算" />

      {/* ── Strong/Weak Assessment ──────────────────────────────── */}
      <Section
        title="强弱评估"
        description={`日主 ${reading.chart.day_master}（${reading.chart.day_master_element}）`}
      >
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">最强:</span>
              <Badge
                variant="secondary"
                className="text-sm"
                style={{
                  backgroundColor: ELEMENT_COLORS[strongest] + "30",
                  color: ELEMENT_COLORS[strongest],
                  borderColor: ELEMENT_COLORS[strongest] + "60",
                }}
              >
                {strongest} ({ELEMENT_EN[strongest]})
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">最弱:</span>
              <Badge
                variant="secondary"
                className="text-sm"
                style={{
                  backgroundColor: ELEMENT_COLORS[weakest] + "30",
                  color: ELEMENT_COLORS[weakest],
                  borderColor: ELEMENT_COLORS[weakest] + "60",
                }}
              >
                {weakest} ({ELEMENT_EN[weakest]})
              </Badge>
            </div>
          </div>
          {reading.strengths && reading.strengths.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-sm font-medium text-foreground">优势:</p>
              {reading.strengths.map((s, i) => (
                <p key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-jade/40">
                  {s}
                </p>
              ))}
            </div>
          )}
          {reading.weaknesses && reading.weaknesses.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-sm font-medium text-foreground">不足:</p>
              {reading.weaknesses.map((w, i) => (
                <p key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-crimson/40">
                  {w}
                </p>
              ))}
            </div>
          )}
        </Section>

      {/* ── Charts Row ──────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="五行雷达图" description="五行力量分布总览">
            <WuxingRadar wuxingPower={raw} dayMasterElement={reading.chart.day_master_element} />
          </Section>

        <Section title="五行力量柱状图" description="各元素力量百分比">
            <WuxingBar wuxingPower={raw} dayMasterElement={reading.chart.day_master_element} />
          </Section>
      </div>

      {/* ── Detailed Breakdown ──────────────────────────────────── */}
      <Section title="五行详解" description="每个元素的来源与力量占比">
          <div className="space-y-4">
            {ELEMENTS.map((el, i) => (
              <div key={el}>
                {i > 0 && <Separator className="mb-4" />}
                <div className="flex items-start gap-4">
                  {/* Element icon / label */}
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xl font-bold font-heading"
                    style={{
                      backgroundColor: ELEMENT_COLORS[el] + "20",
                      color: ELEMENT_COLORS[el],
                      border: `1px solid ${ELEMENT_COLORS[el]}40`,
                    }}
                  >
                    {el}
                  </div>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-medium text-foreground">
                        {el} · {ELEMENT_EN[el]}
                      </h3>
                      <span className="text-sm font-mono" style={{ color: ELEMENT_COLORS[el] }}>
                        {percentages[el]?.toFixed(1)}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, percentages[el] ?? 0)}%`,
                          backgroundColor: ELEMENT_COLORS[el],
                        }}
                      />
                    </div>
                    {/* Sources */}
                    <p className="mt-2 text-xs text-muted-foreground">
                      来源:{" "}
                      {sources[el] && sources[el].length > 0
                        ? sources[el].join("、")
                        : "无直接来源"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

      {/* ── Favorable / Unfavorable ─────────────────────────────── */}
      {(reading.favorable_elements?.length > 0 ||
        reading.unfavorable_elements?.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          {reading.favorable_elements?.length > 0 && (
            <Section title="喜用神" description="有利的五行元素">
                <div className="flex flex-wrap gap-2">
                  {reading.favorable_elements.map((el) => (
                    <Badge
                      key={el}
                      variant="secondary"
                      className="text-sm"
                      style={{
                        backgroundColor: ELEMENT_COLORS[el] + "30",
                        color: ELEMENT_COLORS[el],
                        borderColor: ELEMENT_COLORS[el] + "60",
                      }}
                    >
                      {el}
                    </Badge>
                  ))}
                </div>
              </Section>
          )}
          {reading.unfavorable_elements?.length > 0 && (
            <Section title="忌神" description="不利的五行元素">
                <div className="flex flex-wrap gap-2">
                  {reading.unfavorable_elements.map((el) => (
                    <Badge
                      key={el}
                      variant="secondary"
                      className="text-sm"
                      style={{
                        backgroundColor: ELEMENT_COLORS[el] + "30",
                        color: ELEMENT_COLORS[el],
                        borderColor: ELEMENT_COLORS[el] + "60",
                      }}
                    >
                      {el}
                    </Badge>
                  ))}
                </div>
              </Section>
          )}
        </div>
      )}
    </div>
  );
}
