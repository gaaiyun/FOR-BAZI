/**
 * 页面骨架。
 *
 * 全站只有三种版面部件，都不带框：
 *   PageHeader —— 宋体大标题 + 一行事实性说明 + 右侧操作
 *   Section    —— 顶上一条墨线；宽屏时栏目名在左栏，内容在右
 *   EmptyState —— 未排盘时的去向
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  /** 兼容旧调用，不再显示英文副题 */
  en?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-8 sm:pb-10">
      <div className="min-w-0">
        <h1 className="font-heading text-[2rem] font-semibold leading-tight tracking-tight sm:text-[2.5rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  flush = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 不要左栏，标题叠在内容上方 */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "border-t border-foreground py-6 sm:py-8",
        !flush && "lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-x-8",
        className
      )}
    >
      {(title || description || actions) && (
        <div className={cn("mb-5", !flush && "lg:mb-0")}>
          <div className="flex items-baseline justify-between gap-3 lg:block">
            {title && <h2 className="font-heading text-lg font-semibold leading-snug">{title}</h2>}
            {actions && <div className="lg:mt-3">{actions}</div>}
          </div>
          {description && (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground lg:pr-2">{description}</p>
          )}
        </div>
      )}
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** 一组「标签 + 值」，用细线隔开而不是装进格子。 */
export function Facts({ items, className }: { items: Array<{ k: string; v: ReactNode }>; className?: string }) {
  return (
    <dl className={cn("flex flex-wrap gap-x-8 gap-y-4", className)}>
      {items.map((it) => (
        <div key={it.k} className="min-w-[4.5rem]">
          <dt className="text-xs text-muted-foreground">{it.k}</dt>
          <dd className="mt-1 text-[0.9375rem]">{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 空态。绝大多数空态都是因为还没排盘。 */
export function EmptyState({
  title = "还没有命盘",
  description = "先填写出生信息排一份盘，这一页的内容会随之带出。",
  action = true,
}: {
  title?: string;
  description?: string;
  action?: boolean;
}) {
  return (
    <div className="border-t border-foreground py-14">
      <p className="font-heading text-xl font-semibold">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && (
        <Link to="/" className="btn btn-primary mt-6">
          去排盘
        </Link>
      )}
    </div>
  );
}
