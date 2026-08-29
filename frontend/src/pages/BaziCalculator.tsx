/**
 * BaziCalculator page (/) -- main input form for Bazi calculation.
 * Collects birth date, time, and gender, then calls the API
 * and navigates to /chart on success.
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useBaziStore } from "@/stores/useBaziStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          <Card className="border border-[#30363d] bg-[#161b22]/60 backdrop-blur-md">
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
          <Card className="border border-[#30363d] bg-[#161b22]/60 backdrop-blur-md">
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
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-[#d4af37]">
          排盘 · Bazi Calculator
        </h1>
        <p className="mt-2 text-[#8b949e]">
          Enter birth details to calculate the Four Pillars of Destiny.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Input Form ──────────────────────────────────────── */}
        <Card className="border border-[#30363d] bg-[#161b22]/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-[#e6edf3]">出生信息</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Birth date */}
              <div className="space-y-1.5">
                <label
                  htmlFor="birth-date"
                  className="block text-sm font-medium text-[#8b949e]"
                >
                  出生日期
                </label>
                <input
                  id="birth-date"
                  type="date"
                  required
                  value={input.birth_date}
                  onChange={(e) => setInput({ birth_date: e.target.value })}
                  className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[#e6edf3] outline-none transition-colors focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50"
                />
              </div>

              {/* Birth time */}
              <div className="space-y-1.5">
                <label
                  htmlFor="birth-time"
                  className="block text-sm font-medium text-[#8b949e]"
                >
                  出生时辰
                </label>
                <input
                  id="birth-time"
                  type="time"
                  required
                  value={input.birth_time}
                  onChange={(e) => setInput({ birth_time: e.target.value })}
                  className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[#e6edf3] outline-none transition-colors focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50"
                />
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-[#8b949e]">
                  性别
                </span>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#e6edf3]">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={input.gender === "male"}
                      onChange={() => setInput({ gender: "male" })}
                      className="accent-[#d4af37]"
                    />
                    乾造 (男)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#e6edf3]">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={input.gender === "female"}
                      onChange={() => setInput({ gender: "female" })}
                      className="accent-[#d4af37]"
                    />
                    坤造 (女)
                  </label>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <p className="rounded-md bg-[#e94560]/10 px-3 py-2 text-sm text-[#e94560]">
                  {error}
                </p>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#d4af37] text-[#0d1117] hover:bg-[#d4af37]/80 font-semibold"
              >
                {isLoading ? "计算中..." : "生成命盘"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ── Preview / Placeholder ───────────────────────────── */}
        <Card className="border border-[#30363d] bg-[#161b22]/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-[#e6edf3]">命盘预览</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            {/* Decorative trigram symbol */}
            <div className="text-6xl text-[#d4af37]/20 select-none">☰</div>
            <p className="text-sm text-[#8b949e]">
              填写出生信息后，点击"生成命盘"计算四柱八字。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
