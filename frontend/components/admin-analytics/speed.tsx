import Link from "next/link";
import * as React from "react";

import { NUM } from "@/components/admin-analytics/kit/cells";
import { MIN_LOADS, rate, THRESHOLDS, type DeviceFilter, type MetricId, type Rating, type SpeedRange, type SpeedSplitRow, type SpeedView } from "@/lib/analytics/speed";

import { fmtCount, fmtPct, fmtSpeed } from "./format";
import { Box, DeviceIcon, GroupHead } from "./parts";

/**
 * The Speed tab of /admin/analytics: how fast pages load for real visitors (lib/analytics/speed.ts), at the 75th
 * percentile like Core Web Vitals, coloured good / needs work / poor by Google's thresholds. Beside it, the
 * server's own view: Caddy's time to the app's response headers on the same loads (its trace-origin
 * Server-Timing entry). Server-rendered, no hooks.
 */

const TONE: Record<Rating, string> = {
  good: "text-signal-bullish",
  "needs-work": "text-amber-700 dark:text-amber-400",
  poor: "text-signal-bearish",
};
const STROKE: Record<Rating, string> = { good: "var(--signal-bullish)", "needs-work": "#d97706", poor: "var(--signal-bearish)" };
const FILL: Record<Rating, string> = { good: "bg-signal-bullish", "needs-work": "bg-amber-500", poor: "bg-signal-bearish" };

const NAMES: Record<MetricId, string> = { lcp: "Largest paint", inp: "Tap response", cls: "Layout shift", ttfb: "First byte", fcp: "First paint" };
const SHORT: Record<MetricId, string> = { lcp: "LCP", inp: "INP", cls: "CLS", ttfb: "TTFB", fcp: "FCP" };

function goodUnder(metric: MetricId): string {
  const [good, poor] = THRESHOLDS[metric];
  return `${SHORT[metric]} p75. Good at or under ${fmtSpeed(metric, good)}, poor over ${fmtSpeed(metric, poor)}.`;
}

const RANGE_WORDS: Record<SpeedRange, string> = { today: "Today", "7d": "7 days", "14d": "14 days" };
const DEVICE_WORDS: Record<DeviceFilter, string> = { all: "All", phone: "Phones", desktop: "Desktops" };

function href(range: SpeedRange, device: DeviceFilter): string {
  const params = new URLSearchParams({ tab: "speed" });
  if (range !== "7d") params.set("range", range);
  if (device !== "all") params.set("dev", device);
  return `/admin/analytics?${params}`;
}

function Segmented<T extends string>({ label, items, current, link }: { label: string; items: Record<T, string>; current: T; link: (id: T) => string }) {
  return (
    <nav aria-label={label} className="inline-flex h-9 shrink-0 items-stretch rounded-md border border-oa-border bg-oa-bg p-0.5 lg:h-8">
      {(Object.keys(items) as T[]).map((id) => (
        <Link
          key={id}
          href={link(id)}
          prefetch={false}
          replace
          aria-current={id === current ? "page" : undefined}
          className={`inline-flex items-center rounded px-2.5 text-[13.5px] transition-colors ${
            id === current ? "bg-oa-card font-medium text-oa-fg shadow-[0_0_0_1px_var(--oa-border)]" : "text-oa-muted-fg hover:text-oa-fg"
          }`}
        >
          {items[id]}
        </Link>
      ))}
    </nav>
  );
}

export function SpeedRangePicker({ range, device }: { range: SpeedRange; device: DeviceFilter }) {
  return <Segmented label="Range" items={RANGE_WORDS} current={range} link={(id) => href(id, device)} />;
}

/** A 14-day line with gaps for days without loads, coloured by the newest day's rating. */
function Trend({ metric, values, width = 64, height = 20 }: { metric: MetricId; values: Array<number | null>; width?: number; height?: number }) {
  const known = values.filter((v): v is number => v != null);
  if (known.length < 2) return <span aria-hidden className="inline-block" style={{ width, height }} />;
  const max = Math.max(...known, THRESHOLDS[metric][0]);
  const step = (width - 2) / Math.max(1, values.length - 1);
  const y = (v: number) => 1 + (height - 2) * (1 - v / max);
  let d = "";
  let open = false;
  values.forEach((v, i) => {
    if (v == null) {
      open = false;
      return;
    }
    d += `${open ? "L" : "M"}${(1 + i * step).toFixed(1)} ${y(v).toFixed(1)}`;
    open = true;
  });
  const last = rate(metric, known[known.length - 1]!) ?? "good";
  const good = y(THRESHOLDS[metric][0]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden className="shrink-0">
      <line x1="1" x2={width - 1} y1={good} y2={good} stroke="var(--oa-border)" strokeDasharray="2 2" />
      <path d={d} fill="none" stroke={STROKE[last]} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Figure({ metric, value, loads, className = "" }: { metric: MetricId; value: number | null; loads: number; className?: string }) {
  const rating = loads >= MIN_LOADS ? rate(metric, value) : null;
  return (
    <span className={`${NUM} ${rating ? TONE[rating] : "text-oa-muted-fg"} ${className}`} title={loads < MIN_LOADS ? `Only ${loads} load${loads === 1 ? "" : "s"}` : undefined}>
      {fmtSpeed(metric, value)}
    </span>
  );
}

function MetricTile({ metric, view }: { metric: MetricId; view: SpeedView }) {
  const value = view.p75[metric];
  const phone = view.byDevice.phone;
  const desktop = view.byDevice.desktop;
  // Phone and desktop side by side, marked with their icons so the line fits a phone's half-width tile.
  const sub =
    view.device === "all" && phone.loads > 0 && desktop.loads > 0 ? (
      <span className="flex items-center gap-1" title={`Phones ${fmtSpeed(metric, phone.p75[metric])}, desktops ${fmtSpeed(metric, desktop.p75[metric])}`}>
        <DeviceIcon kind="mobile" />
        <span className="mr-1.5">{fmtSpeed(metric, phone.p75[metric])}</span>
        <DeviceIcon kind="desktop" />
        <span>{fmtSpeed(metric, desktop.p75[metric])}</span>
      </span>
    ) : (
      `p95 ${fmtSpeed(metric, view.p95[metric])}`
    );
  return (
    <div className="-mb-px -mr-px flex min-w-0 flex-col gap-1 border-b border-r border-oa-border px-3 py-2.5 sm:px-4" title={goodUnder(metric)}>
      <dt className="oa-caption truncate">{NAMES[metric]}</dt>
      <dd className="flex items-end justify-between gap-2">
        <Figure metric={metric} value={value} loads={view.loads} className="text-[22px] font-semibold leading-7 tracking-[-0.01em]" />
        <span className="mb-1 hidden sm:block">
          <Trend metric={metric} values={view.trend[metric]} width={56} height={22} />
        </span>
      </dd>
      <dd className={`${NUM} min-w-0 truncate text-[12.5px] leading-4 text-oa-muted-fg`}>{sub}</dd>
    </div>
  );
}

function Stat({ label, value, sub, tone = "text-oa-fg", href: link, title }: { label: string; value: string; sub: string; tone?: string; href?: string; title?: string }) {
  const body = (
    <>
      <dt className="oa-caption truncate">{label}</dt>
      <dd className={`${NUM} truncate text-[22px] font-semibold leading-7 tracking-[-0.01em] ${tone}`}>{value}</dd>
      <dd className="truncate text-[12.5px] leading-4 text-oa-muted-fg">{sub}</dd>
    </>
  );
  const cls = "-mb-px -mr-px flex min-w-0 flex-col gap-1 border-b border-r border-oa-border px-3 py-2.5 sm:px-4";
  return link ? (
    <Link href={link} prefetch={false} className={`${cls} hover:bg-oa-accent`} title={title}>
      {body}
    </Link>
  ) : (
    <div className={cls} title={title}>
      {body}
    </div>
  );
}

/** Signal bars: four for 4G, one for slow 2G, an empty frame when the browser doesn't say. */
const NET_BARS: Record<string, number> = { "4g": 4, "3g": 3, "2g": 2, "slow-2g": 1, unknown: 0 };

function NetIcon({ kind }: { kind: string }) {
  const bars = NET_BARS[kind] ?? 0;
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-oa-muted-fg" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={3 + i * 4} y={14 - i * 3} width="2.5" height={3 + i * 3} rx="0.6" fill={i < bars ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  );
}

function AccountIcon({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-oa-muted-fg" aria-hidden>
      <circle cx="10" cy="7" r="3" fill={kind === "in" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 17c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray={kind === "unknown" ? "2 2" : undefined} />
    </svg>
  );
}

const NET_WORDS: Record<string, string> = { "4g": "4G or better", "3g": "3G", "2g": "2G", "slow-2g": "Slow 2G", unknown: "Not reported" };
const SIGNED_WORDS: Record<string, string> = { in: "Signed in", out: "Signed out", unknown: "Not known yet" };

/** Rows of one split with their LCP p75 as a bar coloured by its rating (TTFB where the browser has no LCP). */
function SplitRows({ rows, label, icon }: { rows: SpeedSplitRow[]; label: (key: string) => string; icon?: (key: string) => React.ReactNode }) {
  if (rows.length === 0) return <p className="px-3 py-3 text-[13.5px] text-oa-muted-fg sm:px-4">No loads yet.</p>;
  const metricOf = (row: SpeedSplitRow): MetricId => (row.p75.lcp != null ? "lcp" : "ttfb");
  const max = Math.max(1, ...rows.map((row) => row.p75[metricOf(row)] ?? 0));
  return (
    <ul>
      {rows.map((row) => {
        const metric = metricOf(row);
        const value = row.p75[metric];
        const rating = row.loads >= MIN_LOADS ? rate(metric, value) : null;
        return (
          <li key={row.key} className="grid h-9 grid-cols-[minmax(0,7.5rem)_1fr_3.75rem_2.75rem] items-center gap-2 px-3 text-[13.5px] sm:px-4" title={`${fmtCount(row.loads)} loads, ${SHORT[metric]} p75`}>
            <span className="flex min-w-0 items-center gap-2 truncate text-oa-fg">
              {icon ? icon(row.key) : null}
              <span className="truncate">{label(row.key)}</span>
            </span>
            <span className="relative h-1.5 overflow-hidden rounded-full bg-oa-border/60">
              <span className={`absolute inset-y-0 left-0 rounded-full ${rating ? FILL[rating] : "bg-oa-muted-fg/40"}`} style={{ width: `${((value ?? 0) / max) * 100}%` }} />
            </span>
            <Figure metric={metric} value={value} loads={row.loads} className="text-right" />
            <span className={`${NUM} text-right text-[12.5px] text-oa-muted-fg`}>{fmtCount(row.loads)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function SpeedDashboard({ view }: { view: SpeedView }) {
  const server = view.server;
  const deviceRows: SpeedSplitRow[] = (["phone", "desktop"] as const)
    .map((key) => ({ key, loads: view.byDevice[key].loads, p75: view.byDevice[key].p75 }))
    .filter((row) => row.loads > 0);
  // Loads the first version kept have no device: the share is of the loads that say.
  const byDevice = view.byDevice.phone.loads + view.byDevice.desktop.loads;
  const phoneShare = byDevice > 0 ? view.byDevice.phone.loads / byDevice : null;

  return (
    <div className="flex flex-col gap-3">
      <dl className="oa-surface grid grid-cols-2 overflow-hidden border border-oa-border bg-oa-card md:grid-cols-4 2xl:grid-cols-8">
        <Stat label="Page loads" value={fmtCount(view.loads)} sub={view.device === "all" && phoneShare != null ? `${fmtPct(phoneShare)} on phones` : DEVICE_WORDS[view.device]} />
        <MetricTile metric="lcp" view={view} />
        <MetricTile metric="inp" view={view} />
        <MetricTile metric="cls" view={view} />
        <MetricTile metric="ttfb" view={view} />
        <MetricTile metric="fcp" view={view} />
        {view.cache.known > 0 ? (
          <Stat
            label="Cache hits"
            value={fmtPct(view.cache.share)}
            sub={`of ${fmtCount(view.cache.known)} loads the cache saw`}
            title={view.cache.browser > 0 ? `${fmtCount(view.cache.browser)} more came from the browser's own cache` : undefined}
          />
        ) : (
          // No cache report (local development, or before the Server-Timing line is live): the slow tail instead.
          <Stat label="Slow loads" value={fmtPct(view.slowLcp)} sub="LCP over 4 s" tone={view.slowLcp != null && view.slowLcp > 0.25 ? TONE.poor : undefined} />
        )}
        <Stat
          label="Server p95"
          value={server.p95 != null ? fmtSpeed("ttfb", server.p95) : "n/a"}
          tone={server.p95 != null && server.loads >= MIN_LOADS ? TONE[rate("ttfb", server.p95) ?? "good"] : undefined}
          sub={server.loads > 0 ? `Caddy, ${fmtCount(server.loads)} ${server.loads === 1 ? "load" : "loads"}` : "Caddy, none measured yet"}
          title={server.loads > 0 ? `Time to the app's first response bytes, on loads that missed the cache${server.p50 != null ? `; p50 ${fmtSpeed("ttfb", server.p50)}` : ""}` : undefined}
        />
      </dl>

      <Box label="Slowest routes" right={<Segmented label="Device" items={DEVICE_WORDS} current={view.device} link={(id) => href(view.range, id)} />} flush>
        <RouteTable view={view} />
      </Box>

      {/* Whole site, side by side: is it the device, the network or the account that makes people wait? */}
      <Box label="Who waits longest" right="LCP p75, loads" flush>
        <div className="grid grid-cols-1 md:grid-cols-3 md:divide-x md:divide-oa-border">
          <div>
            <GroupHead>Device</GroupHead>
            <SplitRows rows={deviceRows} label={(key) => (key === "phone" ? "Phones" : "Desktops")} icon={(key) => <DeviceIcon kind={key === "phone" ? "mobile" : "desktop"} />} />
          </div>
          <div className="border-t border-oa-border md:border-t-0">
            <GroupHead>Network</GroupHead>
            <SplitRows rows={view.nets} label={(key) => NET_WORDS[key] ?? key} icon={(key) => <NetIcon kind={key} />} />
          </div>
          <div className="border-t border-oa-border md:border-t-0">
            <GroupHead>Account</GroupHead>
            <SplitRows rows={view.signedIn} label={(key) => SIGNED_WORDS[key] ?? key} icon={(key) => <AccountIcon kind={key} />} />
          </div>
        </div>
      </Box>
    </div>
  );
}

function RouteTable({ view }: { view: SpeedView }) {
  // Columns with nothing in them yet (no cache report, or a single day of loads) are left out, not shown as n/a.
  const showCache = view.routes.some((row) => row.cache.known > 0);
  const showTrend = view.routes.some((row) => row.trend.filter((v) => v != null).length >= 2);
  if (view.routes.length === 0) {
    // The first version's loads count in the totals but have no route.
    const words = view.device === "all" ? (view.loads > 0 ? "No page loads by route yet." : "No page loads yet.") : `No ${DEVICE_WORDS[view.device].toLowerCase()} page loads yet.`;
    return <p className="px-4 py-6 text-center text-[13.5px] text-oa-muted-fg">{words}</p>;
  }
  return (
    <div className="max-h-[22.5rem] min-h-0 overflow-auto">
      <table className="w-full table-fixed text-[13.5px]">
        <thead className="sticky top-0 z-10 bg-oa-card">
          <tr className="h-9 border-b border-oa-border text-left text-[12.5px] text-oa-muted-fg">
            <th className="pl-3 pr-1 font-normal sm:px-4">Route</th>
            <th className="w-[2.75rem] px-1 text-right font-normal sm:w-[4rem] sm:px-2">Loads</th>
            <th className="w-[3.9rem] px-1 text-right font-normal sm:w-[4.25rem] sm:px-2" title={goodUnder("lcp")}>LCP</th>
            <th className="w-[3.9rem] px-1 text-right font-normal sm:w-[4.25rem] sm:px-2" title={goodUnder("inp")}>INP</th>
            <th className="w-[3.9rem] px-1 text-right font-normal sm:w-[4.25rem] sm:px-2" title={goodUnder("ttfb")}>TTFB</th>
            {showCache ? <th className="hidden w-[3.75rem] px-2 text-right font-normal md:table-cell">Cache</th> : null}
            {showTrend ? <th className="hidden w-[5.5rem] px-3 text-right font-normal sm:table-cell sm:px-4">14 days</th> : <th className="w-1 px-1 sm:px-2" aria-hidden />}
          </tr>
        </thead>
        <tbody>
          {view.routes.map((row) => (
            <tr key={row.route} className="h-9 border-b border-oa-border/60 last:border-b-0">
              <td className="truncate pl-3 pr-1 text-oa-fg sm:px-4" title={`${row.route}: ${fmtCount(row.loads)} loads`}>
                {row.route}
              </td>
              <td className={`${NUM} px-1 text-right text-oa-fg sm:px-2`}>{fmtCount(row.loads)}</td>
              <td className="whitespace-nowrap px-1 text-right sm:px-2">
                <Figure metric="lcp" value={row.p75.lcp} loads={row.loads} />
              </td>
              <td className="whitespace-nowrap px-1 text-right sm:px-2">
                <Figure metric="inp" value={row.p75.inp} loads={row.loads} />
              </td>
              <td className="whitespace-nowrap px-1 text-right sm:px-2">
                <Figure metric="ttfb" value={row.p75.ttfb} loads={row.loads} />
              </td>
              {showCache ? (
                <td className={`${NUM} hidden px-2 text-right text-oa-muted-fg md:table-cell`} title={row.cache.known > 0 ? `${fmtCount(row.cache.hit)} of ${fmtCount(row.cache.known)}` : undefined}>
                  {row.cache.known > 0 ? fmtPct(row.cache.share) : "n/a"}
                </td>
              ) : null}
              {showTrend ? (
                <td className="hidden px-3 sm:table-cell sm:px-4">
                  <span className="flex justify-end">
                    <Trend metric="lcp" values={row.trend} />
                  </span>
                </td>
              ) : (
                <td aria-hidden />
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
