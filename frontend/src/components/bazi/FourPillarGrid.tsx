/**
 * FourPillarGrid -- responsive 4-column grid of PillarCards
 * that renders the full Bazi chart (年柱、月柱、日柱、时柱).
 */

import PillarCard from "./PillarCard";
import type { BaziReading } from "@/types/bazi";

// ── Props ─────────────────────────────────────────────────────────

export interface FourPillarGridProps {
  /** Full Bazi reading from the API. */
  reading: BaziReading;
  /** Whether to show professional-mode fields. */
  isProfessional?: boolean;
}

// ── Pillar config ──────────────────────────────────────────────────

const PILLAR_KEYS = [
  { key: "year", label: "年柱", sublabel: "祖业" },
  { key: "month", label: "月柱", sublabel: "父母" },
  { key: "day", label: "日柱", sublabel: "己身" },
  { key: "hour", label: "时柱", sublabel: "子息" },
] as const;

// ── Component ─────────────────────────────────────────────────────

export default function FourPillarGrid({
  reading,
  isProfessional = false,
}: FourPillarGridProps) {
  const { chart, pillar_annotations } = reading;

  // Map pillar key to chart data
  const pillars = {
    year: chart.year_pillar,
    month: chart.month_pillar,
    day: chart.day_pillar,
    hour: chart.hour_pillar,
  };

  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
      {PILLAR_KEYS.map(({ key, label, sublabel }) => {
        const p = pillars[key];
        const ann = pillar_annotations?.[key];

        return (
          <PillarCard
            key={key}
            label={label}
            sublabel={sublabel}
            stem={p.stem}
            branch={p.branch}
            hiddenStems={p.hidden_stems}
            tenGodGan={ann?.ten_god_gan}
            tenGodZhi={ann?.ten_god_zhi}
            nayin={ann?.nayin ?? p.nayin}
            shensha={ann?.shensha}
            dishi={ann?.dishi}
            xunkong={ann?.xunkong}
            isProfessional={isProfessional}
            isDayPillar={key === "day"}
          />
        );
      })}
    </div>
  );
}
