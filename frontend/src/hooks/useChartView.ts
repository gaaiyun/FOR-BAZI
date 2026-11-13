import { useMemo } from "react";
import { useBaziStore } from "@/stores/useBaziStore";
import { deriveChart, type ChartView } from "@/lib/chart-view";
import type { BaziReading } from "@/types/bazi";

/** 当前命盘及其展示模型。未排盘时两者都是 null。 */
export function useChartView(): { reading: BaziReading | null; view: ChartView | null } {
  const reading = useBaziStore((s) => s.reading);
  const view = useMemo(() => (reading ? deriveChart(reading) : null), [reading]);
  return { reading, view };
}
