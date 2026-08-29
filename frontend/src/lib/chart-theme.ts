/**
 * ECharts 统一主题。
 *
 * 默认调色板（红绿蓝灰黄）跟这个应用的领域毫无关系，几张图各用各的，
 * 是页面显得廉价的主要原因。这里把颜色收敛到已有的五行色板，
 * 并统一网格、坐标轴、字体与 tooltip 的观感。
 *
 * 用法：`<ReactECharts option={withTheme(option)} />`
 */

export const WUXING_SERIES = ["#c0c0c0", "#50c878", "#4a90d9", "#e94560", "#d4af37"];

const INK = {
  text: "#e6edf3",
  muted: "#8b949e",
  line: "#30363d",
  surface: "#161b22",
};

const AXIS = {
  axisLine: { lineStyle: { color: INK.line } },
  axisTick: { show: false },
  axisLabel: { color: INK.muted, fontSize: 11 },
  splitLine: { lineStyle: { color: INK.line, opacity: 0.35, type: "dashed" as const } },
};

type Opt = Record<string, unknown>;

/** 把主题合并进 option；调用方已显式设置的字段一律保留。 */
export function withTheme(option: Opt): Opt {
  const merge = (base: Opt, over: unknown): Opt =>
    typeof over === "object" && over !== null && !Array.isArray(over)
      ? { ...base, ...(over as Opt) }
      : base;

  return {
    backgroundColor: "transparent",
    color: WUXING_SERIES,
    textStyle: {
      fontFamily: "'Noto Serif SC', 'Geist Variable', serif",
      color: INK.text,
    },
    ...option,
    grid: merge({ left: 56, right: 24, top: 24, bottom: 32, containLabel: true }, option.grid),
    tooltip: merge(
      {
        backgroundColor: INK.surface,
        borderColor: INK.line,
        borderWidth: 1,
        textStyle: { color: INK.text, fontSize: 12 },
        extraCssText: "border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.45);",
      },
      option.tooltip
    ),
    xAxis: Array.isArray(option.xAxis)
      ? option.xAxis.map((a) => merge(AXIS, a))
      : merge(AXIS, option.xAxis),
    yAxis: Array.isArray(option.yAxis)
      ? option.yAxis.map((a) => merge(AXIS, a))
      : merge(AXIS, option.yAxis),
  };
}
