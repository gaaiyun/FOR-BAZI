/**
 * ChatMessage – renders a single chat message bubble.
 *
 * User messages: right-aligned with gold accent border.
 * Assistant messages: left-aligned with jade accent border.
 * Uses react-markdown + remark-gfm for rich rendering.
 * Shows a loading spinner for messages still being streamed.
 */

import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { ToolCallStatus } from "./ToolCallStatus";
import type { ChatMessage as ChatMessageType } from "@/types/bazi";

// ── Helpers ────────────────────────────────────────────────────────────

/** Format a Unix-ms timestamp to a short time string. */
function formatTime(ts: number): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ── Loading Dots ───────────────────────────────────────────────────────

function StreamingDots() {
  return (
    <span className="inline-flex gap-1 items-center ml-1">
      <span className="h-1.5 w-1.5 rounded-full bg-jade animate-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-jade animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-jade animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

// ── Markdown Styles ────────────────────────────────────────────────────

/**
 * Custom markdown component overrides for the mystical dark theme.
 * Passed to ReactMarkdown's `components` prop.
 */
const markdownComponents = {
  p: ({ children, ...props }: React.ComponentProps<"p">) => (
    <p className="mb-2 last:mb-0 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  h1: ({ children, ...props }: React.ComponentProps<"h1">) => (
    <h1
      className="font-heading text-xl font-semibold text-gold mb-2 mt-3 first:mt-0"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.ComponentProps<"h2">) => (
    <h2
      className="font-heading text-lg font-semibold text-gold mb-2 mt-3 first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.ComponentProps<"h3">) => (
    <h3
      className="font-heading text-base font-semibold text-foreground mb-1 mt-2 first:mt-0"
      {...props}
    >
      {children}
    </h3>
  ),
  ul: ({ children, ...props }: React.ComponentProps<"ul">) => (
    <ul className="list-disc list-inside mb-2 space-y-1 text-foreground" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.ComponentProps<"ol">) => (
    <ol
      className="list-decimal list-inside mb-2 space-y-1 text-foreground"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.ComponentProps<"li">) => (
    <li className="text-sm leading-relaxed" {...props}>
      {children}
    </li>
  ),
  code: ({ className, children, ...props }: React.ComponentProps<"code">) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <pre className="mb-2 rounded-lg bg-background border border-border p-3 overflow-x-auto">
          <code
            className={cn("text-xs text-foreground", className)}
            {...props}
          >
            {children}
          </code>
        </pre>
      );
    }
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 text-xs text-gold font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
  blockquote: ({ children, ...props }: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="border-l-2 border-gold pl-3 mb-2 text-muted-foreground italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  table: ({ children, ...props }: React.ComponentProps<"table">) => (
    <div className="mb-2 overflow-x-auto">
      <table
        className="w-full text-sm border-collapse border border-border"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }: React.ComponentProps<"th">) => (
    <th
      className="border border-border bg-muted px-2 py-1 text-left text-xs font-medium text-gold"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.ComponentProps<"td">) => (
    <td
      className="border border-border px-2 py-1 text-xs text-foreground"
      {...props}
    >
      {children}
    </td>
  ),
  hr: ({ ...props }: React.ComponentProps<"hr">) => (
    <hr className="my-3 border-border" {...props} />
  ),
  a: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-azure hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
  strong: ({ children, ...props }: React.ComponentProps<"strong">) => (
    <strong className="font-semibold text-gold" {...props}>
      {children}
    </strong>
  ),
};

// ── Component ──────────────────────────────────────────────────────────

interface ChatMessageProps {
  message: ChatMessageType;
  /** Whether this message is still being streamed (show loading indicator). */
  isStreaming?: boolean;
  className?: string;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  isStreaming = false,
  className,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  // Memoize markdown rendering to avoid re-parsing on every parent re-render.
  const renderedContent = useMemo(() => {
    if (!message.content && isStreaming) return null;
    if (!message.content) return null;

    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {message.content}
      </ReactMarkdown>
    );
  }, [message.content, isStreaming]);

  return (
    <div
      className={cn(
        "group flex w-full",
        isUser ? "justify-end" : "justify-start",
        className
      )}
    >
      <div
        className={cn(
          "relative max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "border-r-2 border-gold bg-muted text-foreground"
            : "border-l-2 border-jade bg-card text-foreground",
          "animate-fade-in"
        )}
      >
        {/* Role label */}
        <div className="mb-1 flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-medium",
              isUser ? "text-gold" : "text-jade"
            )}
          >
            {isUser ? "你" : "玄冥大师"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Tool calls (assistant only) */}
        {isAssistant &&
          message.tool_calls &&
          message.tool_calls.length > 0 && (
            <div className="mb-2 space-y-1">
              {message.tool_calls.map((tc) => (
                <ToolCallStatus key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}

        {/* Content */}
        {renderedContent}

        {/* Streaming indicator */}
        {isStreaming && !message.content && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-xs">正在思考</span>
            <StreamingDots />
          </div>
        )}
        {isStreaming && message.content && <StreamingDots />}
      </div>
    </div>
  );
});

export default ChatMessageBubble;
