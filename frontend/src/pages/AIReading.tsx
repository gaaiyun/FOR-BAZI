/**
 * 解读页（/ai-reading）。
 *
 * 选一个主题，让 AI 在算好的命盘上写一篇解读。正文按长文排版（宋体、
 * 宽行距），取证过程折在正文上方。结果按「命盘 + 主题」存在本地，
 * 刷新或切走再回来还在；可以复制、存成文件或打印。
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/layout/Page";
import { useBaziStore } from "@/stores/useBaziStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useAIReadingStore } from "@/stores/useAIReadingStore";
import { useChatSSE } from "@/hooks/useChatSSE";
import { Markdown } from "@/components/chat/Markdown";
import { ToolCallList } from "@/components/chat/ToolCallStatus";
import { CopyChartButton } from "@/components/bazi/CopyChart";
import { copyText, downloadText } from "@/lib/clipboard";

const THIS_YEAR = new Date().getFullYear();

const TOPICS = [
  {
    id: "full",
    label: "完整解读",
    note: "格局、性格、事业、感情、健康、当前运势，篇幅最长",
    prompt: `请对这份命盘做一次完整解读，依次说明：
1. 格局与日主强弱，以及由此得出的喜用与忌神（说明取用依据）
2. 性格与天赋
3. 事业与财运
4. 感情与婚姻
5. 健康上需要留意的方面
6. 当前大运，以及 ${THIS_YEAR} 年、${THIS_YEAR + 1} 年两个流年各自的重点
要求：直接引用命盘里的干支、十神、刑冲合害作为依据；结论分清把握大小；不要用恐吓式的说法。`,
  },
  {
    id: "career",
    label: "事业财运",
    note: "适合的方向、求财方式、近几年的节奏",
    prompt: `请只谈事业与财运：
1. 从格局、十神看适合的行业方向与工作方式（受雇、合伙还是独立）
2. 财星与日主的关系，求财靠什么
3. 当前大运对事业的影响，以及 ${THIS_YEAR}、${THIS_YEAR + 1} 两年各自的重点
引用命盘里的干支和十神作为依据，结论分清把握大小。`,
  },
  {
    id: "love",
    label: "感情婚姻",
    note: "配偶宫、配偶星、相处模式与时间点",
    prompt: `请只谈感情与婚姻：
1. 日支（配偶宫）与配偶星的状态，以及它们受到的刑冲合害
2. 在亲密关系里的相处模式与需要留意的地方
3. 大运流年中感情变动较明显的时间段
引用命盘里的干支和十神作为依据，结论分清把握大小，不要下「克夫」「克妻」这类断语。`,
  },
  {
    id: "year",
    label: `${THIS_YEAR + 1} 年`,
    note: "明年的流年与原局、大运的作用",
    prompt: `请只谈 ${THIS_YEAR + 1} 年的流年：
1. 先调用工具确认该年干支，再说明它对日主是什么十神
2. 它与原局四柱、与当前大运之间的合冲刑害
3. 落到事业、财务、感情、健康上各自的重点，以及上半年与下半年的差别
引用具体干支作为依据，结论分清把握大小。`,
  },
] as const;

type TopicId = (typeof TOPICS)[number]["id"];

function formatTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AIReading() {
  const reading = useBaziStore((s) => s.reading);
  const provider = useSettingsStore((s) => s.ai_provider);
  const { saved, save, remove } = useAIReadingStore();

  const [topic, setTopic] = useState<TopicId>("full");
  // 正在生成的是哪个主题：生成中切换主题不应把流式内容显示到别的主题下
  const [running, setRunning] = useState<TopicId | null>(null);

  const { isStreaming, tokens, status, toolCalls, error, sendMessage, abort } = useChatSSE({
    provider,
    chartData: reading,
    history: [],
  });

  const key = `${reading?.id ?? "none"}::${topic}`;
  const stored = saved[key];
  const live = isStreaming && running === topic;
  const content = live ? tokens : (stored?.content ?? "");
  const calls = live ? toolCalls : (stored?.toolCalls ?? []);
  const meta = TOPICS.find((t) => t.id === topic)!;

  const start = useCallback(async () => {
    if (!reading) return;
    // 发起时就定下存档键：生成结束时用户可能已经切到别的主题
    const k = `${reading.id ?? "none"}::${topic}`;
    setRunning(topic);
    const msg = await sendMessage(TOPICS.find((t) => t.id === topic)!.prompt);
    setRunning(null);
    if (msg?.content) {
      save(k, { content: msg.content, toolCalls: msg.tool_calls ?? [], at: Date.now(), model: provider.model });
    }
  }, [reading, topic, sendMessage, save, provider.model]);

  // 离开页面时中止，避免后台继续消耗
  useEffect(() => abort, [abort]);

  if (!reading) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="解读" description="让 AI 在算好的命盘上写一篇解读。" />
        <EmptyState description="解读需要先有一份命盘，AI 才有东西可依据。" />
      </div>
    );
  }

  const busyElsewhere = isStreaming && running !== topic;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="解读"
        description="命盘由程序算好交给 AI，它只负责解读；引用流年干支和古籍原文时会先调用本地工具核对。"
      />

      {/* ── 主题 ─────────────────────────────────────────────── */}
      <div className="no-print border-t border-foreground pt-5">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="seg" role="tablist" aria-label="解读主题">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={topic === t.id}
                data-on={topic === t.id}
                onClick={() => setTopic(t.id)}
              >
                {t.label}
                {saved[`${reading.id ?? "none"}::${t.id}`] && topic !== t.id && (
                  <span className="ml-1 text-faint" aria-label="已有结果">
                    ·
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{meta.note}</p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          {live ? (
            <button type="button" className="btn btn-line" onClick={abort}>
              停止
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => void start()} disabled={busyElsewhere}>
              {stored ? "重新解读" : "开始解读"}
            </button>
          )}
          {live && <span className="caret text-sm text-muted-foreground">{status || "正在准备"}</span>}
          {busyElsewhere && <span className="text-sm text-muted-foreground">另一个主题正在生成，稍等。</span>}
          {!live && stored && (
            <span className="tabular text-xs text-muted-foreground">
              {formatTime(stored.at)} · {stored.model}
            </span>
          )}
        </div>
      </div>

      {/* ── 出错 ─────────────────────────────────────────────── */}
      {error && !isStreaming && (
        <div role="alert" className="mt-8 border-l border-destructive pl-4">
          <p className="text-sm text-destructive">{error}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            可以稍后再试，或到{" "}
            <Link to="/settings" className="link">
              设置
            </Link>{" "}
            换一个 AI 服务；也可以把命盘复制出去，交给自己的 AI。
          </p>
          <CopyChartButton compact className="mt-3" />
        </div>
      )}

      {/* ── 正文 ─────────────────────────────────────────────── */}
      {(content || calls.length > 0) && (
        <article className="mt-10 border-t border-rule pt-8">
          <ToolCallList toolCalls={calls} className="no-print mb-8" />
          {content && (
            <Markdown streaming={live} className="max-w-[42rem]">
              {content}
            </Markdown>
          )}

          {!live && stored && (
            <div className="no-print mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-rule pt-5 text-sm">
              <button
                type="button"
                className="link"
                onClick={async () => {
                  if (await copyText(stored.content)) toast.success("已复制全文");
                }}
              >
                复制全文
              </button>
              <button
                type="button"
                className="link"
                onClick={() => downloadText(`八字解读-${meta.label}.md`, stored.content)}
              >
                存为文件
              </button>
              <button type="button" className="link" onClick={() => window.print()}>
                打印
              </button>
              <Link to="/chat" className="link">
                接着追问
              </Link>
              <button type="button" className="ml-auto text-faint hover:text-destructive" onClick={() => remove(key)}>
                删除这篇
              </button>
            </div>
          )}
        </article>
      )}

      {/* ── 还没有结果 ─────────────────────────────────────────── */}
      {!content && !live && !error && (
        <div className="mt-12 max-w-xl border-t border-rule pt-8 text-sm leading-relaxed text-muted-foreground">
          <p>一次完整解读通常要一到两分钟。默认使用站长提供的 DeepSeek，每天有次数限制。</p>
          <p className="mt-2">想用更强的模型，可以在设置里填自己的服务，或者把命盘整份复制给自己常用的 AI：</p>
          <CopyChartButton compact className="mt-4" />
        </div>
      )}
    </div>
  );
}
