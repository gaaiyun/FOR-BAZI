/**
 * 提问输入框。回车发送，Shift + 回车换行；生成中可以停止。
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type FormEvent } from "react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  /** 生成中：发送键变为停止 */
  busy?: boolean;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({ onSend, busy = false, onStop, disabled = false, placeholder = "问一件具体的事", className }: ChatInputProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // 随内容长高，最多约六行
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const text = value.trim();
      if (!text || disabled || busy) return;
      onSend(text);
      setValue("");
    },
    [value, disabled, busy, onSend]
  );

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 输入法选字时的回车不算发送
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={submit} className={cn("flex items-end gap-3 border-t border-foreground pt-3", className)}>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        aria-label="提问"
        className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 leading-relaxed outline-none placeholder:text-faint disabled:opacity-50"
      />
      {busy ? (
        <button type="button" className="btn btn-line" onClick={onStop}>
          停止
        </button>
      ) : (
        <button type="submit" className="btn btn-primary" disabled={disabled || !value.trim()}>
          发送
        </button>
      )}
    </form>
  );
}

export default ChatInput;
