import { useSettingsStore } from "@/stores/useSettingsStore";
import { resolveTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** 昼夜切换。点一下在昼 / 夜之间翻转；「跟随系统」在设置页里选。 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const dark = resolveTheme(theme) === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "切换到昼" : "切换到夜"}
      title={dark ? "切换到昼" : "切换到夜"}
      className={cn(
        "grid size-9 place-items-center font-heading text-base text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      {dark ? "昼" : "夜"}
    </button>
  );
}
