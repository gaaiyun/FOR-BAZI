/**
 * 排盘页（/）。
 *
 * 排盘是纯本地计算，所以不必等用户点按钮：日期时间一填完整，右侧就即时
 * 显示四柱预览，改一个时辰能立刻看到时柱怎么变。点「排盘」才把这份命盘
 * 存下来并进入命盘页。
 *
 * 支持公历 / 农历（含闰月）输入，以及按出生地经度做真太阳时校正。
 */

import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useBaziStore } from "@/stores/useBaziStore";
import { PageHeader, Section } from "@/components/layout/Page";
import { calculateChart } from "@/engine";
import { resolveBirth, formatDateTime, CITIES } from "@/lib/solar-time";
import { BRANCHES } from "@/lib/ganzhi";
import { getCharColor } from "@/lib/wuxing-colors";
import type { BaziInput, BaziReading } from "@/types/bazi";

const CUSTOM = "__custom__";

/** 23:00–00:59 子时，01:00–02:59 丑时…… */
function shichen(d: Date): string {
  return BRANCHES[Math.floor(((d.getHours() + 1) % 24) / 2)] + "时";
}

function usePreview(input: BaziInput) {
  return useMemo(() => {
    // 农历三个框没填全时 birth_date 形如 "1985--"，同样算未填完
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(input.birth_date) || !input.birth_time) {
      return { state: "empty" as const };
    }
    try {
      const r = resolveBirth(input);
      const y = r.effective.getFullYear();
      if (y < 1900 || y > 2100) return { state: "error" as const, message: "目前支持 1900–2100 年出生。" };
      const gender = input.gender === "male" ? "乾造 (Male)" : "坤造 (Female)";
      const { chart } = calculateChart(formatDateTime(r.effective), gender);
      return { state: "ok" as const, resolved: r, pillars: chart.pillars };
    } catch (e) {
      return { state: "error" as const, message: e instanceof Error ? e.message : "无法解析出生时间。" };
    }
  }, [input]);
}

export default function BaziCalculator() {
  const navigate = useNavigate();
  const { input, setInput, calculate, error, history, openFromHistory, removeFromHistory } = useBaziStore();
  const preview = usePreview(input);
  const lunar = input.calendar_type === "lunar";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (await calculate()) navigate("/chart");
    },
    [calculate, navigate]
  );

  // 出生地下拉的当前值
  const placeValue = !input.true_solar
    ? ""
    : CITIES.some((c) => c.name === input.place)
      ? (input.place as string)
      : CUSTOM;

  const onPlace = (v: string) => {
    if (!v) return setInput({ true_solar: false, place: "", longitude: null });
    if (v === CUSTOM) return setInput({ true_solar: true, place: "", longitude: input.longitude ?? 116.4 });
    const city = CITIES.find((c) => c.name === v);
    if (city) setInput({ true_solar: true, place: city.name, longitude: city.lng });
  };

  // 农历输入拆成年、月、日三个框；公历用原生日期选择器
  const [ly, lm, ld] = (input.birth_date || "--").split("-");
  const setLunarPart = (part: 0 | 1 | 2, v: string) => {
    const parts = [ly || "", lm || "", ld || ""];
    parts[part] = v;
    setInput({ birth_date: parts.join("-") });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="排盘"
        description="四柱、藏干、十神、五行力量、格局与大运都在你的浏览器里按规则算出，不经过大模型，也不上传出生信息。"
      />

      <div className="grid gap-x-16 gap-y-10 border-t border-foreground pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* ── 表单 ─────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-7" noValidate>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <fieldset>
              <legend className="eyebrow">性别</legend>
              <div className="seg mt-1" role="radiogroup">
                {([
                  { v: "male", label: "男 · 乾造" },
                  { v: "female", label: "女 · 坤造" },
                ] as const).map((g) => (
                  <button
                    key={g.v}
                    type="button"
                    role="radio"
                    aria-checked={input.gender === g.v}
                    data-on={input.gender === g.v}
                    onClick={() => setInput({ gender: g.v })}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="eyebrow">历法</legend>
              <div className="seg mt-1" role="radiogroup">
                {([
                  { v: "solar", label: "公历" },
                  { v: "lunar", label: "农历" },
                ] as const).map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    role="radio"
                    aria-checked={(input.calendar_type ?? "solar") === c.v}
                    data-on={(input.calendar_type ?? "solar") === c.v}
                    onClick={() => setInput({ calendar_type: c.v, birth_date: "", lunar_leap: false })}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {lunar ? (
              <fieldset>
                <legend className="eyebrow">农历出生日期</legend>
                <div className="mt-1 grid grid-cols-[1.3fr_1fr_1fr] gap-3">
                  <input
                    className="field tabular"
                    inputMode="numeric"
                    placeholder="年"
                    aria-label="农历年"
                    maxLength={4}
                    value={ly || ""}
                    onChange={(e) => setLunarPart(0, e.target.value.replace(/\D/g, ""))}
                  />
                  <select className="field" aria-label="农历月" value={lm || ""} onChange={(e) => setLunarPart(1, e.target.value)}>
                    <option value="">月</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={String(i + 1)}>
                        {i + 1} 月
                      </option>
                    ))}
                  </select>
                  <select className="field" aria-label="农历日" value={ld || ""} onChange={(e) => setLunarPart(2, e.target.value)}>
                    <option value="">日</option>
                    {Array.from({ length: 30 }, (_, i) => (
                      <option key={i} value={String(i + 1)}>
                        {i + 1} 日
                      </option>
                    ))}
                  </select>
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--foreground)]"
                    checked={Boolean(input.lunar_leap)}
                    onChange={(e) => setInput({ lunar_leap: e.target.checked })}
                  />
                  这个月是闰月
                </label>
              </fieldset>
            ) : (
              <label className="block">
                <span className="eyebrow">公历出生日期</span>
                <input
                  type="date"
                  required
                  min="1900-01-01"
                  max="2100-12-31"
                  value={input.birth_date}
                  onChange={(e) => setInput({ birth_date: e.target.value })}
                  className="field tabular mt-1"
                />
              </label>
            )}

            <label className="block">
              <span className="eyebrow">出生时间</span>
              <input
                type="time"
                required
                value={input.birth_time}
                onChange={(e) => setInput({ birth_time: e.target.value })}
                className="field tabular mt-1"
              />
              <span className="mt-2 block text-xs text-muted-foreground">
                按出生证或户口本上的钟表时间填，精确到分钟
              </span>
            </label>
          </div>

          <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            <div>
              <label className="block">
                <span className="eyebrow">出生地（真太阳时）</span>
                <select className="field mt-1" value={placeValue} onChange={(e) => onPlace(e.target.value)}>
                  <option value="">不校正，按北京时间</option>
                  {CITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}（东经 {c.lng.toFixed(1)}°）
                    </option>
                  ))}
                  <option value={CUSTOM}>其他地点，自己填经度</option>
                </select>
              </label>
              {placeValue === CUSTOM && (
                <label className="mt-4 block">
                  <span className="eyebrow">东经（度）</span>
                  <input
                    type="number"
                    step="0.1"
                    min={60}
                    max={140}
                    className="field tabular mt-1"
                    value={input.longitude ?? ""}
                    onChange={(e) =>
                      setInput({ longitude: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </label>
              )}
            </div>

            <label className="block">
              <span className="eyebrow">称呼（可不填）</span>
              <input
                className="field mt-1"
                value={input.name ?? ""}
                maxLength={20}
                placeholder="用来区分多份命盘"
                onChange={(e) => setInput({ name: e.target.value })}
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="pt-2 lg:hidden">
            <Preview preview={preview} />
          </div>

          <button type="submit" className="btn btn-primary w-full sm:w-auto sm:min-w-40" disabled={preview.state !== "ok"}>
            排盘
          </button>
        </form>

        {/* ── 即时预览（宽屏）────────────────────────────────────── */}
        <aside className="hidden lg:block">
          <Preview preview={preview} />
        </aside>
      </div>

      {history.length > 0 && (
        <Section title="排过的命盘" description="只存在这台设备的浏览器里。" className="mt-12">
          <History
            items={history}
            onOpen={(id) => {
              openFromHistory(id);
              navigate("/chart");
            }}
            onRemove={removeFromHistory}
          />
        </Section>
      )}

      <p className="mt-10 max-w-xl text-xs leading-relaxed text-faint">
        命理属传统文化范畴。程序按既定规则运行，不代表结论具有科学预测效力，请勿据此做医疗、投资或其他重大决定。
      </p>
    </div>
  );
}

function Preview({ preview }: { preview: ReturnType<typeof usePreview> }) {
  if (preview.state === "empty") {
    return (
      <div>
        <p className="eyebrow">四柱预览</p>
        <div className="glyph mt-4 flex gap-5 text-[2.75rem] text-rule" aria-hidden>
          {["年", "月", "日", "时"].map((c) => (
            <span key={c} className="flex flex-col gap-2">
              <span>○</span>
              <span>○</span>
            </span>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted-foreground">填好日期和时间，这里会立刻显示四柱。</p>
      </div>
    );
  }
  if (preview.state === "error") {
    return (
      <div>
        <p className="eyebrow">四柱预览</p>
        <p role="alert" className="mt-4 text-sm text-destructive">
          {preview.message}
        </p>
      </div>
    );
  }
  const { resolved, pillars } = preview;
  return (
    <div>
      <p className="eyebrow">四柱预览</p>
      <div className="glyph mt-4 flex gap-5 text-[2.75rem] sm:text-[3.25rem]" key={pillars.join("")}>
        {pillars.map((p, i) => (
          <span
            key={i}
            className="flex flex-col gap-2"
            style={{ animation: `ink-in 500ms var(--ease-out-expo) ${i * 60}ms both` }}
          >
            <span style={{ color: getCharColor(p[0]) }}>{p[0]}</span>
            <span style={{ color: getCharColor(p[1]) }}>{p[1]}</span>
          </span>
        ))}
      </div>
      <dl className="mt-5 space-y-1.5 text-sm">
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-muted-foreground">排盘时间</dt>
          <dd className="tabular">
            {formatDateTime(resolved.effective)}
            <span className="ml-3">{shichen(resolved.effective)}</span>
          </dd>
        </div>
        {resolved.notes.map((n) => (
          <div key={n} className="flex gap-3">
            <dt className="w-16 shrink-0 text-muted-foreground">换算</dt>
            <dd className="text-muted-foreground">{n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function History({
  items,
  onOpen,
  onRemove,
}: {
  items: BaziReading[];
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <ul>
      {items.map((r, idx) => {
        const c = r.chart;
        const gz = [c.year_pillar, c.month_pillar, c.day_pillar, c.hour_pillar];
        const id = r.id ?? "";
        return (
          <li key={id || idx} className="flex items-center gap-4 border-b border-rule py-3 first:pt-0 last:border-b-0">
            <button
              type="button"
              disabled={!id}
              onClick={() => onOpen(id)}
              className="group flex min-w-0 flex-1 flex-wrap items-baseline gap-x-5 gap-y-1 text-left"
            >
              <span className="glyph flex gap-2 text-xl">
                {gz.map((p, i) => (
                  <span key={i}>
                    <span style={{ color: getCharColor(p.stem) }}>{p.stem}</span>
                    <span style={{ color: getCharColor(p.branch) }}>{p.branch}</span>
                  </span>
                ))}
              </span>
              <span className="min-w-0 truncate text-sm text-muted-foreground group-hover:text-foreground">
                {[r.birth?.name, r.birth ? (r.birth.gender === "male" ? "男" : "女") : null, r.birth?.clock, r.birth?.place]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
            {id && (
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="shrink-0 py-2 text-xs text-faint transition-colors hover:text-destructive"
                aria-label="删除这份命盘"
              >
                删除
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
