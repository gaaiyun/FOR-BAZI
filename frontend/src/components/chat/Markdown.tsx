/**
 * AI 输出的 Markdown 渲染。解读页和问事页共用，样式都在 index.css 的 .prose-ming。
 */

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const components = {
  // 表格外包一层，窄屏时横向滚动而不是撑破版心
  table: ({ children, ...props }: React.ComponentProps<"table">) => (
    <div className="table-wrap">
      <table {...props}>{children}</table>
    </div>
  ),
  a: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
};

export const Markdown = memo(function Markdown({
  children,
  compact = false,
  streaming = false,
  className,
}: {
  children: string;
  compact?: boolean;
  /** 仍在生成：末尾显示光标 */
  streaming?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("prose-ming", compact && "is-compact", streaming && "is-streaming", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
});

export default Markdown;
