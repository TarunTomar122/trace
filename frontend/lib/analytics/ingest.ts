import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

import { analyticsDb, analyticsNamespace } from "./db.ts";
import { pruneRawChunks, pruneVitalsChunks } from "./retention.ts";
import { countryOf, ensureGeo } from "./geo.ts";
import { cleanProps, cleanUtm, countsAsEvent, keyEventFor, publicPath, referrerHost, routeOf, type EventProps, type KeyEventName } from "./normalize.ts";
import type { EventChunk, StoredEvent } from "./rollup.ts";
import { parseVitals, vitalsChunkOf, type ParsedVitals, type VitalsChunk, type VitalsRow } from "./speed.ts";
import { speedDb } from "./speed-db.ts";
import { NAMESPACES, analyticsDir } from "./store.ts";
import { browserFamily, deviceClass, screenBucket } from "./ua.ts";
import { SaltKeeper, utcDay, visitorHash } from "./visitor.ts";

/**
 * The beacon's server side: parse what the browser sent, hold it in memory for
 * a few seconds, then write one chunk per flush. A request only parses and
 * pushes onto an array (well under a millisecond); the address and the
 * User-Agent wait in this process's memory until the flush turns them into a
 * country and a daily visitor hash, and are then dropped. They are never
 * written anywhere.
 *
 * Trace runs one web process (trace-web), so this buffer sees every event;
 * nothing here relies on that, though.
 *
 * A page-load speed report (the beacon's `v`, one per full page load) carries
 * nothing about the visitor, so it skips the hashing and waits up to a minute
 * (or 200 reports) before it is written as one vitals_chunks row: the
 * Speed tab needs no live view, and fewer, bigger writes are cheaper.
 */

export const FLUSH_MS = 5_000;
export const FLUSH_AT = 50;
/** If the store is down, keep at most this many events waiting (oldest dropped first). */
export const MAX_BUFFER = 5_000;
export const MAX_EVENTS_PER_REQUEST = 20;
export const VITALS_FLUSH_MS = 60_000;
export const VITALS_FLUSH_AT = 200;
/** How old an event the browser held on to may be (a tab that queued it and was closed later). */
const MAX_AGE_MS = 10 * 60 * 1000;

export type ParsedEvent = {
  n: KeyEventName;
  p: string;
  r: string;
  ref: string | null;
  us: string | null;
  um: string | null;
  uc: string | null;
  props: EventProps;
  /** How long ago the browser saw it, ms. */
  age: number;
};

export type ParsedBeacon = { sid: string; sw: string | null; swPx: number | null; si: boolean | null; events: ParsedEvent[]; vitals: ParsedVitals | null };

/** The beacon body (lib/analytics/beacon.ts), validated and cleaned. Null when it is not one. */
export function parseBeacon(raw: unknown, ownHosts: readonly string[]): ParsedBeacon | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const sid = typeof body.sid === "string" && /^[a-z0-9]{8,32}$/i.test(body.sid) ? body.sid : null;
  if (!sid || !Array.isArray(body.e)) return null;
  const swPx = typeof body.sw === "number" && Number.isFinite(body.sw) ? Math.round(body.sw) : null;
  const events: ParsedEvent[] = [];
  for (const item of body.e.slice(0, MAX_EVENTS_PER_REQUEST)) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const n = typeof e.n === "string" ? keyEventFor(e.n) : null;
    // Only public pages are counted: the browser sends nothing else, and anything else is dropped here again.
    const p = publicPath(e.p);
    if (!n || !p) continue;
    const utm = e.u && typeof e.u === "object" ? (e.u as Record<string, unknown>) : {};
    const props = cleanProps(n, e.x);
    if (!countsAsEvent(n, props)) continue;
    const age = typeof e.a === "number" && Number.isFinite(e.a) ? Math.min(MAX_AGE_MS, Math.max(0, e.a)) : 0;
    events.push({
      n,
      p,
      r: routeOf(p),
      ref: n === "pageview" ? referrerHost(e.r, ownHosts) : null,
      us: n === "pageview" ? cleanUtm(utm.s) : null,
      um: n === "pageview" ? cleanUtm(utm.m) : null,
      uc: n === "pageview" ? cleanUtm(utm.c) : null,
      props,
      age,
    });
  }
  const si = typeof body.si === "boolean" ? body.si : null;
  return { sid, sw: screenBucket(swPx), swPx, si, events, vitals: parseVitals(body.v, si) };
}

/** `cc`: Cloudflare's country for the request, when it sent one (better than our lookup, and free). */
type Pending = { ns: string; host: string; ip: string; ua: string; cc: string | null; t: number; sid: string; sw: string | null; swPx: number | null; si: boolean | null; e: ParsedEvent };

/** A chunk ready to write: events already hashed, nothing identifying left. Kept as-is until the write lands. */
type Ready = { ns: string; id: string; kind?: undefined; chunk: EventChunk } | { ns: string; id: string; kind: "vitals"; chunk: VitalsChunk };

type IngestState = {
  buffer: Pending[];
  ready: Ready[];
  /** Page-load speed rows waiting for their minute (VITALS_FLUSH_MS). */
  vitals: Array<{ ns: string; row: VitalsRow }>;
  vitalsTimer: ReturnType<typeof setTimeout> | null;
  timer: ReturnType<typeof setTimeout> | null;
  flushing: Promise<void> | null;
  keepers: Map<string, SaltKeeper>;
  failures: number;
  shutdownHooked: boolean;
  spoolRead: boolean;
};

const globalKey = "__traceAnalyticsIngest" as const;
type GlobalWithIngest = typeof globalThis & { [globalKey]?: IngestState };

function state(): IngestState {
  const g = globalThis as GlobalWithIngest;
  if (!g[globalKey]) {
    g[globalKey] = { buffer: [], ready: [], vitals: [], vitalsTimer: null, timer: null, flushing: null, keepers: new Map(), failures: 0, shutdownHooked: false, spoolRead: false };
  }
  return g[globalKey]!;
}

/** Queue a parsed beacon. Never waits on the store. */
export function enqueue(beacon: ParsedBeacon, request: { host: string; ip: string; ua: string; country?: string | null; now?: number }) {
  if (beacon.events.length === 0 && !beacon.vitals) return;
  const s = state();
  hookShutdown(s);
  const now = request.now ?? Date.now();
  const ns = analyticsNamespace(request.host);
  if (beacon.vitals) enqueueVitals(s, ns, { t: now, ...beacon.vitals });
  if (beacon.events.length === 0) return;
  for (const e of beacon.events) {
    s.buffer.push({ ns, host: request.host, ip: request.ip, ua: request.ua, cc: request.country ?? null, t: now - e.age, sid: beacon.sid, sw: beacon.sw, swPx: beacon.swPx, si: beacon.si, e });
  }
  if (s.buffer.length > MAX_BUFFER) s.buffer.splice(0, s.buffer.length - MAX_BUFFER);
  schedule(s.buffer.length >= FLUSH_AT ? 0 : FLUSH_MS);
}

function schedule(delay: number) {
  const s = state();
  if (s.timer && delay > 0) return;
  if (s.timer) clearTimeout(s.timer);
  s.timer = setTimeout(() => {
    s.timer = null;
    void flush();
  }, delay);
  (s.timer as { unref?: () => void }).unref?.();
}

function enqueueVitals(s: IngestState, ns: string, row: VitalsRow) {
  s.vitals.push({ ns, row });
  if (s.vitals.length > MAX_BUFFER) s.vitals.splice(0, s.vitals.length - MAX_BUFFER);
  if (s.vitals.length >= VITALS_FLUSH_AT) {
    readyVitals(s);
    schedule(0);
    return;
  }
  if (s.vitalsTimer) return;
  s.vitalsTimer = setTimeout(() => {
    s.vitalsTimer = null;
    readyVitals(s);
    schedule(0);
  }, VITALS_FLUSH_MS);
  (s.vitalsTimer as { unref?: () => void }).unref?.();
}

export function vitalsChunkId(chunk: VitalsChunk): string {
  const digest = createHash("sha256").update(JSON.stringify(chunk.rows)).digest("hex").slice(0, 20);
  return `v${chunk.first_ts.toString(36)}_${digest}`;
}

/** Waiting speed rows become one ready chunk per namespace. */
function readyVitals(s: IngestState) {
  if (s.vitalsTimer) clearTimeout(s.vitalsTimer);
  s.vitalsTimer = null;
  if (s.vitals.length === 0) return;
  const byNs = new Map<string, VitalsRow[]>();
  for (const { ns, row } of s.vitals.splice(0)) {
    const list = byNs.get(ns) ?? [];
    list.push(row);
    byNs.set(ns, list);
  }
  for (const [ns, rows] of byNs) {
    const chunk = vitalsChunkOf(rows, Date.now());
    s.ready.push({ ns, id: vitalsChunkId(chunk), kind: "vitals", chunk });
  }
}

function keeperFor(ns: string): SaltKeeper {
  const s = state();
  let keeper = s.keepers.get(ns);
  if (!keeper) s.keepers.set(ns, (keeper = new SaltKeeper(analyticsDb().salts(ns))));
  return keeper;
}

/**
 * A chunk's id comes from its content, so writing the same chunk twice (a write
 * that landed but timed out, a spool replayed after a restart) is one document.
 */
export function chunkId(chunk: EventChunk): string {
  const digest = createHash("sha256").update(JSON.stringify(chunk.events)).digest("hex").slice(0, 20);
  return `${chunk.first_ts.toString(36)}_${digest}`;
}

/**
 * Events about a person's record (a newsletter subscription, an account, a
 * checkout or a payment) keep only the minute and no session id, so they can't
 * be lined up against the records' exact times or tied to a visit's pages.
 */
export const ACCOUNT_EVENTS: ReadonlySet<KeyEventName> = new Set<KeyEventName>([
  "newsletter_signup",
  "signin_completed",
  "signup_completed",
  "onboarded",
  "checkout_started",
  "purchase_completed",
]);

function storedEvent(item: Pending, salt: string): StoredEvent {
  const e = item.e;
  const account = ACCOUNT_EVENTS.has(e.n);
  const stored: StoredEvent = {
    t: account ? Math.floor(item.t / 60_000) * 60_000 : item.t,
    n: e.n,
    sid: account ? "" : item.sid,
    vid: visitorHash(salt, item.host, item.ip, item.ua),
    p: e.p,
    r: e.r,
    si: item.si,
    ...e.props,
  };
  if (e.n === "pageview") {
    stored.ref = e.ref;
    stored.us = e.us;
    stored.um = e.um;
    stored.uc = e.uc;
    stored.dev = deviceClass(item.ua, item.swPx);
    stored.br = browserFamily(item.ua);
    stored.sw = item.sw;
    stored.cc = item.cc ?? countryOf(item.ip);
  }
  return stored;
}

/** Turn queued events into stored ones: country and visitor hash in, address and User-Agent out. */
export async function toStored(items: readonly Pending[]): Promise<StoredEvent[]> {
  await ensureGeo();
  const out: StoredEvent[] = [];
  for (const item of items) out.push(storedEvent(item, await keeperFor(item.ns).saltFor(item.t)));
  return out;
}

export function chunkOf(events: StoredEvent[], now: number): EventChunk {
  const ts = events.map((e) => e.t);
  return {
    days: Array.from(new Set(events.map((e) => utcDay(e.t)))).sort(),
    first_ts: Math.min(...ts),
    last_ts: Math.max(...ts),
    count: events.length,
    events,
    created_at: new Date(now).toISOString(),
  };
}

/** Hash what is queued into ready chunks (one per namespace). On a failure (the salt could not be read) the events wait. */
async function prepare(s: IngestState): Promise<void> {
  if (s.buffer.length === 0) return;
  const taken = s.buffer.splice(0, 1000);
  const byNs = new Map<string, Pending[]>();
  for (const item of taken) {
    const list = byNs.get(item.ns) ?? [];
    list.push(item);
    byNs.set(item.ns, list);
  }
  for (const [ns, items] of byNs) {
    try {
      const chunk = chunkOf(await toStored(items), Date.now());
      s.ready.push({ ns, id: chunkId(chunk), chunk });
    } catch (error) {
      s.failures += 1;
      s.buffer.unshift(...items);
      if (s.buffer.length > MAX_BUFFER) s.buffer.splice(0, s.buffer.length - MAX_BUFFER);
      if (s.failures === 1 || s.failures % 20 === 0) console.warn(`[analytics] could not prepare events (${s.failures}x):`, (error as Error)?.message);
    }
  }
}

/** Write everything queued. Safe to call any time; one flush runs at a time. */
export async function flush(): Promise<void> {
  const s = state();
  if (s.flushing) return s.flushing;
  readSpool(s);
  if (s.buffer.length === 0 && s.ready.length === 0) return;
  s.flushing = (async () => {
    await prepare(s);
    // In order, but a kind whose write failed waits for the next round without holding up the other kind:
    // a broken vitals collection must never stop the visitor events (and the other way round).
    const failed = new Set<string>();
    for (const next of [...s.ready]) {
      const kind = next.kind ?? "events";
      if (failed.has(kind)) continue;
      try {
        if (next.kind === "vitals") await speedDb().writeVitals(next.ns, next.id, next.chunk);
        else await analyticsDb().writeChunk(next.ns, next.id, next.chunk);
        const at = s.ready.indexOf(next);
        if (at >= 0) s.ready.splice(at, 1);
        maybePrune(next.ns, kind);
      } catch (error) {
        // Kept as it is (same id), so the retry can't double count; say what failed, never what was in it.
        failed.add(kind);
        s.failures += 1;
        if (s.failures === 1 || s.failures % 20 === 0) console.warn(`[analytics] ${kind} flush failed (${s.failures}x):`, (error as Error)?.message);
      }
    }
    if (failed.size === 0) s.failures = 0;
    // A long outage: keep the newest chunks within the cap, counted per kind so one kind's backlog never pushes out the other's.
    for (const kind of ["events", "vitals"] as const) {
      const mine = s.ready.filter((r) => (r.kind ?? "events") === kind);
      if (mine.reduce((n, r) => n + r.chunk.count, 0) <= MAX_BUFFER) continue;
      const drop = new Set(mine.slice(0, Math.max(1, Math.floor(mine.length / 4))));
      s.ready = s.ready.filter((r) => !drop.has(r));
    }
  })().finally(() => {
    s.flushing = null;
    // More arrived meanwhile, or a failure is waiting: back off up to a minute.
    const waiting = s.buffer.length + s.ready.length;
    if (waiting > 0) schedule(s.failures > 0 ? Math.min(60_000, FLUSH_MS * 2 ** Math.min(4, s.failures)) : s.buffer.length >= FLUSH_AT ? 0 : FLUSH_MS);
  });
  return s.flushing;
}

/* ── retention: raw chunks go a few days after their day is final ───────── */

const PRUNE_EVERY_MS = 6 * 60 * 60 * 1000;
const pruneKey = "__traceAnalyticsPrunedAt" as const;
type GlobalWithPrune = typeof globalThis & { [pruneKey]?: Map<string, number> };

function maybePrune(ns: string, kind: "events" | "vitals") {
  const g = globalThis as GlobalWithPrune;
  const last = (g[pruneKey] ??= new Map());
  const now = Date.now();
  const key = kind === "vitals" ? `${ns}:vitals` : ns;
  if (now - (last.get(key) ?? 0) < PRUNE_EVERY_MS) return;
  last.set(key, now);
  const prune = kind === "vitals" ? pruneVitalsChunks : pruneRawChunks;
  void prune(ns, now).catch((error) => console.warn(`[analytics] raw ${kind} clean-up failed:`, (error as Error)?.message));
}

/* ── shutdown: a rolling restart must not drop the last few seconds ─────── */

function spoolDir(): string {
  return process.env.TRACE_ANALYTICS_DIR?.trim() ? analyticsDir() : os.tmpdir();
}

function spoolPrefix(): string {
  return `trace-analytics-spool-${(process.env.PORT || "dev").replace(/[^0-9a-z]/gi, "")}-`;
}

/**
 * On SIGTERM/SIGINT, write what is waiting to a small local file, synchronously
 * (Next exits straight after its own signal handler, so nothing async would
 * finish). Only hashed, ready-to-store events go in it: queued events whose
 * day's salt is not in memory are dropped rather than spooled with an address.
 * The next process on the same port writes it and deletes the file.
 */
export function spoolNow(s: IngestState = state()) {
  try {
    readyVitals(s);
    const ready = [...s.ready];
    const byNs = new Map<string, StoredEvent[]>();
    for (const item of s.buffer) {
      const salt = s.keepers.get(item.ns)?.cachedSaltFor(item.t);
      if (!salt) continue;
      const list = byNs.get(item.ns) ?? [];
      list.push(storedEvent(item, salt));
      byNs.set(item.ns, list);
    }
    for (const [ns, events] of byNs) {
      const chunk = chunkOf(events, Date.now());
      ready.push({ ns, id: chunkId(chunk), chunk });
    }
    s.buffer = [];
    s.ready = [];
    if (ready.length === 0) return;
    const file = path.join(spoolDir(), `${spoolPrefix()}${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(ready), { mode: 0o600 });
  } catch {
    // shutting down: nothing more to do
  }
}

function hookShutdown(s: IngestState) {
  if (s.shutdownHooked || typeof process === "undefined" || typeof process.prependListener !== "function") return;
  s.shutdownHooked = true;
  // prepend: Next's own handlers call process.exit, so ours must run first.
  process.prependListener("SIGTERM", () => spoolNow());
  process.prependListener("SIGINT", () => spoolNow());
}

/** Pick up what an earlier process on this port spooled at shutdown. Once per process. */
function readSpool(s: IngestState) {
  if (s.spoolRead) return;
  s.spoolRead = true;
  try {
    const dir = spoolDir();
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith(spoolPrefix()) || !name.endsWith(".json")) continue;
      const file = path.join(dir, name);
      try {
        const items = JSON.parse(fs.readFileSync(file, "utf8")) as Ready[];
        for (const item of Array.isArray(items) ? items : []) {
          if (!item || typeof item.ns !== "string" || !(NAMESPACES as readonly string[]).includes(item.ns) || typeof item.id !== "string" || !item.chunk) continue;
          if (item.kind === "vitals" ? Array.isArray(item.chunk.rows) : item.kind === undefined && Array.isArray(item.chunk.events)) s.ready.push(item);
        }
      } catch {
        // a torn file: dropped
      }
      fs.rmSync(file, { force: true });
    }
  } catch {
    // no spool folder: nothing to pick up
  }
}

/** Tests only: what is waiting, and a clean slate. */
export function ingestStateForTests() {
  return state();
}

export function resetIngestForTests() {
  const s = state();
  if (s.timer) clearTimeout(s.timer);
  if (s.vitalsTimer) clearTimeout(s.vitalsTimer);
  s.buffer = [];
  s.ready = [];
  s.vitals = [];
  s.vitalsTimer = null;
  s.spoolRead = true;
  s.timer = null;
  s.flushing = null;
  s.keepers = new Map();
  s.failures = 0;
}
