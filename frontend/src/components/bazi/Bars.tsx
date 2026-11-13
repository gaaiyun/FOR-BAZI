/**
 * 横向细条图。五行力量、十神分布都用它。
 *
 * 条本身只有 6px 高，数值写在右侧，标注（日主、最旺）用文字写在标签旁，
 * 不往条上贴色块。
 */

import type { ReactNode } from "react";

export interface BarRow {
  key: string;
  label: ReactNode;
  /** 条长所依据的数值 */
  value: number;
  /** 右侧显示的文字，默认 value 保留一位小数 */
  display?: string;
  /** 标签旁的小字注记 */
  note?: string;
  color?: string;
}

export default function Bars({ rows, max }: { rows: BarRow[]; max?: number }) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-4">
      {rows.map((r, i) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex items-baseline gap-2">
              <span className="font-heading text-lg font-semibold leading-none" style={{ color: r.color }}>
                {r.label}
              </span>
              {r.note && <span className="text-xs text-muted-foreground">{r.note}</span>}
            </span>
            <span className="tabular text-sm">{r.display ?? r.value.toFixed(1)}</span>
          </div>
          <div className="mt-2 h-1.5 bg-wash">
            <div
              className="draw-x h-full"
              style={{
                width: `${Math.max(0, Math.min(100, (r.value / top) * 100))}%`,
                background: r.color ?? "var(--foreground)",
                animationDelay: `${i * 60}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
