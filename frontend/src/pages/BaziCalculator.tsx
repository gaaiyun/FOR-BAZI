/**
 * BaziCalculator page (/) -- main input form for Bazi calculation.
 * Collects birth date, time, and gender, then calls the API
 * and navigates to /chart on success.
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useBaziStore } from "@/stores/useBaziStore";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ── Component ─────────────────────────────────────────────────────

export default function BaziCalculator() {
  const navigate = useNavigate();
  const { input, setInput, calculate, isLoading, error } = useBaziStore();

  // ── Handlers ──────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const reading = await calculate();
      if (reading) {
        navigate("/chart");
      }
    },
    [calculate, navigate]
  );

  // ── Loading skeleton ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border border-border bg-card/60 backdrop-blur-md">
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
          <Card className="border border-border bg-card/60 backdrop-blur-md">
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="rounded-full p-6">
                <Skeleton className="h-16 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────

  return (
    <div className="animate-fade-in mx-auto max-w-5xl space-y-8">
      {/* ── Hero：让人一眼知道这是什么、算的是什么 ─────────────── */}
      <header className="relative overflow-hidden rounded-2xl surface-raised px-6 py-9 sm:px-10 sm:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }}
        />
        {/* 八卦爻线 motif。用 SVG 而非 Unicode 卦象字符：
            ䷀ 这类字符多数中文字体缺字，会渲染成乱码方块。 */}
        <svg
          aria-hidden
          viewBox="0 0 120 120"
          className="pointer-events-none absolute right-8 top-1/2 hidden h-36 w-36 -translate-y-1/2 sm:block"
        >
          <g fill="var(--primary)" opacity="0.09">
            {[0, 1, 2, 3, 4, 5].map((i) =>
              i % 2 === 0 ? (
                <rect key={i} x="10" y={i * 20 + 4} width="100" height="9" rx="4.5" />
              ) : (
                <g key={i}>
                  <rect x="10" y={i * 20 + 4} width="42" height="9" rx="4.5" />
                  <rect x="68" y={i * 20 + 4} width="42" height="9" rx="4.5" />
                </g>
              )
            )}
          </g>
        </svg>

        <div className="relative max-w-xl">
          <p className="rule-accent text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Four Pillars of Destiny
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            玄冥 · 八字排盘
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            四柱、藏干、纳音、神煞、大运全部由确定性规则算出，<span className="text-foreground/80">不经过大模型</span>；
            AI 只负责在算好的命盘上解读，且引用流年与古籍原文时必须调用工具取证。
          </p>

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {[
              { k: "计算方式", v: "浏览器本地" },
              { k: "古籍库", v: "五部经典" },
              { k: "回归测试", v: "478 项" },
            ].map((s) => (
              <div key={s.k}>
                <dt className="text-[11px] text-muted-foreground">{s.k}</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
        {/* ── 输入 ─────────────────────────────────────────────── */}
        <section className="surface-panel rounded-xl p-6">
          <h2 className="rule-accent font-heading text-base font-semibold text-foreground">
            出生信息
          </h2>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="birth-date" className="block text-sm font-medium text-muted-foreground">
                出生日期
              </label>
              <input
                id="birth-date"
                type="date"
                required
                value={input.birth_date}
                onChange={(e) => setInput({ birth_date: e.target.value })}
                className="w-full rounded-lg border border-border bg-background/60 px-3 py-2.5 text-foreground outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:border-gold focus:ring-2 focus:ring-gold/25"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="birth-time" className="block text-sm font-medium text-muted-foreground">
                出生时辰
              </label>
              <input
                id="birth-time"
                type="time"
                required
                value={input.birth_time}
                onChange={(e) => setInput({ birth_time: e.target.value })}
                className="w-full rounded-lg border border-border bg-background/60 px-3 py-2.5 text-foreground outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:border-gold focus:ring-2 focus:ring-gold/25"
              />
              <p className="text-[11px] text-muted-foreground">
                时辰决定时柱与大运起运，尽量精确到分钟
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-muted-foreground">性别</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "male" as const, label: "乾造", sub: "男" },
                  { v: "female" as const, label: "坤造", sub: "女" },
                ].map((g) => {
                  const active = input.gender === g.v;
                  return (
                    <label
                      key={g.v}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-[background-color,border-color] duration-[var(--dur-fast)] ${
                        active
                          ? "border-gold/50 bg-gold/10 text-gold"
                          : "border-border bg-background/40 text-foreground/80 hover:border-border/80 hover:bg-background/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={g.v}
                        checked={active}
                        onChange={() => setInput({ gender: g.v })}
                        className="sr-only"
                      />
                      <span className="font-medium">{g.label}</span>
                      <span className="text-xs opacity-70">{g.sub}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">性别决定大运顺行或逆行</p>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gold py-2.5 font-semibold text-background hover:bg-gold/85"
            >
              {isLoading ? "计算中…" : "生成命盘"}
            </Button>
          </form>
        </section>

        {/* ── 说明：把空placeholder换成真正有信息的内容 ─────────── */}
        <section className="surface-panel rounded-xl p-6">
          <h2 className="rule-accent font-heading text-base font-semibold text-foreground">
            会算出什么
          </h2>

          <ul className="mt-5 space-y-4">
            {[
              { t: "四柱与十神", d: "年月日时干支、藏干、纳音、地势、旬空" },
              { t: "五行力量", d: "含藏干、月令加权与十二长生的精算，非简单计数" },
              { t: "格局判定", d: "取格看透干；从格须过传统判准，不轻言从" },
              { t: "大运流年", d: "起运推演至九步，可查任一年所处阶段" },
              { t: "神煞刑冲", d: "桃花驿马等八类神煞，六合六冲三合三会" },
            ].map((f) => (
              <li key={f.t} className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold/60" />
                <div>
                  <p className="text-sm font-medium text-foreground">{f.t}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.d}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-6 border-t border-border/60 pt-4 text-[11px] leading-relaxed text-muted-foreground">
            命理属传统文化范畴。程序按既定规则运行不代表结论具有科学预测效力，
            请勿据此做医疗、投资或人生决策。
          </p>
        </section>
      </div>
    </div>
  );
}
