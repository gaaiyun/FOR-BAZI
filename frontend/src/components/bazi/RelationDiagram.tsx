/**
 * 原局干支关系图。
 *
 * 四柱横排，天干之间的合克画在上方，地支之间的冲合刑害画在下方，
 * 一眼能看出哪两柱在起作用、隔了几柱。三合、三会、三刑这类涉及三个字的
 * 关系画成弧线会乱，改在图下用文字列出。
 *
 * 线型只表达类别：合类实线，冲克用朱砂，害破用虚线。
 */

import { useMemo } from "react";
import type { PillarView } from "@/lib/chart-view";
import { getCharColor } from "@/lib/wuxing-colors";

interface Arc {
  from: number;
  to: number;
  label: string;
  tone: "he" | "chong" | "minor";
  side: "top" | "bottom";
}

const INDEX: Record<string, number> = { 年: 0, 月: 1, 日: 2, 时: 3 };
const TAGGED = /^([年月日时])([年月日时])(.+?)\((.+)\)$/;

function parse(kind: string, item: string): Arc | null {
  const m = item.match(TAGGED);
  if (!m) return null;
  const from = INDEX[m[1]];
  const to = INDEX[m[2]];
  const detail = m[4];
  switch (kind) {
    case "干合":
      return { from, to, label: `合${detail.slice(-1)}`, tone: "he", side: "top" };
    case "干克":
      return { from, to, label: detail, tone: "chong", side: "top" };
    case "冲":
      return { from, to, label: "冲", tone: "chong", side: "bottom" };
    case "合":
      return { from, to, label: "合", tone: "he", side: "bottom" };
    case "半三合":
      return { from, to, label: "半合", tone: "he", side: "bottom" };
    case "害":
      return { from, to, label: "害", tone: "minor", side: "bottom" };
    case "破":
      return { from, to, label: "破", tone: "minor", side: "bottom" };
    default:
      return null;
  }
}

const W = 400;
const COLS = [50, 150, 250, 350];
const GLYPH = 34;

export default function RelationDiagram({
  pillars,
  relations,
}: {
  pillars: PillarView[];
  relations: Array<{ kind: string; items: string[] }>;
}) {
  const { arcs, notes, top, bottom } = useMemo(() => {
    const arcs: Array<Arc & { depth: number }> = [];
    const notes: string[] = [];
    const stack: Record<string, number> = {};
    for (const r of relations) {
      for (const item of r.items) {
        const a = parse(r.kind, item);
        if (!a) {
          if (r.kind !== "双合") notes.push(item);
          continue;
        }
        const key = `${a.side}${a.from}${a.to}`;
        const n = stack[key] ?? 0;
        stack[key] = n + 1;
        arcs.push({ ...a, depth: 26 + 20 * (a.to - a.from - 1) + 17 * n });
      }
    }
    const max = (side: string) => Math.max(0, ...arcs.filter((a) => a.side === side).map((a) => a.depth));
    return { arcs, notes, top: max("top"), bottom: max("bottom") };
  }, [relations]);

  if (!arcs.length && !notes.length) {
    return <p className="text-sm text-muted-foreground">四柱之间未见刑冲合害。</p>;
  }

  // 纵向布局：上弧区 → 天干 → 地支 → 下弧区
  const padTop = top ? top * 0.75 + 20 : 6;
  const stemY = padTop + GLYPH;
  const branchY = stemY + GLYPH + 10;
  const height = branchY + 12 + (bottom ? bottom * 0.75 + 20 : 4);

  const stroke = (tone: Arc["tone"]) =>
    tone === "chong" ? "var(--primary)" : tone === "he" ? "var(--foreground)" : "var(--muted-foreground)";

  return (
    <div>
      {arcs.length > 0 && (
        <svg viewBox={`0 0 ${W} ${height}`} className="mx-auto block w-full max-w-md" role="img">
          <title>
            {`原局干支关系：${relations.map((r) => r.items.join("、")).join("；")}`}
          </title>

          {arcs.map((a, i) => {
            const x1 = COLS[a.from];
            const x2 = COLS[a.to];
            const y = a.side === "top" ? stemY - GLYPH + 2 : branchY + 10;
            const dir = a.side === "top" ? -1 : 1;
            const cy = y + dir * a.depth;
            const apex = y + dir * a.depth * 0.75;
            const mid = (x1 + x2) / 2;
            return (
              <g key={i}>
                <path
                  d={`M ${x1} ${y} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y}`}
                  fill="none"
                  stroke={stroke(a.tone)}
                  strokeWidth={1.1}
                  strokeDasharray={a.tone === "minor" ? "3 3" : undefined}
                  pathLength={1}
                  style={
                    a.tone === "minor"
                      ? undefined
                      : { strokeDasharray: 1, strokeDashoffset: 0, animation: `relation-draw 900ms var(--ease-out-expo) ${200 + i * 80}ms both` }
                  }
                />
                <rect
                  x={mid - a.label.length * 6.5 - 3}
                  y={apex - 8}
                  width={a.label.length * 13 + 6}
                  height={16}
                  fill="var(--background)"
                />
                <text
                  x={mid}
                  y={apex}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={12}
                  fill={stroke(a.tone)}
                >
                  {a.label}
                </text>
              </g>
            );
          })}

          {pillars.map((p, i) => (
            <g key={p.key} style={{ fontFamily: "'Ming Glyph', var(--font-heading)", fontWeight: 900 }}>
              <text x={COLS[i]} y={stemY - 4} textAnchor="middle" fontSize={GLYPH} fill={getCharColor(p.stem)}>
                {p.stem}
              </text>
              <text x={COLS[i]} y={branchY} textAnchor="middle" fontSize={GLYPH} fill={getCharColor(p.branch)}>
                {p.branch}
              </text>
            </g>
          ))}

          <style>{`@keyframes relation-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }`}</style>
        </svg>
      )}

      {notes.length > 0 && (
        <p className="mt-4 text-sm leading-relaxed">
          <span className="mr-3 text-muted-foreground">另有</span>
          {notes.join("、")}
        </p>
      )}

      {arcs.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <Legend tone="he" text="合" />
          <Legend tone="chong" text="冲、克" />
          <Legend tone="minor" text="害、破" />
          <span>上方为天干，下方为地支</span>
        </p>
      )}
    </div>
  );
}

function Legend({ tone, text }: { tone: Arc["tone"]; text: string }) {
  const color =
    tone === "chong" ? "var(--primary)" : tone === "he" ? "var(--foreground)" : "var(--muted-foreground)";
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="6" aria-hidden>
        <line x1="0" y1="3" x2="18" y2="3" stroke={color} strokeWidth="1.2" strokeDasharray={tone === "minor" ? "3 3" : undefined} />
      </svg>
      {text}
    </span>
  );
}
