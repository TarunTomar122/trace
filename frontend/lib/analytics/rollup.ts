import type { BrowserFamily, DeviceClass } from "./ua.ts";
import { isReadPath, type KeyEventName } from "./normalize.ts";

/**
 * The analytics data model and its math. Pure: the store code feeds it rows
 * and the tests feed it fixtures.
 *
 * Raw events are kept in chunks (one row per flush, a few seconds of traffic)
 * and every finished UTC day is folded into one small rollup, which is all the
 * dashboard reads for past days. Visitors are unique per day (the visitor id
 * rotates daily, see lib/analytics/visitor.ts), so a range's visitor count is
 * the sum of its days, the way Plausible counts.
 */

export type StoredEvent = {
  /** Server time, epoch ms. */
  t: number;
  n: KeyEventName;
  /** Session id: random, made by the browser tab, kept in sessionStorage. Empty on account events. */
  sid: string;
  /** Daily visitor hash (16 hex). */
  vid: string;
  /** Public path, cleaned (no query or hash), or the route of a page that belongs to someone. */
  p: string;
  /** The route the path belongs to ("/brief/[date]"). */
  r: string;
  /** Referrer host, first pageview of a visit only; null for direct. */
  ref?: string | null;
  us?: string | null;
  um?: string | null;
  uc?: string | null;
  dev?: DeviceClass;
  br?: BrowserFamily;
  sw?: string | null;
  cc?: string | null;
  /** Signed in when the event was sent: a yes/no flag only, never who. */
  si?: boolean | null;
  /** The event's one property (lib/analytics/normalize.ts EventProps). */
  kind?: string;
};

export type EventChunk = {
  days: string[];
  first_ts: number;
  last_ts: number;
  count: number;
  events: StoredEvent[];
  created_at: string;
};

export type Counter = Record<string, number>;
export type PageRow = { pv: number; v: number; x: number; e: number };
/** By hour: pageviews, visitors first seen, visits started (bounced, seconds long), sign-ups and purchases. */
export type HourRow = { pv: number; v: number; s: number; b: number; d: number; su: number; pd: number };

export type DayRollup = {
  day: string;
  /** Unique visitors that day. */
  v: number;
  pv: number;
  /** Sessions (visits). */
  s: number;
  /** Sessions with one pageview and nothing else. */
  b: number;
  /** Total visit length, seconds. */
  d: number;
  /** Pageviews and visitors while signed in (the anonymous flag). */
  si_pv: number;
  si_v: number;
  /** Pageviews counted by the first version of these analytics, which kept no signed-in flag (lib/analytics/legacy.ts). */
  lpv?: number;
  /** By UTC hour: pageviews, visitors first seen that hour, visits started that hour, sign-ups and purchases. */
  hours: HourRow[];
  pages: Record<string, PageRow>;
  routes: Record<string, PageRow>;
  /** Visitors by source (referrer host, or "(direct)"). */
  refs: Counter;
  utm_source: Counter;
  utm_medium: Counter;
  utm_campaign: Counter;
  countries: Counter;
  devices: Counter;
  browsers: Counter;
  screens: Counter;
  /** Stories, briefs, featured items and articles: views and visitors by path. */
  reads: Record<string, { pv: number; v: number }>;
  /** Newsletter signups by the form they came through, and shares by channel. */
  forms: Counter;
  shares: Counter;
  /** Key events: how many and by how many visitors. */
  events: Record<string, { n: number; v: number }>;
  /** Daily brief emails switched on and off. */
  brief: Counter;
  /** Set when the day was over (plus a grace period) when this was computed: it will not change again. */
  complete: boolean;
  computed_at: string;
};

/** Caps so one rollup stays a small row whatever the traffic. */
export const CAPS = { pages: 300, routes: 150, refs: 100, utm: 60, countries: 250, reads: 150, forms: 40 } as const;

/** What counts as a sign-up on the headline: a newsletter subscription or a new account. */
export const SIGNUP_EVENTS: ReadonlySet<string> = new Set(["newsletter_signup", "signup_completed"]);
export const PAID_EVENT = "purchase_completed";

export function emptyHour(): HourRow {
  return { pv: 0, v: 0, s: 0, b: 0, d: 0, su: 0, pd: 0 };
}

export function emptyHours(): HourRow[] {
  return Array.from({ length: 24 }, emptyHour);
}

export function emptyRollup(day: string, complete = false, now = Date.now()): DayRollup {
  return {
    day,
    v: 0,
    pv: 0,
    s: 0,
    b: 0,
    d: 0,
    si_pv: 0,
    si_v: 0,
    hours: emptyHours(),
    pages: {},
    routes: {},
    refs: {},
    utm_source: {},
    utm_medium: {},
    utm_campaign: {},
    countries: {},
    devices: {},
    browsers: {},
    screens: {},
    reads: {},
    forms: {},
    shares: {},
    events: {},
    brief: {},
    complete,
    computed_at: new Date(now).toISOString(),
  };
}

function hourOf(t: number): number {
  return new Date(t).getUTCHours();
}

/**
 * A key's current count, own properties only: a referrer or UTM value of
 * "constructor" must not read Object's, and "__proto__" is never a counter.
 */
function countOf(counter: Counter, key: string): number | null {
  if (key === "__proto__") return null;
  return Object.prototype.hasOwnProperty.call(counter, key) ? Number(counter[key]) || 0 : 0;
}

function bump(counter: Counter, key: string, by = 1) {
  const n = countOf(counter, key);
  if (n != null) counter[key] = n + by;
}

function topN<T>(record: Record<string, T>, n: number, weight: (value: T) => number): Record<string, T> {
  const entries = Object.entries(record);
  if (entries.length <= n) return record;
  return Object.fromEntries(entries.sort((a, b) => weight(b[1]) - weight(a[1])).slice(0, n));
}

/** Count of distinct visitors per key, from (key, visitor) pairs. */
function visitorsBy(pairs: Iterable<[string, string]>): Counter {
  const sets = new Map<string, Set<string>>();
  for (const [key, vid] of pairs) {
    let set = sets.get(key);
    if (!set) sets.set(key, (set = new Set()));
    set.add(vid);
  }
  return Object.fromEntries([...sets].map(([key, set]) => [key, set.size]));
}

/** One day's rollup from that day's events (any order; events from other days are ignored). */
export function rollupDay(day: string, input: readonly StoredEvent[], options: { complete?: boolean; now?: number } = {}): DayRollup {
  const out = emptyRollup(day, options.complete ?? false, options.now);
  const events = input.filter((e) => new Date(e.t).toISOString().slice(0, 10) === day).sort((a, b) => a.t - b.t);
  if (events.length === 0) return out;

  const visitors = new Set<string>();
  const signedVisitors = new Set<string>();
  const firstSeenHour = new Map<string, number>();
  const sessions = new Map<string, StoredEvent[]>();

  for (const e of events) {
    visitors.add(e.vid);
    if (!firstSeenHour.has(e.vid)) firstSeenHour.set(e.vid, hourOf(e.t));
    // A session id is only trusted together with the visitor it started with. Account events carry none
    // (lib/analytics/ingest.ts ACCOUNT_EVENTS): they count as events, never as part of a visit.
    if (e.sid) {
      const key = `${e.vid}:${e.sid}`;
      let list = sessions.get(key);
      if (!list) sessions.set(key, (list = []));
      list.push(e);
    }
    if (e.n === "pageview") {
      out.pv += 1;
      out.hours[hourOf(e.t)]!.pv += 1;
      if (e.si) {
        out.si_pv += 1;
        signedVisitors.add(e.vid);
      }
    } else if (SIGNUP_EVENTS.has(e.n)) out.hours[hourOf(e.t)]!.su += 1;
    else if (e.n === PAID_EVENT) out.hours[hourOf(e.t)]!.pd += 1;
  }
  out.v = visitors.size;
  out.si_v = signedVisitors.size;
  for (const hour of firstSeenHour.values()) out.hours[hour]!.v += 1;

  const pagePairs: Array<[string, string]> = [];
  const routePairs: Array<[string, string]> = [];
  const readPairs: Array<[string, string]> = [];
  const refPairs: Array<[string, string]> = [];
  const utmPairs = { utm_source: [] as Array<[string, string]>, utm_medium: [] as Array<[string, string]>, utm_campaign: [] as Array<[string, string]> };
  const countryPairs: Array<[string, string]> = [];
  const devicePairs: Array<[string, string]> = [];
  const browserPairs: Array<[string, string]> = [];
  const screenPairs: Array<[string, string]> = [];
  const eventPairs: Array<[string, string]> = [];

  for (const list of sessions.values()) {
    const views = list.filter((e) => e.n === "pageview");
    const first = list[0]!;
    const start = views[0] ?? first;
    const startHour = hourOf(first.t);
    const length = Math.max(0, Math.round((list[list.length - 1]!.t - first.t) / 1000));
    const bounced = views.length <= 1 && list.every((e) => e.n === "pageview");
    // Events with no pageview in the visit (a tab left open past midnight) are not a visit of their own.
    if (views.length === 0) continue;
    out.s += 1;
    out.d += length;
    out.hours[startHour]!.s += 1;
    out.hours[startHour]!.d += length;
    if (bounced) {
      out.b += 1;
      out.hours[startHour]!.b += 1;
    }
    const entry = views[0]!;
    const exit = views[views.length - 1]!;
    for (const [record, entryKey, exitKey] of [
      [out.pages, entry.p, exit.p],
      [out.routes, entry.r, exit.r],
    ] as const) {
      (record[entryKey] ??= { pv: 0, v: 0, x: 0, e: 0 }).e += 1;
      (record[exitKey] ??= { pv: 0, v: 0, x: 0, e: 0 }).x += 1;
    }
    // A visit's source is how it started: its first pageview's referrer and UTM tags.
    refPairs.push([start.ref || "(direct)", start.vid]);
    if (start.us) utmPairs.utm_source.push([start.us, start.vid]);
    if (start.um) utmPairs.utm_medium.push([start.um, start.vid]);
    if (start.uc) utmPairs.utm_campaign.push([start.uc, start.vid]);
    countryPairs.push([start.cc || "??", start.vid]);
    if (start.dev) devicePairs.push([start.dev, start.vid]);
    if (start.br) browserPairs.push([start.br, start.vid]);
    if (start.sw) screenPairs.push([start.sw, start.vid]);
  }

  for (const e of events) {
    if (e.n === "pageview") {
      const page = (out.pages[e.p] ??= { pv: 0, v: 0, x: 0, e: 0 });
      page.pv += 1;
      pagePairs.push([e.p, e.vid]);
      const route = (out.routes[e.r] ??= { pv: 0, v: 0, x: 0, e: 0 });
      route.pv += 1;
      routePairs.push([e.r, e.vid]);
      if (isReadPath(e.p)) {
        const row = (out.reads[e.p] ??= { pv: 0, v: 0 });
        row.pv += 1;
        readPairs.push([e.p, e.vid]);
      }
      continue;
    }
    const row = (out.events[e.n] ??= { n: 0, v: 0 });
    row.n += 1;
    eventPairs.push([e.n, e.vid]);
    if (e.n === "newsletter_signup") bump(out.forms, e.kind || "(unknown)");
    if (e.n === "share") bump(out.shares, e.kind || "link");
    if (e.n === "brief_pref" && (e.kind === "on" || e.kind === "off")) bump(out.brief, e.kind);
  }

  for (const [key, n] of Object.entries(visitorsBy(pagePairs))) out.pages[key]!.v = n;
  for (const [key, n] of Object.entries(visitorsBy(routePairs))) out.routes[key]!.v = n;
  for (const [key, n] of Object.entries(visitorsBy(readPairs))) out.reads[key]!.v = n;
  for (const [key, n] of Object.entries(visitorsBy(eventPairs))) out.events[key]!.v = n;
  out.refs = visitorsBy(refPairs);
  out.utm_source = visitorsBy(utmPairs.utm_source);
  out.utm_medium = visitorsBy(utmPairs.utm_medium);
  out.utm_campaign = visitorsBy(utmPairs.utm_campaign);
  out.countries = visitorsBy(countryPairs);
  out.devices = visitorsBy(devicePairs);
  out.browsers = visitorsBy(browserPairs);
  out.screens = visitorsBy(screenPairs);

  out.pages = topN(out.pages, CAPS.pages, (row) => row.pv);
  out.routes = topN(out.routes, CAPS.routes, (row) => row.pv);
  out.reads = topN(out.reads, CAPS.reads, (row) => row.pv);
  out.refs = topN(out.refs, CAPS.refs, (n) => n);
  out.utm_source = topN(out.utm_source, CAPS.utm, (n) => n);
  out.utm_medium = topN(out.utm_medium, CAPS.utm, (n) => n);
  out.utm_campaign = topN(out.utm_campaign, CAPS.utm, (n) => n);
  out.countries = topN(out.countries, CAPS.countries, (n) => n);
  out.forms = topN(out.forms, CAPS.forms, (n) => n);
  out.shares = topN(out.shares, CAPS.forms, (n) => n);
  return out;
}

/* ── merging days ──────────────────────────────────────────────────────── */

export type RangeTotals = Omit<DayRollup, "day" | "hours" | "complete" | "computed_at">;

function addCounter(into: Counter, from: Counter | undefined) {
  for (const [key, n] of Object.entries(from ?? {})) bump(into, key, Number(n) || 0);
}

function addRows<T extends Record<string, number>>(into: Record<string, T>, from: Record<string, T> | undefined) {
  for (const [key, row] of Object.entries(from ?? {})) {
    if (key === "__proto__" || !row || typeof row !== "object") continue;
    if (!Object.prototype.hasOwnProperty.call(into, key)) into[key] = Object.fromEntries(Object.keys(row).map((k) => [k, 0])) as T;
    const target = into[key]!;
    for (const [field, n] of Object.entries(row)) (target as Record<string, number>)[field] = ((target as Record<string, number>)[field] ?? 0) + (Number(n) || 0);
  }
}

/** Add one rollup's counts into another (same shape), hours included. */
export function addInto(out: DayRollup, day: DayRollup) {
  out.v += day.v;
  out.pv += day.pv;
  out.s += day.s;
  out.b += day.b;
  out.d += day.d;
  out.si_pv += day.si_pv;
  out.si_v += day.si_v;
  if (day.lpv) out.lpv = (out.lpv ?? 0) + day.lpv;
  (day.hours ?? []).forEach((row, h) => {
    const into = out.hours[h];
    if (!into || !row) return;
    for (const key of Object.keys(into) as Array<keyof HourRow>) into[key] += Number(row[key]) || 0;
  });
  addRows(out.pages, day.pages);
  addRows(out.routes, day.routes);
  addRows(out.reads, day.reads);
  addRows(out.events, day.events);
  addCounter(out.refs, day.refs);
  addCounter(out.utm_source, day.utm_source);
  addCounter(out.utm_medium, day.utm_medium);
  addCounter(out.utm_campaign, day.utm_campaign);
  addCounter(out.countries, day.countries);
  addCounter(out.devices, day.devices);
  addCounter(out.browsers, day.browsers);
  addCounter(out.screens, day.screens);
  addCounter(out.forms, day.forms);
  addCounter(out.shares, day.shares);
  addCounter(out.brief, day.brief);
}

/** A day's rollup with another's counts added (the totals kept before the rollups); neither input changes. */
export function combineDays(day: DayRollup, extra: DayRollup | undefined): DayRollup {
  if (!extra) return day;
  const out = emptyRollup(day.day, day.complete);
  out.computed_at = day.computed_at;
  addInto(out, day);
  addInto(out, extra);
  return out;
}

/** Sum of several days. Visitors add up across days (the id rotates daily). */
export function mergeRollups(days: readonly DayRollup[]): RangeTotals {
  const out: Partial<DayRollup> = emptyRollup("range");
  for (const day of days) addInto(out as DayRollup, day);
  delete out.day;
  delete out.hours;
  delete out.complete;
  delete out.computed_at;
  return out as RangeTotals;
}

/** The headline numbers of a day cut at an hour (inclusive), for "today so far" against "yesterday by this hour". */
export function hoursUpTo(day: DayRollup, lastHour: number): HourRow {
  const out = emptyHour();
  for (let h = 0; h <= Math.min(23, lastHour); h += 1) {
    const row = day.hours[h];
    if (!row) continue;
    for (const key of Object.keys(out) as Array<keyof HourRow>) out[key] += Number(row[key]) || 0;
  }
  return out;
}

export function bounceRate(sessions: number, bounced: number): number | null {
  return sessions > 0 ? bounced / sessions : null;
}

export function avgSeconds(sessions: number, seconds: number): number | null {
  return sessions > 0 ? seconds / sessions : null;
}

export function exitRate(row: PageRow): number | null {
  // No visits behind these views (days kept by the first version count views only): no exit rate.
  if (row.pv <= 0 || (row.x === 0 && row.e === 0 && row.v === 0)) return null;
  return Math.min(1, row.x / row.pv);
}

/* ── live ──────────────────────────────────────────────────────────────── */

export type LiveView = { visitors: number; pageviews: number; pages: Array<{ path: string; visitors: number }>; countries: Array<{ code: string; visitors: number }> };

/** Who is on the site in the last `windowMs` (5 minutes by default), from raw events. */
export function liveView(events: readonly StoredEvent[], now: number, windowMs = 5 * 60 * 1000): LiveView {
  const recent = events.filter((e) => e.t >= now - windowMs && e.t <= now + 60_000);
  const visitors = new Set(recent.map((e) => e.vid));
  // Each visitor counts on the page they viewed last.
  const lastPage = new Map<string, StoredEvent>();
  for (const e of [...recent].sort((a, b) => a.t - b.t)) if (e.n === "pageview") lastPage.set(e.vid, e);
  const byPage = new Map<string, number>();
  const byCountry = new Map<string, number>();
  for (const e of lastPage.values()) {
    byPage.set(e.p, (byPage.get(e.p) ?? 0) + 1);
    byCountry.set(e.cc || "??", (byCountry.get(e.cc || "??") ?? 0) + 1);
  }
  return {
    visitors: visitors.size,
    pageviews: recent.filter((e) => e.n === "pageview").length,
    pages: [...byPage].map(([path, n]) => ({ path, visitors: n })).sort((a, b) => b.visitors - a.visitors).slice(0, 12),
    countries: [...byCountry].map(([code, n]) => ({ code, visitors: n })).sort((a, b) => b.visitors - a.visitors).slice(0, 8),
  };
}
