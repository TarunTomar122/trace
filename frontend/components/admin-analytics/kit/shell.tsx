import Link from "next/link";
import type * as React from "react";

import { NUM } from "./cells";

/**
 * The page frame of /admin/analytics, after StocksBrew's kit (components/oa/kit there): the page, its head with
 * actions on the right, the underlined tabs, the URL-driven segmented switch, the empty state and the loading
 * ghosts. Server components, no hooks.
 */

export const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-oa-primary/50 focus-visible:ring-offset-1";

export type TabItem = { id: string; label: React.ReactNode; href: string; count?: number | null };

export function AdminPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="traceAdmin min-w-0 flex-grow overflow-x-clip">
      <div className="mx-auto w-full max-w-[90rem] px-2 pb-16 pt-5 sm:px-6 sm:pt-7 lg:px-8">{children}</div>
    </main>
  );
}

export function PageHead({
  title,
  meta,
  actions,
  crumb = "Trace / Admin",
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** The small line above the title (the sponsor stats page reuses this head). */
  crumb?: string;
}) {
  return (
    <header className="mb-3 px-2 sm:mb-4 sm:px-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:flex-nowrap">
        <div className="min-w-0 flex-1 basis-full sm:basis-0">
          <Link href="/" prefetch={false} className="text-[12.5px] text-oa-muted-fg hover:text-oa-fg">
            {crumb}
          </Link>
          <h1 className="min-w-0 text-balance text-[19px] font-semibold leading-6 tracking-[-0.01em] text-oa-fg sm:text-[22px] sm:leading-7">{title}</h1>
        </div>
        {meta ? <div className="min-w-0 max-w-full text-pretty text-[12.5px] leading-4 text-oa-muted-fg sm:max-w-[45%] sm:shrink-0 sm:text-right">{meta}</div> : null}
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function TabBar({ tabs, current }: { tabs: TabItem[]; current: string }) {
  return (
    <nav aria-label="Sections" className="-mx-2 mb-4 flex gap-6 overflow-x-auto border-b border-oa-border px-4 pr-8 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            // Tabs differ only by ?tab=: a prefetch can come back without the query, so a click fetches the tab it names.
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 text-[14px] transition-colors ${FOCUS} ${
              active ? "border-oa-primary font-medium text-oa-fg" : "border-transparent text-oa-muted-fg hover:text-oa-fg"
            }`}
          >
            {tab.label}
            {tab.count != null ? <span className={`${NUM} text-[12.5px] text-oa-muted-fg`}>{tab.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Segmented({ items, current, label = "View", className = "" }: { items: TabItem[]; current: string; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={`inline-flex h-10 shrink-0 items-stretch rounded-md border border-oa-border bg-oa-bg p-0.5 lg:h-8 ${className}`}>
      {items.map((item) => {
        const active = item.id === current;
        return (
          <Link
            key={item.id}
            href={item.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 text-[14px] transition-colors ${FOCUS} ${
              active ? "bg-oa-card font-medium text-oa-fg shadow-[0_0_0_1px_var(--oa-border)]" : "text-oa-muted-fg hover:text-oa-fg"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Empty({ title, children, className = "" }: { title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`px-4 py-8 text-center ${className}`}>
      {title ? <p className="text-[15px] font-medium text-oa-fg">{title}</p> : null}
      {children ? <p className="mx-auto mt-1 max-w-md text-pretty text-[14px] leading-5 text-oa-muted-fg">{children}</p> : null}
    </div>
  );
}

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-oa-accent motion-reduce:animate-none ${className}`} />;
}

export function PanelGhost({ rows, lines = 1, className = "" }: { rows: number; lines?: 1 | 2; className?: string }) {
  return (
    <div className={`oa-surface min-w-0 overflow-hidden border border-oa-border bg-oa-card ${className}`}>
      <div className="flex min-h-11 items-center border-b border-oa-border px-4 py-2">
        <Bar className="h-3 w-28" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={`border-b border-oa-border px-4 last:border-b-0 ${lines === 1 ? "py-3" : "py-2.5"}`}>
          <div className="flex items-center gap-4">
            <Bar className="h-3.5 w-1/3" />
            <Bar className="ml-auto h-3 w-16" />
            <Bar className="h-3 w-12" />
          </div>
          {lines === 2 ? <Bar className="mt-2 h-3 w-3/5" /> : null}
        </div>
      ))}
    </div>
  );
}

export function StatStripGhost({ count = 4, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`oa-surface grid grid-cols-2 overflow-hidden border border-oa-border bg-oa-card sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="-mb-px -mr-px border-b border-r border-oa-border px-4 py-3">
          <Bar className="h-3 w-16" />
          <Bar className="mt-2 h-5 w-14" />
          <Bar className="mt-2 h-3 w-24 max-w-full" />
        </div>
      ))}
    </div>
  );
}
