/**
 * 五行页（/elements）。
 *
 * 三层信息：各行占多少（生克图 + 条）、站在日主的角度谁在帮身谁在耗身、
 * 每一行具体由哪些字构成。最后附《穷通宝鉴》对该日干该月的调候原文。
 */

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Section, EmptyState } from "@/components/layout/Page";
import { useChartView } from "@/hooks/useChartView";
import ElementCycle from "@/components/bazi/ElementCycle";
import Bars from "@/components/bazi/Bars";
import { ELEMENTS, SHENG, KE, STEM_ELEMENT, type Element } from "@/lib/ganzhi";
import { ELEMENT_COLORS, getCharColor } from "@/lib/wuxing-colors";
import { getQiongtongForTool } from "@/engine/classics";

/** 站在日主角度，五行各是什么角色。 */
function roles(dm: Element): Array<{ el: Element; role: string; side: "帮身" | "耗身" }> {
  const sheng = SHENG[dm];
  const ke = KE[dm];
  const shengWo = ELEMENTS.find((e) => SHENG[e] === dm)!;
  const keWo = ELEMENTS.find((e) => KE[e] === dm)!;
  return [
    { el: dm, role: "比劫 · 同我", side: "帮身" },
    { el: shengWo, role: "印星 · 生我", side: "帮身" },
    { el: sheng, role: "食伤 · 我生", side: "耗身" },
    { el: ke, role: "财星 · 我克", side: "耗身" },
    { el: keWo, role: "官杀 · 克我", side: "耗身" },
  ];
}

export default function ElementsAnalysis() {
  const { reading, view } = useChartView();
  const [classic, setClassic] = useState<{ key: string; 原文: string; 白话: string; season: string } | null>(null);

  const dm = view?.dayMaster ?? "";
  const monthZhi = view?.pillars[1]?.branch ?? "";
  const classicKey = dm + monthZhi;

  useEffect(() => {
    if (!dm || !monthZhi) return;
    let alive = true;
    getQiongtongForTool(dm, monthZhi)
      .then((r) => {
        if (!alive) return;
        const g = r as { 原文?: string; 白话?: string; season?: string };
        setClassic({ key: dm + monthZhi, 原文: g.原文 ?? "", 白话: g.白话 ?? "", season: g.season ?? "" });
      })
      .catch(() => alive && setClassic({ key: dm + monthZhi, 原文: "", 白话: "", season: "" }));
    return () => {
      alive = false;
    };
  }, [dm, monthZhi]);

  // 每一行由哪些字构成
  const sources = useMemo(() => {
    const out = Object.fromEntries(ELEMENTS.map((e) => [e, { stems: [] as string[], hidden: [] as string[] }])) as Record<
      Element,
      { stems: string[]; hidden: string[] }
    >;
    for (const p of view?.pillars ?? []) {
      const short = p.label[0];
      const se = STEM_ELEMENT[p.stem];
      if (se) out[se].stems.push(`${p.stem}（${short}干）`);
      for (const h of p.hidden) {
        const he = STEM_ELEMENT[h.stem];
        if (he) out[he].hidden.push(`${h.stem}（${short}支${p.branch}）`);
      }
    }
    return out;
  }, [view]);

  if (!reading || !view || !view.dayMasterElement) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="五行" description="力量占比、生克关系与构成。" />
        <EmptyState />
      </div>
    );
  }

  const dmEl = view.dayMasterElement;
  const rl = roles(dmEl);
  const help = rl.filter((r) => r.side === "帮身").reduce((s, r) => s + view.power[r.el], 0);
  const drain = 100 - help;
  const sorted = [...ELEMENTS].sort((a, b) => view.power[b] - view.power[a]);
  const tiaohou = classic && classic.key === classicKey && classic.原文 ? classic : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="五行"
        description="力量按天干、地支藏干（本气、中气、余气）计分，月令加权，再乘十二长生状态系数，归一化为 100%。"
      />

      <div className="grid items-center gap-x-14 gap-y-8 border-t border-foreground pt-8 sm:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
        <ElementCycle power={view.power} dayMasterElement={dmEl} className="mx-auto block w-full max-w-[21rem]" />
        <div>
          <Bars
            rows={ELEMENTS.map((e) => ({
              key: e,
              label: e,
              value: view.power[e],
              display: `${view.power[e].toFixed(1)}%`,
              note: [e === dmEl ? "日主" : "", e === sorted[0] ? "最旺" : "", e === sorted[4] ? "最弱" : ""]
                .filter(Boolean)
                .join(" · ") || undefined,
              color: ELEMENT_COLORS[e],
            }))}
          />
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            图中圆的面积对应占比；实线箭头为相生，虚线为相克；带外圈的是日主所属五行。
          </p>
        </div>
      </div>

      <Section
        className="mt-10"
        title="帮身与耗身"
        description={`日主 ${view.dayMaster} 属${dmEl}。同我、生我为帮；我生、我克、克我为耗。`}
      >
        <div className="flex items-baseline justify-between text-sm">
          <span>
            帮身 <span className="tabular font-heading text-2xl font-semibold">{help.toFixed(1)}</span>%
          </span>
          <span>
            耗身 <span className="tabular font-heading text-2xl font-semibold">{drain.toFixed(1)}</span>%
          </span>
        </div>
        <div className="mt-3 flex h-2 w-full gap-px" role="img" aria-label={`帮身 ${help.toFixed(1)}%，耗身 ${drain.toFixed(1)}%`}>
          {rl.map((r) => (
            <div
              key={r.el}
              className="draw-x h-full"
              style={{ width: `${view.power[r.el]}%`, background: ELEMENT_COLORS[r.el] }}
              title={`${r.el} ${view.power[r.el].toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="ledger min-w-[22rem]">
            <thead>
              <tr>
                <th>五行</th>
                <th>对日主</th>
                <th>归类</th>
                <th className="text-right">占比</th>
              </tr>
            </thead>
            <tbody>
              {rl.map((r) => (
                <tr key={r.el}>
                  <td className="font-heading text-lg font-semibold" style={{ color: ELEMENT_COLORS[r.el] }}>
                    {r.el}
                  </td>
                  <td>{r.role}</td>
                  <td className="text-muted-foreground">{r.side}</td>
                  <td className="tabular text-right">{view.power[r.el].toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {view.geju && (
          <p className="mt-5 text-[0.9375rem] leading-[1.9]">
            按日主所属五行占比判定：<span className="font-semibold">{view.geju.日主强弱}</span>
            （{view.geju.日主力量占比}%；35% 以上为身旺，20% 以下为身弱）。
          </p>
        )}
      </Section>

      <Section title="构成" description="每一行由哪些天干和藏干贡献。">
        <div className="overflow-x-auto">
          <table className="ledger min-w-[24rem]">
            <thead>
              <tr>
                <th>五行</th>
                <th>天干</th>
                <th>地支藏干</th>
              </tr>
            </thead>
            <tbody>
              {ELEMENTS.map((e) => (
                <tr key={e}>
                  <td className="font-heading text-lg font-semibold" style={{ color: ELEMENT_COLORS[e] }}>
                    {e}
                  </td>
                  <td>{sources[e].stems.join("　") || <span className="text-faint">不见</span>}</td>
                  <td>{sources[e].hidden.join("　") || <span className="text-faint">不见</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {tiaohou && (
        <Section
          title="调候"
          description={
            <>
              《穷通宝鉴》论
              <span style={{ color: getCharColor(dm) }}> {dm} </span>
              日生于{monthZhi}月。
            </>
          }
        >
          <blockquote className="max-w-2xl border-l border-foreground pl-5 font-serif text-[1.0625rem] leading-[2]">
            {tiaohou.原文}
          </blockquote>
          {tiaohou.白话 && (
            <p className="mt-4 max-w-2xl text-[0.9375rem] leading-[1.9] text-muted-foreground">{tiaohou.白话}</p>
          )}
        </Section>
      )}
    </div>
  );
}
