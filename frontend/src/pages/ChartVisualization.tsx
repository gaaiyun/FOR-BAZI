/**
 * 命盘页（/chart）。
 *
 * 一页读完一份命盘：四柱表在最上面占满版心，下面依次是格局、干支关系、
 * 五行、大运。每一块都只陈述算出来的事实；判断留给解读页或用户自己的 AI。
 */

import { Link } from "react-router-dom";
import { PageHeader, Section, Facts, EmptyState } from "@/components/layout/Page";
import { useChartView } from "@/hooks/useChartView";
import PillarTable from "@/components/bazi/PillarTable";
import RelationDiagram from "@/components/bazi/RelationDiagram";
import ElementCycle from "@/components/bazi/ElementCycle";
import Bars from "@/components/bazi/Bars";
import DayunTimeline from "@/components/bazi/DayunTimeline";
import { CopyChartButton } from "@/components/bazi/CopyChart";
import { ELEMENTS } from "@/lib/ganzhi";
import { ELEMENT_COLORS, getCharColor } from "@/lib/wuxing-colors";

export default function ChartVisualization() {
  const { reading, view } = useChartView();

  if (!reading || !view) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="命盘" />
        <EmptyState />
      </div>
    );
  }

  const b = reading.birth;
  const g = view.geju;
  const cur = view.currentDayun;

  const subtitle = [
    view.genderLabel,
    b ? `公历 ${b.clock}` : null,
    b?.lunar_text ? `农历 ${b.lunar_text}` : null,
  ]
    .filter(Boolean)
    .join("　");

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={b?.name ? `${b.name}的命盘` : "命盘"}
        description={
          <>
            <span className="tabular">{subtitle}</span>
            {b && b.offset_minutes !== 0 && (
              <span className="mt-1 block">
                按真太阳时 <span className="tabular">{b.effective}</span> 排盘（{b.place || `东经 ${b.longitude}°`}，校正{" "}
                {b.offset_minutes > 0 ? "+" : ""}
                {b.offset_minutes} 分钟）
              </span>
            )}
          </>
        }
        actions={<CopyChartButton />}
      />

      {/* ── 四柱 ─────────────────────────────────────────────── */}
      <div className="border-t border-foreground pt-5">
        <PillarTable pillars={view.pillars} />
      </div>

      <Facts
        className="border-t border-rule py-6"
        items={[
          {
            k: "日主",
            v: (
              <span>
                <span className="font-heading font-semibold" style={{ color: getCharColor(view.dayMaster) }}>
                  {view.dayMaster}
                </span>{" "}
                {view.dayMasterElement}
              </span>
            ),
          },
          ...(g ? [{ k: "格局", v: g.格局名称 }, { k: "日主强弱", v: `${g.日主强弱} · ${g.日主力量占比}%` }] : []),
          ...view.palaces.map((p) => ({ k: p.label, v: p.value })),
          ...(view.dayun[0]
            ? [{ k: "起运", v: `虚岁 ${view.dayun[0].startAge} 岁 · ${view.direction}` }]
            : []),
        ]}
      />

      {/* ── 格局 ─────────────────────────────────────────────── */}
      {g && (
        <Section title="格局" description="取格看月令透干，强弱看五行力量，两者分开判断。">
          <p className="font-heading text-2xl font-semibold">
            {g.格局名称}
            <span className="ml-3 font-sans text-sm font-normal text-muted-foreground">{g.格局类型}</span>
          </p>
          <p className="mt-3 max-w-2xl text-[0.9375rem] leading-[1.9]">{g.context}</p>
          <Facts
            className="mt-6"
            items={[
              { k: "月令", v: `${g.月令}，主气 ${g.月令主气}` },
              { k: "透干", v: g.透干位置 || "不透" },
              { k: "最旺五行", v: g.最旺五行 },
              { k: "印星", v: g.生扶力量.印星.join(" ") || "无" },
              { k: "比劫", v: g.生扶力量.比劫.join(" ") || "无" },
            ]}
          />
        </Section>
      )}

      {/* ── 干支关系 ─────────────────────────────────────────── */}
      <Section title="干支关系" description="原局四柱之间的合、冲、刑、害。">
        <RelationDiagram pillars={view.pillars} relations={view.relations} />
      </Section>

      {/* ── 五行 ─────────────────────────────────────────────── */}
      <Section
        title="五行"
        description="含藏干、月令加权与十二长生，合计 100%。"
        actions={
          <Link to="/elements" className="link text-xs">
            展开
          </Link>
        }
      >
        <div className="grid items-center gap-x-12 gap-y-8 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <ElementCycle power={view.power} dayMasterElement={view.dayMasterElement} />
          <Bars
            max={Math.max(...ELEMENTS.map((e) => view.power[e]), 1)}
            rows={ELEMENTS.map((e) => ({
              key: e,
              label: e,
              value: view.power[e],
              display: `${view.power[e].toFixed(1)}%`,
              note: e === view.dayMasterElement ? "日主" : undefined,
              color: ELEMENT_COLORS[e],
            }))}
          />
        </div>
      </Section>

      {/* ── 大运 ─────────────────────────────────────────────── */}
      {view.dayun.length > 0 && (
        <Section
          title="大运"
          description={
            cur
              ? `现行 ${cur.ganzhi} 运，${cur.startYear}–${cur.endYear} 年。`
              : `${view.dayun[0].startYear} 年起运。`
          }
          actions={
            <Link to="/luck-pillars" className="link text-xs">
              逐年看
            </Link>
          }
        >
          <DayunTimeline dayun={view.dayun} />
        </Section>
      )}

      {/* ── 去向 ─────────────────────────────────────────────── */}
      <Section title="解读">
        <p className="max-w-xl text-[0.9375rem] leading-[1.9]">
          命盘只是算出来的事实。要读出含义，可以在站内让 AI 解读，也可以把整份命盘复制出去，交给你自己常用的 AI。
        </p>
        <div className="no-print mt-5 flex flex-wrap gap-2">
          <Link to="/ai-reading" className="btn btn-line">
            站内解读
          </Link>
          <Link to="/chat" className="btn btn-line">
            问一件具体的事
          </Link>
          <CopyChartButton />
        </div>
      </Section>
    </div>
  );
}
