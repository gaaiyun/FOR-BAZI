/**
 * 一条对话。
 *
 * 不用气泡：提问是一行加粗的宋体，回答是下面的正文，像一份问答记录。
 * 回答下方可以复制全文。
 */

import { memo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { Markdown } from "./Markdown";
import { ToolCallList } from "./ToolCallStatus";
import type { ChatMessage as ChatMessageType } from "@/types/bazi";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  status?: string;
  className?: string;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  isStreaming = false,
  status,
  className,
}: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className={cn("flex gap-3 border-t border-rule pt-6 first:border-t-0 first:pt-0", className)}>
        <span className="eyebrow w-5 shrink-0 pt-1.5">问</span>
        <p className="min-w-0 whitespace-pre-wrap font-heading text-[1.0625rem] font-semibold leading-relaxed">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", className)}>
      <span className="eyebrow w-5 shrink-0 pt-1.5">答</span>
      <div className="min-w-0 flex-1">
        {message.tool_calls && message.tool_calls.length > 0 && (
          <ToolCallList toolCalls={message.tool_calls} className="mb-4" />
        )}

        {message.content ? (
          <Markdown compact streaming={isStreaming}>
            {message.content}
          </Markdown>
        ) : (
          isStreaming && <p className="caret text-sm text-muted-foreground">{status || "正在思考"}</p>
        )}

        {!isStreaming && message.content && (
          <button
            type="button"
            className="no-print mt-3 text-xs text-faint transition-colors hover:text-foreground"
            onClick={async () => {
              if (await copyText(message.content)) toast.success("已复制这段回答");
            }}
          >
            复制
          </button>
        )}
      </div>
    </div>
  );
});

export default ChatMessageBubble;
