import { publicPath, routeOf } from "./normalize.ts";

/**
 * Real-user page speed: what the browser measured on a full page load (lib/analytics/vitals-client.ts), checked
 * here, kept raw for a few days, and folded into one small document per UTC day with a histogram per route,
 * device and metric. Pure: the store code and the tests feed it.
 *
 * Histograms (fixed bucket edges) instead of raw values, so days merge by adding counts and any percentile can be
 * read back from a range. The edges include every Core Web Vitals threshold, so "good / needs work / poor" from a
 * p75 is exact at the boundaries and within one bucket (about 10%) elsewhere.
 *
 * Nothing about the visitor is kept: no session, no visitor hash, no address. A row is the route template, phone
 * or desktop, the network type the browser reports, the cache that served the page, signed in yes/no, and the
 * timings. Besides the five Core Web Vitals, a load that reached the app carries `origin`: Caddy's time to the
 * app's response headers (its trace-origin Server-Timing entry), the server's side of the wait.
 */

export const METRICS = ["lcp", "inp", "cls", "ttfb", "fcp"] as const;
export type MetricId = (typeof METRICS)[number];
/** Every figure kept in a histogram: the vitals and the server's own time. */
export const HIST_METRICS = [...METRICS, "origin"] as const;
export type HistMetric = (typeof HIST_METRICS)[number];

export const DEVICES = ["phone", "desktop"] as const;
export type DeviceKind = (typeof DEVICES)[number];

export const CACHE_KINDS = ["hit", "miss", "pass", "stale", "browser"] as const;
export type CacheKind = (typeof CACHE_KINDS)[number];

export const NETS = ["4g", "3g", "2g", "slow-2g"] as const;
export type NetKind = (typeof NETS)[number];

/** Core Web Vitals thresholds: at or under the first is good, over the second is poor (web.dev). */
export const THRESHOLDS: Record<MetricId, readonly [number, number]> = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [0.1, 0.25],
  ttfb: [800, 1800],
  fcp: [1800, 3000],
};

export type Rating = "good" | "needs-work" | "poor";

export function rate(metric: MetricId, value: number | null | undefined): Rating | null {
  if (value == null || !Number.isFinite(value)) return null;
  const [good, poor] = THRESHOLDS[metric];
  return value <= good ? "good" : value <= poor ? "needs-work" : "poor";
}

/** Upper edges of the buckets (a value v lands in the first bucket whose edge is >= v; past the last, the overflow bucket). */
export const MS_EDGES = [
  25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2250, 2500, 2750, 3000, 3500, 4000, 4500, 5000,
  6000, 7000, 8000, 10000, 12000, 15000, 20000, 30000,
] as const;
export const CLS_EDGES = [0.01, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1, 2] as const;

export function edgesOf(metric: HistMetric): readonly number[] {
  return metric === "cls" ? CLS_EDGES : MS_EDGES;
}

/** The bucket a value falls in: (previous edge, edge]. */
export function bucketOf(metric: HistMetric, value: number): number {
  const edges = edgesOf(metric);
  for (let i = 0; i < edges.length; i += 1) if (value <= edges[i]!) return i;
  return edges.length;
}

export type Histogram = number[];

function addTo(hist: Histogram, bucket: number, by = 1) {
  while (hist.length <= bucket) hist.push(0);
  hist[bucket] = (hist[bucket] ?? 0) + by;
}

export function histCount(hist: Histogram | undefined): number {
  let n = 0;
  for (const c of hist ?? []) n += Number(c) || 0;
  return n;
}

export function mergeHist(into: Histogram, from: Histogram | undefined) {
  (from ?? []).forEach((c, i) => {
    const n = Number(c) || 0;
    if (n > 0) addTo(into, i, n);
  });
}

/**
 * The q-th percentile (0 < q <= 1) read from a histogram, interpolated inside its bucket. The overflow bucket
 * reads as its lower edge. Null for an empty histogram.
 */
export function percentile(metric: HistMetric, hist: Histogram | undefined, q: number): number | null {
  const total = histCount(hist);
  if (!hist || total === 0) return null;
  const edges = edgesOf(metric);
  const target = Math.min(1, Math.max(0, q)) * total;
  let seen = 0;
  for (let i = 0; i < hist.length; i += 1) {
    const c = Number(hist[i]) || 0;
    if (c === 0) continue;
    if (seen + c >= target) {
      const lo = i === 0 ? 0 : edges[i - 1]!;
      if (i >= edges.length) return lo;
      const hi = edges[i]!;
      return lo + ((target - seen) / c) * (hi - lo);
    }
    seen += c;
  }
  return edges[edges.length - 1]!;
}

/* ── the browser's report, checked ───────────────────────────────────────── */

/** One full page load, as stored (the raw rows, kept a few days). */
export type VitalsRow = {
  /** Server time, epoch ms. */
  t: number;
  /** Route template ("/stock/[symbol]"). */
  r: string;
  d: DeviceKind;
  ct: NetKind | null;
  c: CacheKind | null;
  si: boolean | null;
} & Partial<Record<HistMetric, number>>;

export type ParsedVitals = Omit<VitalsRow, "t">;

/** Anything slower than this is a tab that sat in the background, not a page load. */
const MAX_MS = 120_000;
const MAX_CLS = 10;
/** Phones by CSS viewport width (an iPad in portrait counts as desktop). */
export const PHONE_MAX_WIDTH = 767;

function metricValue(metric: HistMetric, raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return undefined;
  if (metric === "cls") return raw > MAX_CLS ? undefined : Math.round(raw * 10000) / 10000;
  return raw > MAX_MS ? undefined : Math.round(raw);
}

/**
 * The beacon's `v` (lib/analytics/vitals-client.ts), validated: a path of ours that is not excluded, a viewport
 * width, and at least one timing in range. Unknown fields are dropped. Null when it is not a usable report.
 */
export function parseVitals(raw: unknown, signedIn: boolean | null): ParsedVitals | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  const path = publicPath(v.p);
  if (!path) return null;
  const vw = typeof v.vw === "number" && Number.isFinite(v.vw) && v.vw > 0 && v.vw < 20_000 ? v.vw : null;
  if (vw == null) return null;
  const out: ParsedVitals = {
    r: routeOf(path),
    d: vw <= PHONE_MAX_WIDTH ? "phone" : "desktop",
    ct: NETS.includes(v.ct as NetKind) ? (v.ct as NetKind) : null,
    c: CACHE_KINDS.includes(v.c as CacheKind) ? (v.c as CacheKind) : null,
    si: signedIn,
  };
  let any = false;
  for (const metric of HIST_METRICS) {
    const value = metricValue(metric, v[metric]);
    if (value !== undefined) {
      out[metric] = value;
      if (metric !== "origin") any = true;
    }
  }
  return any ? out : null;
}

/* ── raw chunks and the daily rollup ─────────────────────────────────────── */

export type VitalsChunk = {
  days: string[];
  first_ts: number;
  last_ts: number;
  count: number;
  rows: VitalsRow[];
  created_at: string;
};

export function vitalsChunkOf(rows: VitalsRow[], now: number): VitalsChunk {
  const ts = rows.map((row) => row.t);
  return {
    days: Array.from(new Set(rows.map((row) => new Date(row.t).toISOString().slice(0, 10)))).sort(),
    first_ts: Math.min(...ts),
    last_ts: Math.max(...ts),
    count: rows.length,
    rows,
    created_at: new Date(now).toISOString(),
  };
}

/** Loads, signed-in loads, loads by cache, and a histogram per metric. */
export type SpeedCell = { n: number; si: number; c: Partial<Record<CacheKind, number>>; h: Partial<Record<HistMetric, Histogram>> };

export type SpeedDay = {
  day: string;
  n: number;
  /** By route template, then phone / desktop. */
  routes: Record<string, Partial<Record<DeviceKind, SpeedCell>>>;
  /** Whole-site cuts: "net:4g" … "net:unknown", "si:in", "si:out". */
  cuts: Record<string, SpeedCell>;
  complete: boolean;
  computed_at: string;
  /**
   * Whole-site timings kept by the first version of these analytics (lib/analytics/legacy.ts), added when the day
   * is read and never stored with it: no route, device, network or cache, so they count only for "All".
   */
  legacy?: SpeedCell;
};

/** At most this many routes a day; the rest are added up under OTHER_ROUTE so the totals stay whole. */
export const MAX_ROUTES = 120;
export const OTHER_ROUTE = "(other)";

export function emptyCell(): SpeedCell {
  return { n: 0, si: 0, c: {}, h: {} };
}

function own<T>(record: Record<string, T>, key: string): T | undefined {
  return key !== "__proto__" && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function addRow(cell: SpeedCell, row: ParsedVitals) {
  cell.n += 1;
  if (row.si) cell.si += 1;
  if (row.c) cell.c[row.c] = (cell.c[row.c] ?? 0) + 1;
  for (const metric of HIST_METRICS) {
    const value = row[metric];
    if (value === undefined) continue;
    addTo((cell.h[metric] ??= []), bucketOf(metric, value));
  }
}

export function mergeCell(into: SpeedCell, from: SpeedCell | undefined) {
  if (!from) return;
  into.n += Number(from.n) || 0;
  into.si += Number(from.si) || 0;
  for (const kind of CACHE_KINDS) {
    const n = Number(from.c?.[kind]) || 0;
    if (n > 0) into.c[kind] = (into.c[kind] ?? 0) + n;
  }
  for (const metric of HIST_METRICS) {
    if (from.h?.[metric]?.length) mergeHist((into.h[metric] ??= []), from.h[metric]);
  }
}

function cutKeys(row: ParsedVitals): string[] {
  return [`net:${row.ct ?? "unknown"}`, `si:${row.si == null ? "unknown" : row.si ? "in" : "out"}`];
}

/** One day's rollup from its raw rows (rows from other days are ignored). */
export function rollupSpeedDay(day: string, rows: readonly VitalsRow[], options: { complete?: boolean; now?: number } = {}): SpeedDay {
  const out: SpeedDay = { day, n: 0, routes: {}, cuts: {}, complete: options.complete ?? false, computed_at: new Date(options.now ?? Date.now()).toISOString() };
  for (const row of rows) {
    if (new Date(row.t).toISOString().slice(0, 10) !== day) continue;
    if (!DEVICES.includes(row.d) || typeof row.r !== "string" || row.r === "__proto__") continue;
    out.n += 1;
    const byDevice = own(out.routes, row.r) ?? (out.routes[row.r] = {});
    addRow((byDevice[row.d] ??= emptyCell()), row);
    for (const key of cutKeys(row)) addRow(own(out.cuts, key) ?? (out.cuts[key] = emptyCell()), row);
  }
  out.routes = capRoutes(out.routes);
  return out;
}

function routeLoads(byDevice: Partial<Record<DeviceKind, SpeedCell>>): number {
  return (byDevice.phone?.n ?? 0) + (byDevice.desktop?.n ?? 0);
}

function capRoutes(routes: SpeedDay["routes"]): SpeedDay["routes"] {
  const entries = Object.entries(routes);
  if (entries.length <= MAX_ROUTES) return routes;
  entries.sort((a, b) => routeLoads(b[1]) - routeLoads(a[1]) || a[0].localeCompare(b[0]));
  const kept = Object.fromEntries(entries.slice(0, MAX_ROUTES - 1));
  const other: Partial<Record<DeviceKind, SpeedCell>> = own(kept, OTHER_ROUTE) ?? {};
  for (const [route, byDevice] of entries.slice(MAX_ROUTES - 1)) {
    if (route === OTHER_ROUTE) continue;
    for (const device of DEVICES) if (byDevice[device]) mergeCell((other[device] ??= emptyCell()), byDevice[device]);
  }
  kept[OTHER_ROUTE] = other;
  return kept;
}

/* ── what the Speed tab shows ────────────────────────────────────────────── */

export const SPEED_RANGES = ["today", "7d", "14d"] as const;
export type SpeedRange = (typeof SPEED_RANGES)[number];
export const TREND_DAYS = 14;

export function parseSpeedRange(value: unknown): SpeedRange {
  return SPEED_RANGES.includes(value as SpeedRange) ? (value as SpeedRange) : "7d";
}

export function rangeLength(range: SpeedRange): number {
  return range === "today" ? 1 : range === "7d" ? 7 : 14;
}

export type DeviceFilter = "all" | DeviceKind;

export function parseDeviceFilter(value: unknown): DeviceFilter {
  return value === "phone" || value === "desktop" ? value : "all";
}

/** Fewer loads than this and a route's figures are shown but not ranked or coloured: one slow load is not a trend. */
export const MIN_LOADS = 5;

export type P75s = Record<MetricId, number | null>;

export type CacheShare = { hit: number; known: number; browser: number; share: number | null };

export type SpeedRouteRow = {
  route: string;
  loads: number;
  p75: P75s;
  cache: CacheShare;
  /** LCP p75 per day over the last TREND_DAYS days, oldest first (null: no loads that day). */
  trend: Array<number | null>;
};

export type SpeedSplitRow = { key: string; loads: number; p75: P75s };

/** Caddy's time to the app's response headers, on loads that reached the app (not the edge cache or the browser's). */
export type ServerTime = { loads: number; p50: number | null; p95: number | null };

export type SpeedView = {
  range: SpeedRange;
  device: DeviceFilter;
  generatedAt: string;
  loads: number;
  p75: P75s;
  /** The slow tail, p95 per metric. */
  p95: P75s;
  /** p75 per metric for phones and desktops (whatever the device filter). */
  byDevice: Record<DeviceKind, { loads: number; p75: P75s }>;
  /** p75 per metric per day over TREND_DAYS, oldest first. */
  trend: Record<MetricId, Array<number | null>>;
  cache: CacheShare;
  server: ServerTime;
  /** Share of loads with a poor LCP (over 4 s). */
  slowLcp: number | null;
  routes: SpeedRouteRow[];
  nets: SpeedSplitRow[];
  signedIn: SpeedSplitRow[];
  empty: boolean;
};

function p75Of(cell: SpeedCell, q = 0.75): P75s {
  return Object.fromEntries(METRICS.map((m) => [m, percentile(m, cell.h[m], q)])) as P75s;
}

function cacheOf(cell: SpeedCell): CacheShare {
  const hit = (cell.c.hit ?? 0) + (cell.c.stale ?? 0);
  const known = hit + (cell.c.miss ?? 0) + (cell.c.pass ?? 0);
  return { hit, known, browser: cell.c.browser ?? 0, share: known > 0 ? hit / known : null };
}

function cellFor(day: SpeedDay, route: string | null, device: DeviceFilter): SpeedCell {
  const out = emptyCell();
  const routes = route == null ? Object.values(day.routes ?? {}) : [own(day.routes ?? {}, route) ?? {}];
  for (const byDevice of routes) {
    for (const d of DEVICES) if (device === "all" || device === d) mergeCell(out, byDevice?.[d]);
  }
  // The first version's timings have no route or device: whole site, all devices only.
  if (route == null && device === "all") mergeCell(out, day.legacy);
  return out;
}

/**
 * Pure: the Speed tab from the daily rollups of the last TREND_DAYS days (oldest first, today last). The range
 * picks how many of the newest days the figures cover; the trends always show all of them.
 */
export function buildSpeed(input: { days: readonly SpeedDay[]; range: SpeedRange; device: DeviceFilter; now: number }): SpeedView {
  const { days, range, device, now } = input;
  const inRange = days.slice(-rangeLength(range));
  const total = emptyCell();
  for (const day of inRange) mergeCell(total, cellFor(day, null, device));

  const byDevice = Object.fromEntries(
    DEVICES.map((d) => {
      const cell = emptyCell();
      for (const day of inRange) mergeCell(cell, cellFor(day, null, d));
      return [d, { loads: cell.n, p75: p75Of(cell) }];
    }),
  ) as SpeedView["byDevice"];

  const trend = Object.fromEntries(
    METRICS.map((m) => [m, days.map((day) => percentile(m, cellFor(day, null, device).h[m], 0.75))]),
  ) as SpeedView["trend"];

  const routeNames = new Set<string>();
  for (const day of inRange) for (const route of Object.keys(day.routes ?? {})) routeNames.add(route);
  const routes: SpeedRouteRow[] = [];
  for (const route of routeNames) {
    const cell = emptyCell();
    for (const day of inRange) mergeCell(cell, cellFor(day, route, device));
    if (cell.n === 0) continue;
    routes.push({
      route,
      loads: cell.n,
      p75: p75Of(cell),
      cache: cacheOf(cell),
      trend: days.map((day) => percentile("lcp", cellFor(day, route, device).h.lcp, 0.75)),
    });
  }
  routes.sort(slowestFirst);

  const split = (prefix: string): SpeedSplitRow[] => {
    const cells = new Map<string, SpeedCell>();
    for (const day of inRange) {
      for (const [key, cell] of Object.entries(day.cuts ?? {})) {
        if (!key.startsWith(prefix)) continue;
        const into = cells.get(key) ?? emptyCell();
        mergeCell(into, cell);
        cells.set(key, into);
      }
    }
    return [...cells]
      .map(([key, cell]) => ({ key: key.slice(prefix.length), loads: cell.n, p75: p75Of(cell) }))
      .filter((row) => row.loads > 0)
      .sort((a, b) => b.loads - a.loads || a.key.localeCompare(b.key));
  };

  return {
    range,
    device,
    generatedAt: new Date(now).toISOString(),
    loads: total.n,
    p75: p75Of(total),
    p95: p75Of(total, 0.95),
    byDevice,
    trend,
    cache: cacheOf(total),
    server: { loads: histCount(total.h.origin), p50: percentile("origin", total.h.origin, 0.5), p95: percentile("origin", total.h.origin, 0.95) },
    slowLcp: poorShare("lcp", total.h.lcp),
    routes,
    // Network and signed-in cuts are whole-site (all devices): they answer "is it the network, or the page?".
    nets: split("net:"),
    signedIn: split("si:"),
    empty: total.n === 0,
  };
}

/** The figure a route is ranked by: LCP, or FCP / TTFB where the browser has no LCP (Safari before 26). */
export function rankValue(p75: P75s): number | null {
  return p75.lcp ?? p75.fcp ?? p75.ttfb;
}

/** Slowest first by the figure shown (routes with few loads are greyed on the page, not moved); no figure at all goes last. */
function slowestFirst(a: SpeedRouteRow, b: SpeedRouteRow): number {
  const av = rankValue(a.p75);
  const bv = rankValue(b.p75);
  if ((av == null) !== (bv == null)) return av == null ? 1 : -1;
  return (bv ?? 0) - (av ?? 0) || b.loads - a.loads || a.route.localeCompare(b.route);
}

/** Share of loads whose LCP was poor (over 4 s), or null without LCP. */
export function poorShare(metric: MetricId, hist: Histogram | undefined): number | null {
  const total = histCount(hist);
  if (!hist || total === 0) return null;
  const firstPoor = bucketOf(metric, THRESHOLDS[metric][1]) + 1;
  let poor = 0;
  for (let i = firstPoor; i < hist.length; i += 1) poor += Number(hist[i]) || 0;
  return poor / total;
}
