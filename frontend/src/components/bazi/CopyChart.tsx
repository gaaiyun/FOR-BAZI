/**
 * 复制命盘给自己的 AI。
 *
 * 主按钮一点即复制（默认：完整命盘 + 解读要求）。旁边的「选项」打开面板，
 * 可以改成只要数据 / JSON、隐去出生时间、附上古籍原文、换成自己的问题，
 * 面板里能看到将要复制的全文。
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useBaziStore } from "@/stores/useBaziStore";
import { buildChartText, type ChartTextMode } from "@/lib/chart-text";
import { copyText, downloadText } from "@/lib/clipboard";
import { ancientSection } from "@/engine/prompt";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { BaziReading } from "@/types/bazi";

const MODES: Array<{ id: ChartTextMode; label: string; note: string }> = [
  { id: "prompt", label: "命盘 + 提问", note: "粘贴后 AI 直接开始解读" },
  { id: "data", label: "只要命盘", note: "自己另写问题" },
  { id: "json", label: "JSON", note: "给程序或智能体用" },
];

function fileStem(reading: BaziReading): string {
  const p = reading.chart;
  const gz = [p.year_pillar, p.month_pillar, p.day_pillar, p.hour_pillar]
    .map((x) => x.stem + x.branch)
    .join("");
  return `八字命盘-${reading.birth?.name ? reading.birth.name + "-" : ""}${gz}`;
}

async function copyAndToast(text: string) {
  const ok = await copyText(text);
  if (ok) {
    toast.success("命盘已复制", { description: `${text.length} 字，粘贴到任意 AI 对话框即可` });
  } else {
    toast.error("复制失败", { description: "浏览器拒绝了剪贴板访问，请在「选项」里手动全选复制" });
  }
  return ok;
}

export function CopyChartButton({
  className,
  compact = false,
}: {
  className?: string;
  /** 用小号按钮 */
  compact?: boolean;
}) {
  const reading = useBaziStore((s) => s.reading);
  const [open, setOpen] = useState(false);
  if (!reading) return null;

  return (
    <>
      <div className={cn("no-print inline-flex items-stretch", className)}>
        <button
          type="button"
          className={cn("btn btn-primary", compact && "btn-sm")}
          onClick={() => void copyAndToast(buildChartText(reading))}
        >
          复制给 AI
        </button>
        <button
          type="button"
          className={cn("btn btn-line -ml-px", compact && "btn-sm")}
          onClick={() => setOpen(true)}
          aria-label="复制选项"
        >
          选项
        </button>
      </div>
      <CopyChartDialog reading={reading} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function CopyChartDialog({
  reading,
  open,
  onOpenChange,
}: {
  reading: BaziReading;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<ChartTextMode>("prompt");
  const [includeBirth, setIncludeBirth] = useState(true);
  const [withClassics, setWithClassics] = useState(false);
  const [question, setQuestion] = useState("");
  // 古籍段落按命盘缓存：换了命盘，旧段落自然失效。
  const [classics, setClassics] = useState<{ id: string; text: string } | null>(null);
  const chartId = reading.id ?? "";
  const classicsText = classics && classics.id === chartId ? classics.text : "";
  const needClassics = open && withClassics && !classicsText && Boolean(reading.engine_chart);

  // 古籍是按需加载的 JSON，勾选后才去取。
  useEffect(() => {
    if (!needClassics || !reading.engine_chart) return;
    let alive = true;
    ancientSection(reading.engine_chart)
      .then((t) => {
        if (alive) setClassics({ id: chartId, text: t || "（未查到对应条目）" });
      })
      .catch(() => {
        if (alive) setClassics({ id: chartId, text: "（古籍数据加载失败）" });
      });
    return () => {
      alive = false;
    };
  }, [needClassics, reading.engine_chart, chartId]);

  const text = useMemo(
    () =>
      buildChartText(reading, {
        mode,
        includeBirth,
        question,
        classics: withClassics && mode !== "json" ? classicsText : undefined,
      }),
    [reading, mode, includeBirth, question, withClassics, classicsText]
  );

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[92dvh] flex-col gap-0 rounded-none border border-foreground bg-background p-0 ring-0",
          "sm:max-w-2xl",
          "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:border-x-0 max-sm:border-b-0"
        )}
      >
        <div className="border-b border-rule px-5 py-4 pr-12 sm:px-6">
          <DialogTitle className="font-heading text-xl font-semibold">复制命盘</DialogTitle>
          <DialogDescription className="mt-1 text-xs text-muted-foreground">
            四柱、十神、五行、格局、大运流年都已算好，AI 不需要再排盘。
          </DialogDescription>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div>
            <div className="seg flex-wrap" role="tablist" aria-label="复制格式">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.id}
                  data-on={mode === m.id}
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{MODES.find((m) => m.id === mode)?.note}</p>
          </div>

          {mode === "prompt" && (
            <label className="block">
              <span className="text-xs text-muted-foreground">想问的事（留空则请 AI 做完整解读）</span>
              <input
                className="field mt-1"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="例如：明年适合换工作吗"
                maxLength={200}
              />
            </label>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--foreground)]"
                checked={includeBirth}
                onChange={(e) => setIncludeBirth(e.target.checked)}
              />
              带上出生日期时间
            </label>
            {mode !== "json" && (
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--foreground)]"
                  checked={withClassics}
                  onChange={(e) => setWithClassics(e.target.checked)}
                />
                附上相关古籍原文
              </label>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">将要复制的内容</span>
              <span className="tabular text-xs text-muted-foreground">{text.length} 字</span>
            </div>
            <textarea
              readOnly
              value={text}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="将要复制的内容"
              className="mt-2 h-56 w-full resize-none border border-rule bg-wash p-3 font-mono leading-relaxed outline-none focus:border-foreground sm:h-72"
              style={{ fontSize: "12px" }}
            />
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-2 border-t border-rule px-5 pt-4 sm:px-6"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            className="btn btn-primary flex-1 sm:flex-none"
            onClick={async () => {
              if (await copyAndToast(text)) onOpenChange(false);
            }}
          >
            复制
          </button>
          <button
            type="button"
            className="btn btn-line"
            onClick={() =>
              downloadText(
                `${fileStem(reading)}.${mode === "json" ? "json" : "md"}`,
                text,
                mode === "json" ? "application/json" : "text/markdown"
              )
            }
          >
            存为文件
          </button>
          {canShare && (
            <button
              type="button"
              className="btn btn-line"
              onClick={() => void navigator.share({ title: "八字命盘", text }).catch(() => {})}
            >
              分享
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CopyChartButton;
