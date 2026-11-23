import { analyticsDb } from "./db.ts";
import { funnel, stepRates, type FunnelStep } from "./funnel.ts";
import { legacyRollup } from "./legacy.ts";
import {
  avgSeconds,
  bounceRate,
  combineDays,
  exitRate,
  hoursUpTo,
  liveView,
  mergeRollups,
  PAID_EVENT,
  rollupDay,
  SIGNUP_EVENTS,
  type DayRollup,
  type HourRow,
  type LiveView,
  type RangeTotals,
} from "./rollup.ts";
import { utcDay } from "./visitor.ts";

/**
 * What /admin/analytics shows, built from the daily rollups (past days are read as one small row each, and
 * folded from raw chunks only once) plus today's chunks, with the first version's daily totals added on for the
 * days it kept (lib/analytics/legacy.ts). The process caches a range's answer for 60 seconds.
 */

export const RANGES = ["today", "7d", "30d", "90d"] as const;
export type RangeId = (typeof RANGES)[number];

export function parseRange(value: unknown): RangeId {
  return RANGES.includes(value as RangeId) ? (value as RangeId) : "7d";
}

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * A day's rollup is final once the day has been over this long: until then it is folded again from the raw
 * chunks, so events that arrive late (a flush retried after an error, a spool sent after a restart) still count.
 */
export const FINAL_AFTER_MS = 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000;
const CACHE_MS = 60 * 1000;
/** Finished days kept in memory: two 90-day ranges and some. */
const MAX_FINAL = 400;

export function dayStart(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}

/** The days a range covers (oldest first), and the same number of days before them. */
export function rangeDays(range: RangeId, now: number): { current: string[]; previous: string[] } {
  const count = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const today = dayStart(utcDay(now));
  const current = Array.from({ length: count }, (_, i) => utcDay(today - (count - 1 - i) * DAY_MS));
  const previous = Array.from({ length: count }, (_, i) => utcDay(today - (2 * count - 1 - i) * DAY_MS));
  return { current, previous };
}

export type Metric = { value: number | null; previous: number | null; spark: number[] };
export type Ranked = { key: string; value: number; share: number };
export type PageStat = { key: string; views: number; visitors: number; exitRate: number | null };

export type Dashboard = {
  range: RangeId;
  generatedAt: string;
  /** Hourly points for "today", daily otherwise. */
  series: Array<{ label: string; at: string; visitors: number; pageviews: number }>;
  headline: {
    visitors: Metric;
    pageviews: Metric;
    sessions: Metric;
    bounce: Metric;
    avgSession: Metric;
    /** Newsletter subscriptions and new accounts. */
    signups: Metric;
    /** Purchases (a sponsor slot). */
    paid: Metric;
  };
  /** Signed-in pageviews and visitors, and their share of the pageviews that carry the flag. */
  signedIn: { pageviews: number; visitors: number; share: number | null };
  sources: { referrers: Ranked[]; utmSource: Ranked[]; utmMedium: Ranked[]; utmCampaign: Ranked[]; countries: Ranked[]; devices: Ranked[]; browsers: Ranked[]; screens: Ranked[] };
  pages: { paths: PageStat[]; routes: PageStat[] };
  /** Stories, briefs, featured items and articles, most opened first. */
  reads: Array<{ path: string; views: number; visitors: number }>;
  forms: Ranked[];
  shares: Ranked[];
  events: Record<string, { n: number; v: number }>;
  brief: { on: number; off: number };
  funnel: Array<FunnelStep & { rate: number | null }>;
  /** True when no data exists for the range at all. */
  empty: boolean;
};

function ranked(counter: Record<string, number>, limit = 12): Ranked[] {
  const total = Object.values(counter).reduce((sum, n) => sum + n, 0);
  return Object.entries(counter)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, value]) => ({ key, value, share: total > 0 ? value / total : 0 }));
}

function pageStats(record: RangeTotals["pages"], limit = 40): PageStat[] {
  return Object.entries(record)
    .sort((a, b) => b[1].pv - a[1].pv || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, row]) => ({ key, views: row.pv, visitors: row.v, exitRate: exitRate(row) }));
}

type Cut = Pick<HourRow, "v" | "pv" | "s" | "b" | "d" | "su" | "pd">;

function eventCount(day: Pick<DayRollup, "events">, names: ReadonlySet<string> | string): number {
  let n = 0;
  for (const [name, row] of Object.entries(day.events ?? {})) if (typeof names === "string" ? name === names : names.has(name)) n += Number(row?.n) || 0;
  return n;
}

function cutOf(days: readonly DayRollup[]): Cut {
  return days.reduce(
    (sum, day) => ({ v: sum.v + day.v, pv: sum.pv + day.pv, s: sum.s + day.s, b: sum.b + day.b, d: sum.d + day.d, su: sum.su + eventCount(day, SIGNUP_EVENTS), pd: sum.pd + eventCount(day, PAID_EVENT) }),
    { v: 0, pv: 0, s: 0, b: 0, d: 0, su: 0, pd: 0 },
  );
}

function addCut(a: Cut, b: Cut): Cut {
  return { v: a.v + b.v, pv: a.pv + b.pv, s: a.s + b.s, b: a.b + b.b, d: a.d + b.d, su: a.su + b.su, pd: a.pd + b.pd };
}

/** Pure: the dashboard from rollups for the current and previous days and the clock. */
export function buildDashboard(input: { range: RangeId; now: number; current: DayRollup[]; previous: DayRollup[] }): Dashboard {
  const { range, now, current, previous } = input;
  const totals = mergeRollups(current);
  const today = range === "today";
  const hour = new Date(now).getUTCHours();
  // Like with like: the range ends partway through today, so the period before ends at the same hour of its last day
  // (today so far against yesterday by this hour; 7 days so far against the 7 days before, cut the same way).
  const cutWith = (days: readonly DayRollup[]): Cut => addCut(cutOf(days.slice(0, -1)), hoursUpTo(days[days.length - 1]!, hour));
  const cur = cutWith(current);
  const prev = cutWith(previous);

  // Sparklines: hours for today, days otherwise.
  const startCur = dayStart(current[0]!.day);
  const points: Array<Cut & { start: number }> = today
    ? current[0]!.hours.slice(0, hour + 1).map((row, h) => ({ ...row, start: startCur + h * 3600_000 }))
    : current.map((day) => ({ ...cutOf([day]), start: dayStart(day.day) }));

  const metric = (value: number | null, previousValue: number | null, spark: number[]): Metric => ({ value, previous: previousValue, spark });
  const steps = funnel(totals);
  const rates = stepRates(steps);
  // Pageviews from the first version carry no signed-in flag: the share is of the ones that do.
  const flagged = totals.pv - (totals.lpv ?? 0);

  return {
    range,
    generatedAt: new Date(now).toISOString(),
    series: points.map((p) => ({
      label: today ? `${String(new Date(p.start).getUTCHours()).padStart(2, "0")}:00` : new Date(p.start).toISOString().slice(0, 10),
      at: new Date(p.start).toISOString(),
      visitors: p.v,
      pageviews: p.pv,
    })),
    headline: {
      visitors: metric(cur.v, prev.v, points.map((p) => p.v)),
      pageviews: metric(cur.pv, prev.pv, points.map((p) => p.pv)),
      sessions: metric(cur.s, prev.s, points.map((p) => p.s)),
      bounce: metric(bounceRate(cur.s, cur.b), bounceRate(prev.s, prev.b), points.map((p) => bounceRate(p.s, p.b) ?? 0)),
      avgSession: metric(avgSeconds(cur.s, cur.d), avgSeconds(prev.s, prev.d), points.map((p) => avgSeconds(p.s, p.d) ?? 0)),
      signups: metric(cur.su, prev.su, points.map((p) => p.su)),
      paid: metric(cur.pd, prev.pd, points.map((p) => p.pd)),
    },
    signedIn: { pageviews: totals.si_pv, visitors: totals.si_v, share: flagged > 0 ? totals.si_pv / flagged : null },
    sources: {
      referrers: ranked(totals.refs),
      utmSource: ranked(totals.utm_source, 8),
      utmMedium: ranked(totals.utm_medium, 8),
      utmCampaign: ranked(totals.utm_campaign, 8),
      countries: ranked(totals.countries, 16),
      devices: ranked(totals.devices, 3),
      browsers: ranked(totals.browsers, 8),
      screens: ranked(totals.screens, 6),
    },
    pages: { paths: pageStats(totals.pages), routes: pageStats(totals.routes) },
    reads: Object.entries(totals.reads)
      .sort((a, b) => b[1].pv - a[1].pv || a[0].localeCompare(b[0]))
      .slice(0, 20)
      .map(([path, row]) => ({ path, views: row.pv, visitors: row.v })),
    forms: ranked(totals.forms, 10),
    shares: ranked(totals.shares, 8),
    events: totals.events,
    brief: { on: totals.brief.on ?? 0, off: totals.brief.off ?? 0 },
    funnel: steps.map((stepRow, index) => ({ ...stepRow, rate: rates[index] ?? null })),
    empty: totals.pv === 0 && Object.keys(totals.events).length === 0,
  };
}

/* ── loading, with caches ──────────────────────────────────────────────── */

type CacheState = {
  /** Finished days never change: kept for the life of the process (at most MAX_FINAL). */
  final: Map<string, DayRollup>;
  /** The first version's totals by day: nothing writes them any more, so they never change either. */
  legacy: Map<string, DayRollup | null>;
  /** Days still open (today and the two before), folded from raw events: one fold per day shared by every range, for CACHE_MS. */
  open: Map<string, { at: number; value: Promise<DayRollup> }>;
  answers: Map<string, { at: number; value: Promise<Dashboard> }>;
};

const globalKey = "__traceAnalyticsDashboard" as const;
type GlobalWithCache = typeof globalThis & { [globalKey]?: CacheState };

function cache(): CacheState {
  const g = globalThis as GlobalWithCache;
  if (!g[globalKey]) g[globalKey] = { final: new Map(), legacy: new Map(), open: new Map(), answers: new Map() };
  return g[globalKey]!;
}

function remember<V>(map: Map<string, V>, key: string, value: V) {
  map.delete(key);
  map.set(key, value);
  while (map.size > MAX_FINAL) map.delete(map.keys().next().value as string);
}

/**
 * One day folded from its raw chunks. A fold in flight or under CACHE_MS old is shared, so the four ranges and the
 * the JSON route never rebuild the same day side by side. A day whose read hit MAX_DAY_EVENTS is never final, so its
 * raw events are never pruned (lib/analytics/retention.ts keeps chunks whose day has no final rollup).
 */
function foldDay(ns: string, day: string, now: number): Promise<DayRollup> {
  const c = cache();
  const key = `${ns}:${day}`;
  const hit = c.open.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.value;
  for (const [k, entry] of c.open) if (now - entry.at >= CACHE_MS) c.open.delete(k);
  const value = (async () => {
    const final = now >= dayStart(day) + DAY_MS + FINAL_AFTER_MS;
    const { chunks, capped } = await analyticsDb().chunksForDay(ns, day);
    return rollupDay(day, chunks.flatMap((chunk) => chunk.events), { complete: final && !capped, now });
  })();
  c.open.set(key, { at: now, value });
  value.catch(() => {
    if (c.open.get(key)?.value === value) c.open.delete(key);
  });
  return value;
}

/**
 * Rollups for these days: finished days from memory or their stored rollup; anything missing or not final is
 * folded from its raw chunks (one day at a time, to keep memory flat), and stored once the day is final so it is
 * never folded again.
 */
export async function loadRollups(ns: string, days: readonly string[], now: number): Promise<DayRollup[]> {
  const c = cache();
  const db = analyticsDb();
  const key = (day: string) => `${ns}:${day}`;
  const missing = days.filter((day) => !c.final.has(key(day)));
  const stored = missing.length > 0 ? await db.readRollups(ns, missing) : new Map<string, DayRollup>();
  const fresh = new Map<string, DayRollup>();
  const finished: DayRollup[] = [];
  for (const day of missing) {
    const rollup = stored.get(day);
    if (rollup?.complete) {
      remember(c.final, key(day), rollup);
      continue;
    }
    const folded = await foldDay(ns, day, now);
    fresh.set(day, folded);
    if (folded.complete) finished.push(folded);
  }
  for (const rollup of finished) remember(c.final, key(rollup.day), rollup);
  if (finished.length > 0) await db.writeRollups(ns, finished).catch((error) => console.warn("[analytics] rollup write failed:", (error as Error)?.message));
  return days.map((day) => c.final.get(key(day)) ?? fresh.get(day)!);
}

/** The first version's totals for these days, as rollups (null where it kept nothing). */
async function loadLegacy(ns: string, days: readonly string[], now: number): Promise<Map<string, DayRollup | null>> {
  const c = cache();
  const key = (day: string) => `${ns}:${day}`;
  const todayDay = utcDay(now);
  const missing = days.filter((day) => !c.legacy.has(key(day)));
  const out = new Map<string, DayRollup | null>();
  if (missing.length > 0) {
    const rows = await analyticsDb().legacyTotals(ns, missing);
    for (const day of missing) {
      // Today's counts are spread over the hours so far; a finished day's over all 24.
      const rollup = legacyRollup(day, rows.get(day) ?? [], day === todayDay ? new Date(now).getUTCHours() + 1 : 24);
      if (day < todayDay) remember(c.legacy, key(day), rollup);
      out.set(day, rollup);
    }
  }
  for (const day of days) if (!out.has(day)) out.set(day, c.legacy.get(key(day)) ?? null);
  return out;
}

/** Rollups for these days with the first version's totals added on. */
export async function loadDays(ns: string, days: readonly string[], now: number): Promise<DayRollup[]> {
  const [rollups, legacy] = await Promise.all([loadRollups(ns, days, now), loadLegacy(ns, days, now)]);
  return rollups.map((rollup) => combineDays(rollup, legacy.get(rollup.day) ?? undefined));
}

export function loadDashboard(ns: string, range: RangeId, now = Date.now()): Promise<Dashboard> {
  const c = cache();
  const cacheKey = `${ns}:${range}`;
  const hit = c.answers.get(cacheKey);
  if (hit && now - hit.at < CACHE_MS) return hit.value;
  const value = (async () => {
    const { current, previous } = rangeDays(range, now);
    const rollups = await loadDays(ns, [...previous, ...current], now);
    return buildDashboard({ range, now, previous: rollups.slice(0, previous.length), current: rollups.slice(previous.length) });
  })();
  c.answers.set(cacheKey, { at: now, value });
  value.catch(() => {
    if (c.answers.get(cacheKey)?.value === value) c.answers.delete(cacheKey);
  });
  return value;
}

/** Who is on the site in the last five minutes, read from the raw chunks. */
export async function loadLive(ns: string, now = Date.now()): Promise<LiveView & { at: string }> {
  const chunks = await analyticsDb().chunksSince(ns, now - 5 * 60 * 1000);
  return { ...liveView(chunks.flatMap((chunk) => chunk.events), now), at: new Date(now).toISOString() };
}

/** Tests only. */
export function resetDashboardCacheForTests() {
  const g = globalThis as GlobalWithCache;
  delete g[globalKey];
}
