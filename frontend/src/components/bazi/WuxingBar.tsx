/**
 * WuxingBar -- ECharts horizontal bar chart for Five Elements power percentages.
 * Each bar is colored according to the element's traditional color.
 * Uses useMemo for options to avoid unnecessary re-renders.
 */

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { withTheme } from "@/lib/chart-theme";
import { ELEMENT_COLORS } from "@/lib/wuxing-colors";
import type { WuxingPower } from "@/types/bazi";

// ── Props ─────────────────────────────────────────────────────────

export interface WuxingBarProps {
  /** Wuxing power scores for each element. */
  wuxingPower: WuxingPower;
  /** Optional height for the chart container. Defaults to 300px. */
  height?: number;
}

// ── Constants ─────────────────────────────────────────────────────

const ELEMENTS = ["金", "木", "水", "火", "土"] as const;

// ── Component ─────────────────────────────────────────────────────

export default function WuxingBar({ wuxingPower, height = 300 }: WuxingBarProps) {
  const option = useMemo(() => {
    const values = ELEMENTS.map((el) => wuxingPower[el] ?? 0);
    const maxVal = Math.max(...values, 1);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        backgroundColor: "#161b22",
        borderColor: "#30363d",
        textStyle: { color: "#e6edf3" },
        formatter: (params: unknown) => {
          const item = Array.isArray(params) ? params[0] : null;
          if (!item || typeof item !== "object") return "";
          const p = item as { name: string; value: number };
          const total = values.reduce((a, b) => a + b, 0) || 1;
          const pct = ((p.value / total) * 100).toFixed(1);
          return `${p.name}: ${p.value} (${pct}%)`;
        },
      },
      grid: {
        left: 48,
        right: 60,
        top: 12,
        bottom: 12,
        containLabel: false,
      },
      xAxis: {
        type: "value" as const,
        max: Math.ceil(maxVal * 1.15),
        axisLabel: { color: "#8b949e" },
        splitLine: { lineStyle: { color: "#30363d", type: "dashed" as const } },
        axisLine: { show: false },
      },
      yAxis: {
        type: "category" as const,
        data: [...ELEMENTS],
        axisLabel: {
          color: "#e6edf3",
          fontSize: 14,
          fontWeight: 600,
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar" as const,
          data: ELEMENTS.map((el) => ({
            value: wuxingPower[el] ?? 0,
            itemStyle: {
              color: ELEMENT_COLORS[el],
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: 24,
          label: {
            show: true,
            position: "right" as const,
            color: "#e6edf3",
            fontSize: 12,
            formatter: (params: { value: number }) => {
              const total = values.reduce((a, b) => a + b, 0) || 1;
              const pct = ((params.value / total) * 100).toFixed(1);
              return `${params.value} (${pct}%)`;
            },
          },
        },
      ],
    };
  }, [wuxingPower]);

  return (
    <ReactECharts
      option={withTheme(option)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
    />
  );
}
