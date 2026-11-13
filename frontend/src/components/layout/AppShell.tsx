/**
 * AppShell —— 全站骨架。
 *
 * 宽屏：左侧一列文字导航，底部挂着当前命盘的四柱，随时点回命盘。
 * 手机：顶上一条细栏，底部四个固定入口加「更多」，拇指够得着。
 * 两种布局共用同一份导航定义（./nav）。
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useBaziStore } from "@/stores/useBaziStore";
import { getCharColor } from "@/lib/wuxing-colors";
import { ThemeToggle } from "./ThemeToggle";
import { ALL_ITEMS, NAV_GROUPS, SETTINGS_ITEM, TAB_PATHS } from "./nav";

/** 侧栏底部：当前命盘的四柱缩略。 */
function CurrentChart() {
  const reading = useBaziStore((s) => s.reading);
  if (!reading) {
    return <p className="text-xs leading-relaxed text-faint">尚未排盘</p>;
  }
  const c = reading.chart;
  const pillars = [c.year_pillar, c.month_pillar, c.day_pillar, c.hour_pillar];
  return (
    <Link to="/chart" className="group block" title="查看命盘">
      <p className="truncate text-xs text-muted-foreground group-hover:text-foreground">
        {reading.birth?.name || "当前命盘"}
      </p>
      <div className="mt-2 flex gap-2.5">
        {pillars.map((p, i) => (
          <span key={i} className="glyph flex flex-col gap-1 text-lg">
            <span style={{ color: getCharColor(p.stem) }}>{p.stem}</span>
            <span style={{ color: getCharColor(p.branch) }}>{p.branch}</span>
          </span>
        ))}
      </div>
    </Link>
  );
}

function SideNav() {
  return (
    <aside className="no-print hidden w-52 shrink-0 flex-col border-r border-rule lg:flex">
      <Link to="/" className="block px-7 pb-8 pt-9">
        <span className="glyph text-[1.75rem] leading-none tracking-tight">玄冥</span>
        <span className="mt-2 block text-xs text-muted-foreground">八字排盘</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-7" aria-label="主导航">
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="mb-6">
            <p className="eyebrow mb-1.5">{g.title}</p>
            <ul>
              {g.items.map((it) => (
                <li key={it.path}>
                  <NavLink
                    to={it.path}
                    end={it.path === "/"}
                    className={({ isActive }) =>
                      cn(
                        "relative block py-1.5 font-heading text-[1.0625rem] transition-colors duration-[var(--dur-fast)]",
                        isActive
                          ? "font-semibold text-foreground before:absolute before:-left-7 before:top-1/2 before:h-px before:w-4 before:bg-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )
                    }
                  >
                    {it.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-rule px-7 py-5">
        <CurrentChart />
      </div>
      <div className="flex items-center justify-between border-t border-rule py-2 pl-7 pr-4">
        <NavLink
          to={SETTINGS_ITEM.path}
          className={({ isActive }) =>
            cn("text-sm transition-colors", isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground")
          }
        >
          设置
        </NavLink>
        <ThemeToggle />
      </div>
    </aside>
  );
}

function TopBar({ title }: { title: string }) {
  return (
    <header
      className="no-print flex shrink-0 items-center justify-between border-b border-rule pl-4 pr-2 lg:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Link to="/" className="flex h-12 items-baseline gap-2.5 pt-3">
        <span className="glyph text-xl leading-none">玄冥</span>
        <span className="text-xs text-muted-foreground">{title}</span>
      </Link>
      <ThemeToggle />
    </header>
  );
}

function TabBar({ onMore, moreActive }: { onMore: () => void; moreActive: boolean }) {
  const tabs = TAB_PATHS.map((p) => ALL_ITEMS.find((i) => i.path === p)!);
  const base =
    "relative flex h-14 flex-1 items-center justify-center font-heading text-[0.9375rem] transition-colors";
  const on = "font-semibold text-foreground before:absolute before:top-0 before:h-0.5 before:w-6 before:bg-primary";
  const off = "text-muted-foreground";
  return (
    <nav
      className="no-print flex shrink-0 border-t border-rule bg-background lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="主导航"
    >
      {tabs.map((t) => (
        <NavLink
          key={t.path}
          to={t.path}
          end={t.path === "/"}
          className={({ isActive }) => cn(base, isActive ? on : off)}
        >
          {t.label}
        </NavLink>
      ))}
      <button type="button" onClick={onMore} className={cn(base, moreActive ? on : off)}>
        更多
      </button>
    </nav>
  );
}

function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-0 rounded-none border-t border-foreground bg-background p-0 shadow-none"
      >
        <SheetTitle className="sr-only">全部页面</SheetTitle>
        <SheetDescription className="sr-only">选择要前往的页面</SheetDescription>
        <ul
          className="max-h-[75dvh] overflow-y-auto px-5 py-2"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {ALL_ITEMS.map((it) => (
            <li key={it.path} className="border-b border-rule last:border-b-0">
              <NavLink
                to={it.path}
                end={it.path === "/"}
                onClick={() => onOpenChange(false)}
                className={({ isActive }) =>
                  cn("flex items-baseline justify-between gap-4 py-3.5", isActive && "text-primary")
                }
              >
                <span className="font-heading text-lg font-semibold">{it.label}</span>
                <span className="text-xs text-muted-foreground">{it.note}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const current = ALL_ITEMS.find((i) => (i.path === "/" ? pathname === "/" : pathname.startsWith(i.path)));
  // 问事页自己管理滚动（消息区滚、输入框钉底），其余页面由 main 滚动。
  const fill = pathname === "/chat";

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    document.title = current && current.path !== "/" ? `${current.label} · 玄冥` : "玄冥 · 八字排盘";
  }, [current]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <SideNav />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={current?.label ?? ""} />

        <main ref={mainRef} className={cn("min-h-0 flex-1", fill ? "overflow-hidden" : "overflow-y-auto")}>
          <div
            className={cn(
              "mx-auto w-full max-w-[60rem] px-4 sm:px-8 lg:px-12",
              fill ? "flex h-full flex-col pt-5 lg:pt-12" : "pb-16 pt-6 sm:pt-10 lg:pb-24 lg:pt-14"
            )}
          >
            {/* 懒加载边界放在骨架里面：切页时导航不动，只有内容区短暂留白 */}
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        <TabBar
          onMore={() => setMoreOpen(true)}
          moreActive={moreOpen || (!!current && !TAB_PATHS.includes(current.path))}
        />
      </div>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
      <Toaster />
    </div>
  );
}

export default AppShell;
