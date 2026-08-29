/**
 * WuxingRadar -- ECharts radar chart for the Five Elements (五行) power distribution.
 * Displays a pentagonal radar with one axis per element (金木水火土).
 * Uses useMemo for options to avoid unnecessary re-renders.
 */

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { withTheme } from "@/lib/chart-theme";
import { ELEMENT_COLORS } from "@/lib/wuxing-colors";
import type { WuxingPower } from "@/types/bazi";

// ── Props ─────────────────────────────────────────────────────────

export interface WuxingRadarProps {
  /** Wuxing power scores for each element. */
  wuxingPower: WuxingPower;
  /** Optional height for the chart container. Defaults to 360px. */
  height?: number;
}

// ── Constants ─────────────────────────────────────────────────────

const ELEMENTS = ["金", "木", "水", "火", "土"] as const;

// ── Component ─────────────────────────────────────────────────────

export default function WuxingRadar({ wuxingPower, height = 360 }: WuxingRadarProps) {
  const option = useMemo(() => {
    const values = ELEMENTS.map((el) => wuxingPower[el] ?? 0);
    const maxVal = Math.max(...values, 1) * 1.2;

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item" as const,
        backgroundColor: "#161b22",
        borderColor: "#30363d",
        textStyle: { color: "#e6edf3" },
        formatter: (params: { value: number[] }) => {
          if (!params.value) return "";
          const lines = ELEMENTS.map(
            (el, i) =>
              `<span style="color:${ELEMENT_COLORS[el]}">●</span> ${el}: ${params.value[i]}`
          );
          return lines.join("<br/>");
        },
      },
      radar: {
        indicator: ELEMENTS.map((el) => ({
          name: el,
          max: maxVal,
        })),
        shape: "polygon" as const,
        splitNumber: 4,
        axisName: {
          color: "#e6edf3",
          fontSize: 14,
          fontWeight: 600,
        },
        splitLine: { lineStyle: { color: "#30363d" } },
        splitArea: {
          areaStyle: {
            color: ["rgba(13,17,23,0.6)", "rgba(28,33,40,0.4)"],
          },
        },
        axisLine: { lineStyle: { color: "#30363d" } },
      },
      series: [
        {
          type: "radar" as const,
          data: [
            {
              value: values,
              name: "五行力量",
              areaStyle: {
                color: "rgba(212,175,55,0.15)",
              },
              lineStyle: {
                color: "#d4af37",
                width: 2,
              },
              itemStyle: {
                color: "#d4af37",
              },
              symbol: "circle",
              symbolSize: 6,
            },
          ],
          emphasis: {
            lineStyle: { width: 3 },
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
