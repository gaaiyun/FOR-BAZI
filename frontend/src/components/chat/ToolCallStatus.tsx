/**
 * 工具调用记录。
 *
 * AI 在解读时会调用本地工具取证（查某年干支、查古籍原文……）。这里把每次
 * 调用列成一行小字，点开能看到参数与返回，方便核对它引用的东西是否属实。
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ToolCallInfo } from "@/types/bazi";

const TOOL_LABEL: Record<string, string> = {
  get_annual_fortune: "查流年干支",
  get_dayun_stage: "查所在大运",
  analyze_wuxing_balance: "查五行个数",
  calculate_wuxing_power: "算五行力量",
  analyze_geju: "判格局",
  query_xing_chong_he_hai: "查刑冲合害",
  explain_shensha: "查神煞释义",
  fact_check_ganzhi: "核对干支",
  query_qiongtong_guidance: "查《穷通宝鉴》",
  query_disitian_guidance: "查《滴天髓》",
  query_ziping_guidance: "查《子平真诠》",
  query_sanming_guidance: "查《三命通会》",
  query_classical_text: "检索古籍",
  rag_retrieve: "跨书检索",
};

function pretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function ToolCallStatus({ toolCall, className }: { toolCall: ToolCallInfo; className?: string }) {
  const [open, setOpen] = useState(false);
  const running = toolCall.status === "calling";
  const failed = toolCall.status === "error";

  return (
    <div className={cn("text-xs", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-2 py-1 text-left text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className={cn("w-3 shrink-0", failed && "text-destructive")} aria-hidden>
          {running ? "…" : failed ? "×" : "✓"}
        </span>
        <span>{TOOL_LABEL[toolCall.name] ?? toolCall.name}</span>
        <span className="text-faint">{running ? "进行中" : failed ? "失败" : open ? "收起" : "查看"}</span>
      </button>

      {open && (
        <div className="mb-2 ml-5 space-y-2 border-l border-rule pl-3">
          {toolCall.arguments && toolCall.arguments !== "{}" && (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed text-muted-foreground">
              {pretty(toolCall.arguments)}
            </pre>
          )}
          {toolCall.result !== null && (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
              {pretty(toolCall.result)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/** 一组工具调用，带一行总述。 */
export function ToolCallList({ toolCalls, className }: { toolCalls: ToolCallInfo[]; className?: string }) {
  if (!toolCalls.length) return null;
  return (
    <div className={cn("border-l border-rule pl-3", className)}>
      <p className="eyebrow mb-1">取证 {toolCalls.length} 次</p>
      {toolCalls.map((tc) => (
        <ToolCallStatus key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
}

export default ToolCallStatus;
