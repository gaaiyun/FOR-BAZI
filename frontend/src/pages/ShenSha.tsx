/**
 * Shen Sha Stars page (神煞).
 * Lists all shensha from the current chart, grouped by pillar.
 * Each shensha shows its name and brief description.
 */

import { useMemo } from "react";
import { PageHeader, Section, EmptyState } from "@/components/layout/Page";
import { useBaziStore } from "@/stores/useBaziStore";
import { getElementColor } from "@/lib/wuxing-colors";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Descriptions for common Shen Sha stars. */
const SHENSHA_DESCRIPTIONS: Record<string, string> = {
  天乙贵人:
    "天乙贵人是最大的吉神，主逢凶化吉、贵人相助。命带天乙贵人者一生多得贵人扶持。",
  文昌贵人:
    "文昌贵人主聪明好学、才华出众。命带文昌者学业有成，适合从事文化教育工作。",
  驿马:
    "驿马主奔波走动、迁移变动。命带驿马者一生多外出机会，适合流动性强的工作。",
  华盖:
    "华盖主孤高聪慧、艺术天赋。命带华盖者有宗教或艺术倾向，但性格较孤僻。",
  桃花:
    "桃花主异性缘、风流才情。命带桃花者异性缘佳，但也需防感情纠纷。",
  将星:
    "将星主权贵、领导才能。命带将星者有组织管理能力，适合当领导。",
  金舆:
    "金舆主富贵、享受。命带金舆者生活条件优越，有车有房。",
  天德:
    "天德是吉神，主仁慈、逢凶化吉。命带天德者心地善良，一生平安。",
  月德:
    "月德是吉神，主阴德、贵人。命带月德者有暗中贵人相助，化险为夷。",
  天医:
    "天医主健康、医药。命带天医者适合从事医疗行业，自身健康状况良好。",
  天喜:
    "天喜主喜庆、婚姻。命带天喜者喜事连连，婚姻美满。",
  红鸾:
    "红鸾主婚姻、恋爱。命带红鸾者桃花运旺，易有婚恋之喜。",
  孤辰:
    "孤辰主孤独、独立。命带孤辰者性格独立，但六亲缘薄。",
  寡宿:
    "寡宿主孤寡、寂寞。命带寡宿者婚姻感情方面较波折。",
  劫煞:
    "劫煞主劫难、破财。命带劫煞者需防意外灾祸和钱财损失。",
  亡神:
    "亡主虚耗、失物。命带亡神者需防财物丢失和小人暗算。",
  羊刃:
    "羊刃主刚烈、血光。命带羊刃者性格刚强，需防手术刀伤。",
  禄神:
    "禄神主俸禄、财富。命带禄神者衣食无忧，有正当收入来源。",
  天罗地网:
    "天罗地网主困顿、阻碍。命带天罗地网者运程多阻，需耐心化解。",
  空亡:
    "空亡主虚无、不实。逢空亡者该柱所代表的六亲缘薄或事多不顺。",
};

/** Pillar display info. */
const PILLAR_GROUPS = [
  { key: "年柱", label: "年柱", sublabel: "Year Pillar" },
  { key: "月柱", label: "月柱", sublabel: "Month Pillar" },
  { key: "日柱", label: "日柱", sublabel: "Day Pillar" },
  { key: "时柱", label: "时柱", sublabel: "Hour Pillar" },
] as const;

export default function ShenSha() {
  const reading = useBaziStore((s) => s.reading);

  /* ── Collect shensha grouped by pillar ────────────────────────── */
  const shenshaByGroup = useMemo(() => {
    if (!reading) return {};

    const groups: Record<string, Array<{ name: string; description: string }>> = {
      "年柱": [],
      "月柱": [],
      "日柱": [],
      "时柱": [],
    };

    // Method 1: From all_shensha field.
    if (reading.all_shensha && reading.all_shensha.length > 0) {
      for (const ss of reading.all_shensha) {
        const pillarKey = ss.pillar as keyof typeof groups;
        if (groups[pillarKey]) {
          groups[pillarKey].push({
            name: ss.name,
            description: ss.description || (SHENSHA_DESCRIPTIONS[ss.name] ?? "暂无描述。"),
          });
        }
      }
    }

    // Method 2: From pillar_annotations.shensha arrays.
    if (reading.pillar_annotations) {
      const keys = ["year", "month", "day", "hour"] as const;
      const pillarLabels = ["年柱", "月柱", "日柱", "时柱"] as const;

      keys.forEach((key, i) => {
        const ann = reading.pillar_annotations?.[key];
        if (ann?.shensha && Array.isArray(ann.shensha)) {
          for (const name of ann.shensha) {
            // Avoid duplicates.
            const exists = groups[pillarLabels[i]].some((s) => s.name === name);
            if (!exists) {
              groups[pillarLabels[i]].push({
                name,
                description: SHENSHA_DESCRIPTIONS[name] ?? "暂无描述。",
              });
            }
          }
        }
      });
    }

    return groups;
  }, [reading]);

  /* ── Count total shensha ──────────────────────────────────────── */
  const totalCount = useMemo(() => {
    return Object.values(shenshaByGroup).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
  }, [shenshaByGroup]);

  /* ── No data state ────────────────────────────────────────────── */
  if (!reading) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="神煞" en="Shen Sha" description="以日干、日支、年支为太极点查得的神煞" />
        <EmptyState />
      </div>
    );
  }

  /* ── Get pillar info for display ──────────────────────────────── */
  const pillarInfo = [
    { label: "年柱", pillar: reading.chart.year_pillar },
    { label: "月柱", pillar: reading.chart.month_pillar },
    { label: "日柱", pillar: reading.chart.day_pillar },
    { label: "时柱", pillar: reading.chart.hour_pillar },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="神煞" en="Shen Sha" description="以日干、日支、年支为太极点查得的神煞" />

      {/* Summary */}
      <Section title="神煞概览" description={`命盘中共有 ${totalCount} 个神煞`}>
          {totalCount > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Object.values(shenshaByGroup)
                .flat()
                .map((ss, i) => (
                  <Badge
                    key={`${ss.name}-${i}`}
                    variant="secondary"
                    className="text-xs"
                  >
                    {ss.name}
                  </Badge>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              该命盘未检测到神煞信息。
            </p>
          )}
        </Section>

      {/* ── Grouped by pillar ───────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {PILLAR_GROUPS.map((group, gi) => {
          const items = shenshaByGroup[group.key] ?? [];
          const pinfo = pillarInfo[gi];
          const elementColor = getElementColor(pinfo.pillar.element);

          return (
            <Card
              key={group.key}
              className="bg-card/60 border-border"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <span className="text-lg font-heading" style={{ color: elementColor }}>
                        {pinfo.pillar.stem}{pinfo.pillar.branch}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {group.label}
                      </span>
                    </CardTitle>
                    <CardDescription>{group.sublabel}</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {items.length} 神煞
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {items.length > 0 ? (
                  <div className="space-y-3">
                    {items.map((ss, i) => (
                      <div
                        key={`${ss.name}-${i}`}
                        className="rounded-lg border border-border bg-background/60 p-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="default" className="text-xs">
                            {ss.name}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {ss.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    该柱无神煞
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
