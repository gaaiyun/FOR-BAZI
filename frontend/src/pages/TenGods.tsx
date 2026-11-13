/**
 * 十神页（/ten-gods）。
 *
 * 先看分布（比劫、食伤、财、官杀、印五类各占多少），再看每一个十神
 * 落在哪一柱的天干或藏干，最后是命中出现的十神各自代表什么。
 *
 * 旧版给每个十神贴「吉 / 凶」标签，依据只是五行个数的多少，已删去：
 * 十神本身无吉凶，喜忌要结合格局与强弱判断。
 */

import { useMemo } from "react";
import { PageHeader, Section, EmptyState } from "@/components/layout/Page";
import { useChartView } from "@/hooks/useChartView";
import Bars from "@/components/bazi/Bars";
import { TEN_GOD_GROUP } from "@/lib/ganzhi";
import { getCharColor } from "@/lib/wuxing-colors";

const ORDER = ["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印"];

const GROUP_NOTE: Record<string, string> = {
  比劫: "同我",
  食伤: "我生",
  财星: "我克",
  官杀: "克我",
  印星: "生我",
};

/** 各十神的含义。只说它代表什么，不说好坏。 */
const MEANING: Record<string, string> = {
  比肩: "与日主同五行、同阴阳。代表自我、同辈、独立与主见，也代表与人分享或竞争资源。",
  劫财: "与日主同五行、异阴阳。代表合作与争夺并存的同辈关系，行动力强，钱财进出快。",
  食神: "日主所生、同阴阳。代表才艺、表达、口福与从容，是温和的输出。",
  伤官: "日主所生、异阴阳。代表才华、创新与不服管束，是锋利的输出。",
  偏财: "日主所克、同阴阳。代表流动的钱财、机会与人缘，也代表父亲。",
  正财: "日主所克、异阴阳。代表稳定的收入、务实与经营，男命也代表妻子。",
  七杀: "克日主、同阴阳。代表压力、挑战、魄力与权威，需有制有化方为所用。",
  正官: "克日主、异阴阳。代表规则、职位、名誉与责任，女命也代表丈夫。",
  偏印: "生日主、同阴阳。代表非主流的学问、直觉与独处，思路不走寻常路。",
  正印: "生日主、异阴阳。代表学业、庇护、名分与长辈，也代表母亲。",
};

export default function TenGods() {
  const { reading, view } = useChartView();

  /** 每个十神出现在哪些位置 */
  const positions = useMemo(() => {
    const map: Record<string, Array<{ where: string; char: string; hidden: boolean }>> = {};
    for (const p of view?.pillars ?? []) {
      const short = p.label[0];
      if (p.key !== "day" && p.stemGod) {
        (map[p.stemGod] ??= []).push({ where: `${short}干`, char: p.stem, hidden: false });
      }
      p.hidden.forEach((h, i) => {
        if (!h.god) return;
        (map[h.god] ??= []).push({
          where: `${short}支${p.branch}${["本气", "中气", "余气"][i] ?? ""}`,
          char: h.stem,
          hidden: true,
        });
      });
    }
    return map;
  }, [view]);

  if (!reading || !view) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="十神" description="日主与其余干支的生克关系。" />
        <EmptyState />
      </div>
    );
  }

  const present = ORDER.filter((g) => positions[g]?.length);
  const absent = ORDER.filter((g) => !positions[g]?.length);
  const total = view.godGroups.reduce((s, g) => s + g.weight, 0) || 1;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="十神"
        description={
          <>
            以日主{" "}
            <span className="font-heading font-semibold" style={{ color: getCharColor(view.dayMaster) }}>
              {view.dayMaster}
            </span>{" "}
            为中心，其余天干与地支藏干按生克和阴阳各得一个十神。
          </>
        }
      />

      <div className="border-t border-foreground pt-8 lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-x-8">
        <div className="mb-5 lg:mb-0">
          <h2 className="font-heading text-lg font-semibold">分布</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground lg:pr-2">
            天干计 1，藏干按本气 0.6、中气 0.3、余气 0.1 计。
          </p>
        </div>
        <Bars
          rows={view.godGroups.map((g) => ({
            key: g.group,
            label: g.group,
            value: g.weight,
            display: `${((g.weight / total) * 100).toFixed(0)}%`,
            note: g.members.length ? `${GROUP_NOTE[g.group]} · ${g.members.join("、")}` : `${GROUP_NOTE[g.group]} · 不见`,
          }))}
        />
      </div>

      <Section className="mt-10" title="落宫" description="每一柱的天干十神与地支藏干十神。">
        <div className="overflow-x-auto">
          <table className="ledger min-w-[26rem]">
            <thead>
              <tr>
                <th />
                {view.pillars.map((p) => (
                  <th key={p.key}>
                    <span className="text-foreground">{p.label}</span>
                    <span className="ml-1.5 hidden sm:inline">{p.palace}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="whitespace-nowrap text-xs text-muted-foreground">天干</td>
                {view.pillars.map((p) => (
                  <td key={p.key}>
                    <span className="font-heading text-xl font-semibold" style={{ color: getCharColor(p.stem) }}>
                      {p.stem}
                    </span>
                    <span className={p.key === "day" ? "ml-2 text-primary" : "ml-2"}>{p.stemGod}</span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="whitespace-nowrap text-xs text-muted-foreground">地支</td>
                {view.pillars.map((p) => (
                  <td key={p.key} className="align-top">
                    <span className="font-heading text-xl font-semibold" style={{ color: getCharColor(p.branch) }}>
                      {p.branch}
                    </span>
                    <ul className="mt-1.5 space-y-0.5">
                      {p.hidden.map((h) => (
                        <li key={h.stem} className="whitespace-nowrap">
                          <span className="font-heading font-semibold" style={{ color: getCharColor(h.stem) }}>
                            {h.stem}
                          </span>
                          <span className="ml-1.5 text-muted-foreground">{h.god}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="命中十神"
        description={absent.length ? `不见：${absent.join("、")}。` : "十神俱全。"}
      >
        <dl>
          {present.map((g) => (
            <div key={g} className="border-b border-rule py-5 first:pt-0 last:border-b-0 last:pb-0">
              <dt className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-heading text-xl font-semibold">{g}</span>
                <span className="text-xs text-muted-foreground">{TEN_GOD_GROUP[g]}</span>
                <span className="text-sm">
                  {positions[g].map((x, i) => (
                    <span key={i} className={x.hidden ? "text-muted-foreground" : ""}>
                      {i > 0 && "、"}
                      <span className="font-heading font-semibold" style={{ color: getCharColor(x.char) }}>
                        {x.char}
                      </span>{" "}
                      {x.where}
                    </span>
                  ))}
                </span>
              </dt>
              <dd className="mt-2 max-w-2xl text-[0.9375rem] leading-[1.9] text-muted-foreground">{MEANING[g]}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
