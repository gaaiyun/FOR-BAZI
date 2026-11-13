/**
 * 四柱表 —— 全站的主视觉。
 *
 * 排成一张真正的表：四列是年月日时，自上而下是天干十神、天干、地支、藏干、
 * 纳音、地势、旬空、神煞。干支用最重的宋体，字号随屏宽伸缩；其余都是小字注解。
 * 用 <table> 而不是四张并排的卡片，行与行天然对齐，读屏也能按行列朗读。
 */

import type { PillarView } from "@/lib/chart-view";
import { getCharColor } from "@/lib/wuxing-colors";
import { cn } from "@/lib/utils";

export interface PillarTableProps {
  pillars: PillarView[];
  /** 显示地势、旬空两行 */
  detailed?: boolean;
  className?: string;
}

const glyphSize = "text-[clamp(2.75rem,13vw,5.25rem)]";

export default function PillarTable({ pillars, detailed = true, className }: PillarTableProps) {
  const hasShensha = pillars.some((p) => p.shensha.length > 0);

  return (
    <table className={cn("w-full table-fixed border-collapse text-center", className)}>
      <caption className="sr-only">四柱命盘</caption>
      <colgroup>
        <col className="w-9 sm:w-16" />
        <col />
        <col />
        <col />
        <col />
      </colgroup>

      <thead>
        <tr className="border-b border-foreground">
          <td />
          {pillars.map((p) => (
            <th key={p.key} scope="col" className="pb-3 font-normal">
              <span className="block font-heading text-[0.9375rem] font-semibold">{p.label}</span>
              <span className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{p.palace}</span>
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        <tr>
          <RowLabel>十神</RowLabel>
          {pillars.map((p) => (
            <td
              key={p.key}
              className={cn("pb-1 pt-5 text-sm", p.key === "day" ? "font-medium text-primary" : "text-muted-foreground")}
            >
              {p.stemGod}
            </td>
          ))}
        </tr>

        <tr>
          <RowLabel>天干</RowLabel>
          {pillars.map((p, i) => (
            <td key={p.key} className="py-1">
              <span
                className={cn("glyph inline-block", glyphSize)}
                style={{ color: getCharColor(p.stem), animation: `ink-in 700ms var(--ease-out-expo) ${60 + i * 90}ms both` }}
              >
                {p.stem}
              </span>
            </td>
          ))}
        </tr>

        <tr>
          <RowLabel>地支</RowLabel>
          {pillars.map((p, i) => (
            <td key={p.key} className="pb-5 pt-1">
              <span
                className={cn("glyph inline-block", glyphSize)}
                style={{ color: getCharColor(p.branch), animation: `ink-in 700ms var(--ease-out-expo) ${240 + i * 90}ms both` }}
              >
                {p.branch}
              </span>
            </td>
          ))}
        </tr>

        <tr className="border-t border-rule">
          <RowLabel>藏干</RowLabel>
          {pillars.map((p) => (
            <td key={p.key} className="py-3 align-top">
              <ul className="inline-flex flex-col gap-1 text-left">
                {p.hidden.map((h) => (
                  <li key={h.stem} className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="font-heading text-base font-semibold" style={{ color: getCharColor(h.stem) }}>
                      {h.stem}
                    </span>
                    <span className="text-xs text-muted-foreground">{h.god}</span>
                  </li>
                ))}
              </ul>
            </td>
          ))}
        </tr>

        <tr className="border-t border-rule">
          <RowLabel>纳音</RowLabel>
          {pillars.map((p) => (
            <td key={p.key} className="py-2.5 text-[0.8125rem] sm:text-sm">
              {p.nayin || "—"}
            </td>
          ))}
        </tr>

        {detailed && (
          <>
            <tr className="border-t border-rule">
              <RowLabel>地势</RowLabel>
              {pillars.map((p) => (
                <td key={p.key} className="py-2.5 text-[0.8125rem] sm:text-sm">
                  {p.dishi || "—"}
                </td>
              ))}
            </tr>
            <tr className="border-t border-rule">
              <RowLabel>旬空</RowLabel>
              {pillars.map((p) => (
                <td key={p.key} className="py-2.5 text-[0.8125rem] text-muted-foreground sm:text-sm">
                  {p.xunkong || "—"}
                </td>
              ))}
            </tr>
          </>
        )}

        {hasShensha && (
          <tr className="border-t border-rule">
            <RowLabel>神煞</RowLabel>
            {pillars.map((p) => (
              <td key={p.key} className="py-2.5 align-top text-[0.8125rem] leading-relaxed sm:text-sm">
                {p.shensha.length ? (
                  p.shensha.map((s) => (
                    <span key={s} className="block">
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}

function RowLabel({ children }: { children: string }) {
  return (
    <th scope="row" className="pr-1 text-left align-middle text-xs font-normal text-muted-foreground">
      {children}
    </th>
  );
}
