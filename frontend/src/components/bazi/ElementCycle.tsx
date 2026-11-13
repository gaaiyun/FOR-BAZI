/**
 * 五行生克图。
 *
 * 五行按相生次序排成一圈（木→火→土→金→水），圆的面积对应该行的力量占比；
 * 外圈箭头是相生，内部的五角星是相克。比雷达图多一层信息：不只看谁强谁弱，
 * 还能看出最旺的一行在生谁、克谁，日主被谁生、被谁克。
 */

import { useMemo } from "react";
import { ELEMENTS, SHENG, KE, type Element } from "@/lib/ganzhi";
import { ELEMENT_COLORS, tint } from "@/lib/wuxing-colors";

const SIZE = 360;
const C = SIZE / 2;
const R = 104;

function pos(i: number): [number, number] {
  const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
  return [C + Math.cos(a) * R, C + Math.sin(a) * R];
}

/** 把线段两端各缩进一段，避免压住圆。 */
function trim(a: [number, number], b: [number, number], ra: number, rb: number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: a[0] + ux * ra, y1: a[1] + uy * ra,
    x2: b[0] - ux * rb, y2: b[1] - uy * rb,
  };
}

export default function ElementCycle({
  power,
  dayMasterElement,
  className,
}: {
  power: Record<Element, number>;
  dayMasterElement?: string;
  className?: string;
}) {
  const nodes = useMemo(() => {
    const max = Math.max(...ELEMENTS.map((e) => power[e] ?? 0), 1);
    return ELEMENTS.map((el, i) => {
      const v = power[el] ?? 0;
      const [x, y] = pos(i);
      // 面积正比于力量：半径取平方根
      const r = 13 + 23 * Math.sqrt(v / max);
      return { el, v, x, y, r, i };
    });
  }, [power]);

  const byEl = Object.fromEntries(nodes.map((n) => [n.el, n])) as Record<Element, (typeof nodes)[number]>;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={className ?? "mx-auto block w-full max-w-[20rem]"} role="img">
      <title>
        {`五行力量：${nodes.map((n) => `${n.el} ${n.v.toFixed(1)}%`).join("，")}`}
      </title>
      <defs>
        <marker id="arrow-sheng" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0.5 L7 4 L0 7.5 Z" fill="var(--foreground)" />
        </marker>
        <marker id="arrow-ke" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 1 L7 4 L0 7" fill="none" stroke="var(--faint)" strokeWidth="1.2" />
        </marker>
      </defs>

      {/* 相克：内部五角星，退到背景 */}
      {nodes.map((n) => {
        const t = byEl[KE[n.el]];
        const l = trim([n.x, n.y], [t.x, t.y], n.r + 5, t.r + 7);
        return (
          <line key={`ke-${n.el}`} {...l} stroke="var(--faint)" strokeWidth={0.9} strokeDasharray="2 4" markerEnd="url(#arrow-ke)" />
        );
      })}

      {/* 相生：外圈 */}
      {nodes.map((n) => {
        const t = byEl[SHENG[n.el]];
        const l = trim([n.x, n.y], [t.x, t.y], n.r + 5, t.r + 8);
        return (
          <line key={`sheng-${n.el}`} {...l} stroke="var(--foreground)" strokeWidth={1} markerEnd="url(#arrow-sheng)" />
        );
      })}

      {nodes.map((n) => {
        const color = ELEMENT_COLORS[n.el];
        const isDm = n.el === dayMasterElement;
        // 标注放在圆外侧，沿半径方向推出去
        const ox = ((n.x - C) / R) * (n.r + 19);
        const oy = ((n.y - C) / R) * (n.r + 19);
        return (
          <g key={n.el} style={{ animation: `rise-in 600ms var(--ease-out-quart) ${n.i * 70}ms both` }}>
            {isDm && <circle cx={n.x} cy={n.y} r={n.r + 4} fill="none" stroke={color} strokeWidth={1} />}
            <circle cx={n.x} cy={n.y} r={n.r} fill={tint(color, 16)} stroke={color} strokeWidth={1.2} />
            <text
              x={n.x}
              y={n.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.max(15, n.r * 0.85)}
              fill={color}
              style={{ fontFamily: "'Ming Glyph', var(--font-heading)", fontWeight: 900 }}
            >
              {n.el}
            </text>
            <text
              x={n.x + ox}
              y={n.y + oy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11.5}
              fill="var(--muted-foreground)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {n.v.toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
