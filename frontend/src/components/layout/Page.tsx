/**
 * 页面骨架。
 *
 * 之前每个页面各写各的标题块（字号、间距、副标题语气都不一致），
 * 加上一半是英文一半中文。这里统一成三个部件：
 *   PageHeader  —— 标题 + 一句中文说明 + 右侧操作位
 *   Section     —— 带细金线的内容分区
 *   EmptyState  —— 未排盘等空态，给出明确的下一步而不是一句"暂无数据"
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function PageHeader({
  title,
  en,
  description,
  actions,
}: {
  title: string;
  en?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
      <div>
        <div className="flex items-baseline gap-2.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {en && (
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
              {en}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-panel rounded-xl p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="rule-accent font-heading text-base font-semibold text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** 空态。默认引导回排盘页——绝大多数空态都是因为还没排盘。 */
export function EmptyState({
  title = "尚未排盘",
  description = "请先在排盘页填写出生信息，本页会自动带出对应内容。",
  action = true,
}: {
  title?: string;
  description?: string;
  action?: boolean;
}) {
  return (
    <div className="surface-panel flex flex-col items-center gap-3 rounded-xl px-6 py-14 text-center">
      <svg aria-hidden viewBox="0 0 64 40" className="h-10 w-16">
        <g fill="var(--primary)" opacity="0.22">
          <rect x="2" y="2" width="60" height="5" rx="2.5" />
          <rect x="2" y="13" width="25" height="5" rx="2.5" />
          <rect x="37" y="13" width="25" height="5" rx="2.5" />
          <rect x="2" y="24" width="60" height="5" rx="2.5" />
          <rect x="2" y="35" width="25" height="5" rx="2.5" />
          <rect x="37" y="35" width="25" height="5" rx="2.5" />
        </g>
      </svg>
      <div>
        <p className="font-heading text-base font-medium text-foreground">{title}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action && (
        <Link
          to="/"
          className="mt-1 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-background transition-colors duration-[var(--dur-fast)] hover:bg-gold/85"
        >
          去排盘
        </Link>
      )}
    </div>
  );
}
