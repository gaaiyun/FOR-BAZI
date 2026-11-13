/**
 * 神煞页（/shensha）。
 *
 * 按柱列出引擎查到的神煞及其含义。释义取自引擎自带的词表（与 AI 工具
 * explain_shensha 同源），页面和解读里说的是同一套话。
 */

import { useMemo } from "react";
import { PageHeader, Section, EmptyState } from "@/components/layout/Page";
import { useChartView } from "@/hooks/useChartView";
import { explainShensha } from "@/engine/tools";
import { getCharColor } from "@/lib/wuxing-colors";

/** 引擎收录、会去查的神煞。用于说明「没查到」和「没收录」的区别。 */
const COVERED = [
  "天乙贵人", "太极贵人", "天德贵人", "月德贵人", "文昌", "禄神", "金舆",
  "将星", "华盖", "驿马", "桃花", "红鸾", "天喜",
  "羊刃", "魁罡", "孤辰", "寡宿", "劫煞", "亡神",
];

function meaningOf(name: string): string {
  const r = explainShensha(name) as { description?: string };
  if (!r.description) return "";
  // description 形如「桃花：子午卯酉为桃花……」，去掉重复的名字前缀
  return r.description.replace(new RegExp(`^${name}：`), "");
}

export default function ShenSha() {
  const { reading, view } = useChartView();

  const all = useMemo(() => {
    const seen = new Map<string, string[]>();
    for (const p of view?.pillars ?? []) {
      for (const s of p.shensha) {
        seen.set(s, [...(seen.get(s) ?? []), p.label]);
      }
    }
    return [...seen.entries()].map(([name, where]) => ({ name, where, meaning: meaningOf(name) }));
  }, [view]);

  if (!reading || !view) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="神煞" description="以日干、月支、年支、日支为基准查得的神煞。" />
        <EmptyState />
      </div>
    );
  }

  const missing = COVERED.filter((n) => !all.some((a) => a.name === n));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="神煞"
        description="以日干、月支、年支、日支为基准，看四柱干支上落了哪些神煞。神煞是辅助参考，轻重要放回格局里看。"
      />

      <div className="grid grid-cols-4 border-t border-foreground">
        {view.pillars.map((p) => (
          <div key={p.key} className="border-b border-rule px-1 py-6 text-center sm:px-3">
            <p className="text-xs text-muted-foreground">{p.label}</p>
            <p className="glyph mt-3 flex flex-col items-center gap-1 text-[clamp(1.75rem,8vw,2.75rem)]">
              <span style={{ color: getCharColor(p.stem) }}>{p.stem}</span>
              <span style={{ color: getCharColor(p.branch) }}>{p.branch}</span>
            </p>
            <ul className="mt-4 space-y-1 text-[0.8125rem] sm:text-sm">
              {p.shensha.length ? (
                p.shensha.map((s) => <li key={s}>{s}</li>)
              ) : (
                <li className="text-faint">—</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <Section
        className="mt-10"
        title={`命带 ${all.length} 种`}
        description={all.length ? undefined : "四柱地支上没有落下本站收录的神煞。"}
      >
        {all.length > 0 ? (
          <dl>
            {all.map((s) => (
              <div key={s.name} className="border-b border-rule py-5 first:pt-0 last:border-b-0 last:pb-0">
                <dt className="flex flex-wrap items-baseline gap-x-4">
                  <span className="font-heading text-xl font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground">落在{s.where.join("、")}</span>
                </dt>
                {s.meaning && (
                  <dd className="mt-2 max-w-2xl text-[0.9375rem] leading-[1.9] text-muted-foreground">{s.meaning}</dd>
                )}
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">没有神煞并不代表什么，许多命盘都是如此。</p>
        )}
      </Section>

      <Section title="查了哪些" description="本站查这十九种常用神煞。">
        <p className="text-[0.9375rem] leading-[1.9]">
          {COVERED.map((n, i) => (
            <span key={n} className={missing.includes(n) ? "text-muted-foreground" : "font-semibold"}>
              {i > 0 && "、"}
              {n}
            </span>
          ))}
          。
        </p>
        <p className="mt-2 text-xs text-muted-foreground">加粗的是这份命盘里查到的。</p>
      </Section>
    </div>
  );
}
