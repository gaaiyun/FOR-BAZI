/**
 * AI Reading page (AI 解读) – automated Bazi analysis.
 *
 * Features:
 * - Button to trigger full bazi analysis
 * - SSE streaming with token accumulation
 * - Shows analysis sections as they stream in
 * - Tool call status for each tool used
 * - Fact-check warnings
 */

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { useBaziStore } from "@/stores/useBaziStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useChatSSE } from "@/hooks/useChatSSE";
import { ToolCallStatus } from "@/components/chat/ToolCallStatus";
import { Button } from "@/components/ui/button";
import type { ChatMessage, ToolCallInfo } from "@/types/bazi";

// ── Analysis Prompt ────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `请对以下命盘进行全面的八字分析，包括：
1. 命盘格局总论（日主强弱、格局类型）
2. 五行喜忌分析
3. 十神分析与性格特征
4. 大运走势概述
5. 事业、财运、感情、健康方面的解读
6. 开运建议

请用专业的命理术语，同时保持通俗易懂。`;

// ── Component ──────────────────────────────────────────────────────────

export default function AIReading() {
  const reading = useBaziStore((s) => s.reading);
  const provider = useSettingsStore((s) => s.ai_provider);

  const [analysisContent, setAnalysisContent] = useState("");
  const [analysisToolCalls, setAnalysisToolCalls] = useState<ToolCallInfo[]>([]);
  const [factCheckWarnings, setFactCheckWarnings] = useState<string[]>([]);
  const [hasRun, setHasRun] = useState(false);

  // Track the completed messages from the hook.
  const messagesRef = useRef<ChatMessage[]>([]);

  const handleComplete = useCallback((msg: ChatMessage) => {
    messagesRef.current = [...messagesRef.current, msg];
  }, []);

  const {
    isStreaming,
    tokens,
    status,
    toolCalls,
    error,
    sendMessage,
    abort,
  } = useChatSSE({
    provider,
    chartData: reading,
    history: [],
    onComplete: handleComplete,
  });

  // ── Sync tool calls to local state ────────────────────────────────

  useEffect(() => {
    setAnalysisToolCalls(toolCalls);
  }, [toolCalls]);

  // ── Trigger analysis ──────────────────────────────────────────────

  const handleStartAnalysis = useCallback(async () => {
    if (!reading) return;

    // Reset state.
    setAnalysisContent("");
    setAnalysisToolCalls([]);
    setFactCheckWarnings([]);
    setHasRun(true);
    messagesRef.current = [];

    const result = await sendMessage(ANALYSIS_PROMPT);

    if (result) {
      // Extract any fact-check warnings from the content.
      const warnings: string[] = [];
      const warningPattern = /(?:⚠️|警告|注意)[：:]\s*(.+)/g;
      let match;
      while ((match = warningPattern.exec(result.content)) !== null) {
        warnings.push(match[1]);
      }
      setFactCheckWarnings(warnings);
    }
  }, [reading, sendMessage]);

  // ── Update content as tokens stream in ─────────────────────────────

  useEffect(() => {
    if (isStreaming && tokens) {
      setAnalysisContent(tokens);
    }
  }, [isStreaming, tokens]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-[#d4af37]">
          AI 解读 · AI Reading
        </h1>
        <p className="mt-2 text-sm text-[#8b949e]">
          AI 生成的八字命盘全面解读分析
        </p>
      </div>

      {/* No chart state */}
      {!reading && (
        <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-8 text-center">
          <span className="text-4xl block mb-3">☷</span>
          <h3 className="font-heading text-lg text-[#d4af37] mb-2">
            请先排盘
          </h3>
          <p className="text-sm text-[#8b949e]">
            请先在排盘页面输入出生信息，然后进行 AI 解读。
          </p>
        </div>
      )}

      {/* Chart loaded but no analysis yet */}
      {reading && !hasRun && !isStreaming && (
        <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-8 text-center space-y-4">
          <span className="block text-4xl text-[#d4af37]/90">☱</span>
          <h3 className="font-heading text-lg text-[#d4af37]">
            准备就绪
          </h3>
          <p className="text-sm text-[#8b949e] max-w-md mx-auto">
            命盘已排好，点击下方按钮开始 AI 全面解读。
            分析将包括格局总论、五行喜忌、十神性格、大运走势等方面。
          </p>
          <Button
            onClick={handleStartAnalysis}
            className="bg-[#d4af37] text-[#0d1117] hover:bg-[#d4af37]/80 font-medium px-6"
          >
            开始 AI 解读
          </Button>
        </div>
      )}

      {/* Analysis in progress or completed */}
      {(hasRun || isStreaming) && reading && (
        <div className="space-y-4">
          {/* Control bar */}
          <div className="flex items-center justify-between rounded-xl border border-[#30363d] bg-[#0d1117] px-4 py-3">
            <div className="flex items-center gap-3">
              {isStreaming ? (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4af37] opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-[#d4af37]" />
                  </span>
                  <span className="text-sm text-[#d4af37] animate-pulse">
                    {status || "正在分析..."}
                  </span>
                </>
              ) : (
                <>
                  <span className="h-3 w-3 rounded-full bg-[#50c878]" />
                  <span className="text-sm text-[#8b949e]">
                    分析完成
                  </span>
                </>
              )}
            </div>

            <div className="flex gap-2">
              {isStreaming && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={abort}
                  className="border-[#e94560]/40 text-[#e94560] hover:bg-[#e94560]/10"
                >
                  停止
                </Button>
              )}
              {!isStreaming && hasRun && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartAnalysis}
                  className="border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10"
                >
                  重新分析
                </Button>
              )}
            </div>
          </div>

          {/* Tool calls */}
          {analysisToolCalls.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-[#8b949e] px-1">
                工具调用
              </h3>
              {analysisToolCalls.map((tc) => (
                <ToolCallStatus key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}

          {/* Fact-check warnings */}
          {factCheckWarnings.length > 0 && (
            <div className="rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/5 p-4">
              <h3 className="text-sm font-medium text-[#d4af37] mb-2">
                ⚠️ 注意事项
              </h3>
              <ul className="space-y-1">
                {factCheckWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-[#d4af37]/80">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Analysis content */}
          {analysisContent ? (
            <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-6">
              <div className="prose-sm max-w-none text-[#e6edf3]">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children, ...props }: React.ComponentProps<"h1">) => (
                      <h1
                        className="font-heading text-xl font-semibold text-[#d4af37] mb-3 mt-6 first:mt-0 border-b border-[#30363d] pb-2"
                        {...props}
                      >
                        {children}
                      </h1>
                    ),
                    h2: ({ children, ...props }: React.ComponentProps<"h2">) => (
                      <h2
                        className="font-heading text-lg font-semibold text-[#d4af37] mb-2 mt-5 first:mt-0"
                        {...props}
                      >
                        {children}
                      </h2>
                    ),
                    h3: ({ children, ...props }: React.ComponentProps<"h3">) => (
                      <h3
                        className="font-heading text-base font-semibold text-[#e6edf3] mb-2 mt-4 first:mt-0"
                        {...props}
                      >
                        {children}
                      </h3>
                    ),
                    p: ({ children, ...props }: React.ComponentProps<"p">) => (
                      <p className="mb-3 leading-relaxed text-sm" {...props}>
                        {children}
                      </p>
                    ),
                    ul: ({ children, ...props }: React.ComponentProps<"ul">) => (
                      <ul
                        className="list-disc list-inside mb-3 space-y-1 text-sm"
                        {...props}
                      >
                        {children}
                      </ul>
                    ),
                    ol: ({ children, ...props }: React.ComponentProps<"ol">) => (
                      <ol
                        className="list-decimal list-inside mb-3 space-y-1 text-sm"
                        {...props}
                      >
                        {children}
                      </ol>
                    ),
                    li: ({ children, ...props }: React.ComponentProps<"li">) => (
                      <li className="leading-relaxed" {...props}>
                        {children}
                      </li>
                    ),
                    blockquote: ({
                      children,
                      ...props
                    }: React.ComponentProps<"blockquote">) => (
                      <blockquote
                        className="border-l-2 border-[#d4af37] pl-3 mb-3 text-[#8b949e] italic"
                        {...props}
                      >
                        {children}
                      </blockquote>
                    ),
                    code: ({
                      className,
                      children,
                      ...props
                    }: React.ComponentProps<"code">) => {
                      const isBlock = className?.includes("language-");
                      if (isBlock) {
                        return (
                          <pre className="mb-3 rounded-lg bg-[#0d1117] border border-[#30363d] p-3 overflow-x-auto">
                            <code
                              className={cn(
                                "text-xs text-[#e6edf3]",
                                className
                              )}
                              {...props}
                            >
                              {children}
                            </code>
                          </pre>
                        );
                      }
                      return (
                        <code
                          className="rounded bg-[#1c2128] px-1.5 py-0.5 text-xs text-[#d4af37] font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    strong: ({
                      children,
                      ...props
                    }: React.ComponentProps<"strong">) => (
                      <strong className="font-semibold text-[#d4af37]" {...props}>
                        {children}
                      </strong>
                    ),
                    table: ({
                      children,
                      ...props
                    }: React.ComponentProps<"table">) => (
                      <div className="mb-3 overflow-x-auto">
                        <table
                          className="w-full text-sm border-collapse border border-[#30363d]"
                          {...props}
                        >
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({
                      children,
                      ...props
                    }: React.ComponentProps<"th">) => (
                      <th
                        className="border border-[#30363d] bg-[#1c2128] px-3 py-2 text-left text-xs font-medium text-[#d4af37]"
                        {...props}
                      >
                        {children}
                      </th>
                    ),
                    td: ({
                      children,
                      ...props
                    }: React.ComponentProps<"td">) => (
                      <td
                        className="border border-[#30363d] px-3 py-2 text-xs"
                        {...props}
                      >
                        {children}
                      </td>
                    ),
                    hr: ({ ...props }: React.ComponentProps<"hr">) => (
                      <hr className="my-4 border-[#30363d]" {...props} />
                    ),
                  }}
                >
                  {analysisContent}
                </ReactMarkdown>
              </div>

              {/* Streaming cursor */}
              {isStreaming && (
                <span className="inline-block h-4 w-0.5 bg-[#d4af37] animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          ) : (
            isStreaming && (
              <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-8 text-center">
                <div className="flex items-center justify-center gap-2 text-[#8b949e]">
                  <span className="h-2 w-2 rounded-full bg-[#d4af37] animate-bounce [animation-delay:0ms]" />
                  <span className="h-2 w-2 rounded-full bg-[#d4af37] animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-[#d4af37] animate-bounce [animation-delay:300ms]" />
                  <span className="ml-2 text-sm">正在生成分析...</span>
                </div>
              </div>
            )
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-[#e94560]/40 bg-[#e94560]/10 px-4 py-3 text-sm text-[#e94560]">
              <p className="font-medium">分析出错</p>
              <p className="text-xs text-[#e94560]/80 mt-1">{error}</p>
              <button
                type="button"
                onClick={handleStartAnalysis}
                className="mt-2 text-xs text-[#d4af37] hover:underline"
              >
                重试
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
