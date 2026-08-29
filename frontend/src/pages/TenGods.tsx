/**
 * Ten Gods page (十神).
 * Displays the ten gods for the current chart with explanations
 * of their meaning and relationship to the Day Master.
 */

import { useMemo } from "react";
import { PageHeader, Section, EmptyState } from "@/components/layout/Page";
import { useBaziStore } from "@/stores/useBaziStore";
import { getElementColor } from "@/lib/wuxing-colors";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/** Explanations for each Ten God name. */
const TEN_GOD_EXPLANATIONS: Record<string, string> = {
  比肩:
    "比肩代表同我之物，主独立、自主、竞争。比肩旺者性格刚强，有主见，但易与人争。",
  劫财:
    "劫财代表同我之异性，主社交、义气、破耗。劫财旺者善交际，但钱财易聚易散。",
  食神:
    "食神代表我生之同性，主才华、口福、悠闲。食神旺者才华横溢，心态乐观，享乐人生。",
  伤官:
    "伤官代表我生之异性，主聪明、叛逆、创新。伤官旺者思维敏捷，不拘常规，但也易得罪人。",
  偏财:
    "偏财代表我克之异性，主横财、人缘、慷慨。偏财旺者财运好，出手大方，异性缘佳。",
  正财:
    "正财代表我克之同性，主正当收入、勤俭、务实。正财旺者脚踏实地，理财有道，但易吝啬。",
  七杀:
    "七杀代表克我之异性，主权力、压力、魄力。七杀旺者有领导才能，但压力大，需食神制杀。",
  正官:
    "正官代表克我之同性，主规矩、名声、地位。正官旺者品行端正，有官运，但过于循规蹈矩。",
  偏印:
    "偏印代表生我之异性，主偏门学问、孤僻、灵感。偏印旺者悟性高，好钻研偏门，但性格怪异。",
  正印:
    "正印代表生我之同性，主学业、慈爱、贵人。正印旺者有学问，受长辈疼爱，但易依赖他人。",
};

export default function TenGods() {
  const reading = useBaziStore((s) => s.reading);

  /* ── Map ten gods to their pillars ────────────────────────────── */
  const pillarGods = useMemo(() => {
    if (!reading) return [];

    const chart = reading.chart;
    const gods = reading.ten_gods;

    // Map each pillar to its ten god information.
    const pillars = [
      { label: "年柱", pillar: chart.year_pillar },
      { label: "月柱", pillar: chart.month_pillar },
      { label: "日柱", pillar: chart.day_pillar },
      { label: "时柱", pillar: chart.hour_pillar },
    ];

    return pillars.map((p, i) => {
      // The ten_gods array may have entries for stem and branch of each pillar.
      // We try to match by character.
      const stemGod = gods.find(
        (g) => g.character === p.pillar.stem
      );
      const branchGod = gods.find(
        (g) => g.character === p.pillar.branch
      );

      // Also check pillar_annotations if available.
      const annotations = reading.pillar_annotations;
      const key = ["year", "month", "day", "hour"][i];
      const ann = annotations?.[key];

      return {
        label: p.label,
        pillar: p.pillar,
        stemTenGod: stemGod?.name ?? ann?.ten_god_gan ?? "—",
        branchTenGod: branchGod?.name ?? ann?.ten_god_zhi ?? "—",
        stemGod,
        branchGod,
        isDayMaster: i === 2, // Day pillar is the Day Master
      };
    });
  }, [reading]);

  /* ── Collect unique ten gods with their details ───────────────── */
  const uniqueGods = useMemo(() => {
    if (!reading) return [];
    const seen = new Set<string>();
    const result: Array<{
      name: string;
      element: string;
      isFavorable: boolean;
      explanation: string;
    }> = [];

    for (const god of reading.ten_gods) {
      if (!seen.has(god.name)) {
        seen.add(god.name);
        result.push({
          name: god.name,
          element: god.element,
          isFavorable: god.is_favorable,
          explanation: TEN_GOD_EXPLANATIONS[god.name] ?? "暂无解释。",
        });
      }
    }

    // If we have no ten_gods from API, derive from annotations.
    if (result.length === 0 && reading.pillar_annotations) {
      for (const key of ["year", "month", "day", "hour"]) {
        const ann = reading.pillar_annotations[key];
        if (ann) {
          for (const godName of [ann.ten_god_gan, ann.ten_god_zhi]) {
            if (godName && !seen.has(godName)) {
              seen.add(godName);
              result.push({
                name: godName,
                element: "",
                isFavorable: true,
                explanation: TEN_GOD_EXPLANATIONS[godName] ?? "暂无解释。",
              });
            }
          }
        }
      }
    }

    return result;
  }, [reading]);

  /* ── No data state ────────────────────────────────────────────── */
  if (!reading) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="十神" en="Ten Gods" description="日主与其余干支的生克关系及其含义" />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="十神" en="Ten Gods" description="日主与其余干支的生克关系及其含义" />

      {/* ── Pillar-to-Ten-God mapping ───────────────────────────── */}
      <Section
        title="四柱十神"
        description={`日主 ${reading.chart.day_master}（${reading.chart.day_master_element}）`}
      >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pillarGods.map((pg) => (
              <div
                key={pg.label}
                className={`rounded-lg border p-4 ${
                  pg.isDayMaster
                    ? "border-gold/50 bg-gold/5"
                    : "border-border bg-background/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {pg.label}
                  </span>
                  {pg.isDayMaster && (
                    <Badge variant="default" className="text-[10px]">
                      日主
                    </Badge>
                  )}
                </div>
                {/* Stem and branch with ten god labels */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xl font-heading font-bold"
                      style={{ color: getElementColor(pg.pillar.element) }}
                    >
                      {pg.pillar.stem}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {pg.stemTenGod}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xl font-heading font-bold"
                      style={{ color: getElementColor(pg.pillar.element) }}
                    >
                      {pg.pillar.branch}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {pg.branchTenGod}
                    </Badge>
                  </div>
                </div>
                {/* Hidden stems */}
                {pg.pillar.hidden_stems && pg.pillar.hidden_stems.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    藏干: {pg.pillar.hidden_stems.join(" ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>

      {/* ── Detailed explanations ───────────────────────────────── */}
      <Section title="十神详解" description="命中出现的十神及其含义">
          {uniqueGods.length > 0 ? (
            <div className="space-y-4">
              {uniqueGods.map((god, i) => (
                <div key={god.name}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      <Badge
                        variant={god.isFavorable ? "default" : "destructive"}
                        className="text-sm px-3 py-1"
                      >
                        {god.name}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      {god.element && (
                        <p className="text-sm text-muted-foreground mb-1">
                          五行:{" "}
                          <span style={{ color: getElementColor(god.element) }}>
                            {god.element}
                          </span>
                          {god.isFavorable ? "（喜）" : "（忌）"}
                        </p>
                      )}
                      <p className="text-sm text-foreground leading-relaxed">
                        {god.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              暂无十神数据。请确保已进行排盘计算。
            </p>
          )}
        </Section>
    </div>
  );
}
