/**
 * ChatInput – textarea with auto-resize, send button, and keyboard shortcuts.
 *
 * - Enter to send, Shift+Enter for newline
 * - Disabled while streaming
 * - Gold accent send button
 * - Placeholder: "向玄冥大师提问..."
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type FormEvent,
} from "react";
import { cn } from "@/lib/utils";

// ── Component ──────────────────────────────────────────────────────────

interface ChatInputProps {
  /** Called when the user submits a message. */
  onSend: (message: string) => void;
  /** Whether the input should be disabled (e.g. during streaming). */
  disabled?: boolean;
  className?: string;
}

export function ChatInput({ onSend, disabled = false, className }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Auto-resize ────────────────────────────────────────────────────

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 160; // ~6 lines
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // ── Focus on enable ────────────────────────────────────────────────

  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  // ── Submit ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSend(trimmed);
      setValue("");
    },
    [value, disabled, onSend]
  );

  // ── Key handler ────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex items-end gap-2 rounded-xl border border-border bg-card p-3 transition-colors",
        "focus-within:border-gold/50",
        disabled && "opacity-60",
        className
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="向玄冥大师提问..."
        rows={1}
        className={cn(
          "flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground",
          "outline-none border-none leading-relaxed",
          "min-h-[24px] max-h-[160px]"
        )}
      />

      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
          "bg-gold text-background hover:bg-gold/80",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        )}
        aria-label="发送消息"
      >
        {/* Send arrow icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22 11 13 2 9Z" />
        </svg>
      </button>
    </form>
  );
}

export default ChatInput;
