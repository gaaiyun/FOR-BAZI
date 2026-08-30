/**
 * 五行雷达。
 *
 * 自绘 SVG 而非 ECharts：五个轴固定不变，需要的只是一个五边形和一条折线，
 * 但要让每个顶点用自己的五行色、并在中心标出日主——这些是默认雷达图做不到的。
 * 轴序按传统方位（金水木火土顺时针相生），而不是图表库的默认顺序。
 */

import { useMemo } from "react";
import { ELEMENT_COLORS } from "@/lib/wuxing-colors";
import type { WuxingPower, ElementBalance } from "@/types/bazi";

export interface WuxingRadarProps {
  /** 接受加权力量或计数两种来源 */
  wuxingPower: WuxingPower | ElementBalance | Record<string, number>;
  /** 日主五行，标在中心 */
  dayMasterElement?: string;
}

/** 金 → 水 → 木 → 火 → 土 顺时针，即五行相生的次序 */
const AXES = ["金", "水", "木", "火", "土"] as const;

const SIZE = 240;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 78;

function pointAt(i: number, ratio: number): [number, number] {
  const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
  return [CX + Math.cos(angle) * R * ratio, CY + Math.sin(angle) * R * ratio];
}

function colorOf(el: string): string {
  return ELEMENT_COLORS[el] ?? "var(--muted-foreground)";
}

export default function WuxingRadar({ wuxingPower, dayMasterElement }: WuxingRadarProps) {
  const { polygon, vertices, max } = useMemo(() => {
    const get = (el: string) => (wuxingPower as unknown as Record<string, number>)[el] ?? 0;
    const vals = AXES.map(get);
    const m = Math.max(...vals, 1);
    const vs = AXES.map((el, i) => {
      const [x, y] = pointAt(i, Math.max(get(el) / m, 0.02));
      const [lx, ly] = pointAt(i, 1.26);
      return { el, value: get(el), x, y, lx, ly };
    });
    return { max: m, vertices: vs, polygon: vs.map((v) => `${v.x},${v.y}`).join(" ") };
  }, [wuxingPower]);

  return (
    <div className="flex items-center justify-center">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-[240px] w-[240px]" role="img">
        <title>{`五行力量雷达，最高 ${max.toFixed(1)}%`}</title>

        {/* 同心网格 */}
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <polygon
            key={r}
            points={AXES.map((_, i) => pointAt(i, r).join(",")).join(" ")}
            fill="none"
            stroke="var(--border)"
            strokeWidth={0.8}
            opacity={r === 1 ? 0.7 : 0.28}
          />
        ))}

        {/* 轴线 */}
        {AXES.map((_, i) => {
          const [x, y] = pointAt(i, 1);
          return (
            <line key={i} x1={CX} y1={CY} x2={x} y2={y}
              stroke="var(--border)" strokeWidth={0.8} opacity={0.32} />
          );
        })}

        {/* 数据多边形 */}
        <polygon
          points={polygon}
          fill="rgb(212 175 55 / 0.13)"
          stroke="var(--primary)"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        {/* 顶点各用自己的五行色 */}
        {vertices.map((v) => (
          <circle key={v.el} cx={v.x} cy={v.y} r={3.4}
            fill={colorOf(v.el)} stroke="var(--background)" strokeWidth={1.2} />
        ))}

        {/* 轴标签：五行字 + 数值 */}
        {vertices.map((v) => (
          <g key={`l-${v.el}`}>
            <text x={v.lx} y={v.ly - 3} textAnchor="middle" dominantBaseline="middle"
              fontSize={14} fontWeight="bold" fill={colorOf(v.el)}
              style={{ fontFamily: "'Noto Serif SC', serif" }}>
              {v.el}
            </text>
            <text x={v.lx} y={v.ly + 10} textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fill="var(--muted-foreground)"
              style={{ fontVariantNumeric: "tabular-nums" }}>
              {v.value.toFixed(1)}
            </text>
          </g>
        ))}

        {dayMasterElement && (
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fill="var(--muted-foreground)">
            日主 {dayMasterElement}
          </text>
        )}
      </svg>
    </div>
  );
}
