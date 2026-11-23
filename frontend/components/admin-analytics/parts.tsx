import * as React from "react";

import { NUM, Sparkline } from "@/components/admin-analytics/kit/cells";

import { change, fmtCount } from "./format";

/**
 * The pieces of /admin/analytics: a hairline panel that fills its row, a
 * headline tile with its change and sparkline, and a ranked list with a share
 * bar behind each row. No hooks, so the server page renders them directly.
 */

export function Box({
  label,
  right,
  children,
  className = "",
  flush = false,
}: {
  label: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`oa-surface flex h-full min-w-0 flex-col overflow-hidden border border-oa-border bg-oa-card ${className}`}>
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-oa-border px-3 py-1.5 sm:px-4">
        <h2 className="oa-label min-w-0 truncate">{label}</h2>
        {right ? <div className="flex shrink-0 items-center gap-2 text-[12.5px] text-oa-muted-fg">{right}</div> : null}
      </div>
      <div className={`flex min-h-0 flex-1 flex-col ${flush ? "" : "p-3 sm:p-4"}`}>{children}</div>
    </section>
  );
}

export type TileProps = {
  label: string;
  value: string;
  current: number | null;
  previous: number | null;
  kind: "count" | "rate" | "seconds";
  /** For bounce: going down is good. */
  lowerIsBetter?: boolean;
  spark: number[];
};

export function Tile({ label, value, current, previous, kind, lowerIsBetter = false, spark }: TileProps) {
  const delta = change(current, previous, kind);
  const good = delta && delta.dir !== "flat" ? (delta.dir === "up") !== lowerIsBetter : null;
  const tone = good == null ? "text-oa-muted-fg" : good ? "text-signal-bullish" : "text-signal-bearish";
  return (
    <div className="-mb-px -mr-px flex min-w-0 flex-col gap-1 border-b border-r border-oa-border px-3 py-2.5 sm:px-4">
      <div className="oa-caption truncate">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div className={`${NUM} text-[22px] font-semibold leading-7 tracking-[-0.01em] text-oa-fg`}>{value}</div>
        <Sparkline values={spark} width={56} height={22} tone={good == null ? "flat" : good ? "up" : "down"} className="mb-1 hidden sm:block" />
      </div>
      <div className={`${NUM} text-[12.5px] leading-4 ${tone}`} title={previous != null ? `Before: ${kind === "count" ? fmtCount(previous) : previous}` : undefined}>
        {delta ? `${delta.dir === "up" ? "▲" : delta.dir === "down" ? "▼" : ""} ${delta.text}`.trim() : "\u00a0"}
      </div>
    </div>
  );
}

/** A quiet label between the lists inside one panel. */
export function GroupHead({ children }: { children: React.ReactNode }) {
  return <div className="oa-caption border-t border-oa-border px-3 pb-0.5 pt-2 first:border-t-0 sm:px-4">{children}</div>;
}

export type RankRow = { key: string; label: React.ReactNode; icon?: React.ReactNode; value: number; share: number; title?: string };

/** A ranked list with a bar behind each row (its share of the total), about eight rows in view. */
export function RankList({ rows, unit, empty, rowsInView = 8 }: { rows: RankRow[]; unit?: string; empty: string; rowsInView?: number }) {
  if (rows.length === 0) return <p className="px-3 py-6 text-center text-[13.5px] text-oa-muted-fg sm:px-4">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="min-h-0 overflow-y-auto" style={{ maxHeight: `${rowsInView * 2.25}rem` }}>
      {rows.map((row) => (
        <li key={row.key} className="relative flex h-9 items-center gap-2.5 px-3 text-[13.5px] sm:px-4" title={row.title}>
          <span aria-hidden className="absolute inset-y-1 left-1.5 rounded-sm bg-oa-primary/10" style={{ width: `calc(${(row.value / max) * 100}% - 0.75rem)` }} />
          {row.icon ? <span className="relative flex size-5 shrink-0 items-center justify-center">{row.icon}</span> : null}
          <span className="relative min-w-0 flex-1 truncate text-oa-fg">{row.label}</span>
          <span className={`${NUM} relative shrink-0 text-oa-fg`}>{fmtCount(row.value)}</span>
          <span className={`${NUM} relative w-10 shrink-0 text-right text-[12.5px] text-oa-muted-fg`}>{Math.round(row.share * 100)}%</span>
          {unit ? <span className="sr-only">{unit}</span> : null}
        </li>
      ))}
    </ul>
  );
}

const DEVICE_PATHS: Record<string, string> = {
  desktop: "M3 4h14v9H3zM7 16h6M10 13v3",
  mobile: "M6.5 2.5h7v15h-7zM9.5 15h1",
  tablet: "M4 3h12v14H4zM9.5 15h1",
};

export function DeviceIcon({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 20 20" className="size-4 text-oa-muted-fg" aria-hidden>
      <path d={DEVICE_PATHS[kind] ?? DEVICE_PATHS.desktop} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const BROWSER_COLORS: Record<string, string> = {
  Chrome: "#1a73e8",
  Safari: "#0a84ff",
  Firefox: "#e66000",
  Edge: "#0c8484",
  Samsung: "#1428a0",
  Opera: "#cc0f16",
  Brave: "#fb542b",
};

export function BrowserIcon({ name }: { name: string }) {
  const color = BROWSER_COLORS[name];
  return (
    <span
      aria-hidden
      className="flex size-4 items-center justify-center rounded-full text-[9px] font-semibold leading-none text-white"
      style={{ background: color ?? "var(--oa-muted-fg)" }}
    >
      {name.slice(0, 1)}
    </span>
  );
}
