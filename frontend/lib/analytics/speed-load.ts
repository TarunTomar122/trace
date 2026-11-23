import { dayStart, FINAL_AFTER_MS } from "./dashboard.ts";
import { legacySpeedCell } from "./legacy.ts";
import { buildSpeed, rollupSpeedDay, TREND_DAYS, type DeviceFilter, type SpeedCell, type SpeedDay, type SpeedRange, type SpeedView } from "./speed.ts";
import { speedDb } from "./speed-db.ts";
import { utcDay } from "./visitor.ts";

/**
 * Loading the Speed tab: finished days are read as one stored rollup each (and kept in memory for the life of
 * the process); today and the last two days are folded from their raw chunks on each load, so late beacons still
 * count, and stored once final, exactly like the visitor rollups (lib/analytics/dashboard.ts loadRollups). The
 * first version's whole-site timings ride along on the days it kept (lib/analytics/legacy.ts).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_MS = 60 * 1000;
const MAX_FINAL = 120;

type CacheState = {
  final: Map<string, SpeedDay>;
  legacy: Map<string, SpeedCell | null>;
  /** Days still open, folded from raw rows: one fold per day shared by every range and device, for CACHE_MS. */
  open: Map<string, { at: number; value: Promise<SpeedDay> }>;
  answers: Map<string, { at: number; value: Promise<SpeedView> }>;
};

const globalKey = "__traceAnalyticsSpeed" as const;
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

/** The last `count` UTC days, oldest first, today last. */
export function lastDays(count: number, now: number): string[] {
  const today = dayStart(utcDay(now));
  return Array.from({ length: count }, (_, i) => utcDay(today - (count - 1 - i) * DAY_MS));
}

/** One day folded from its raw rows, shared while in flight and for CACHE_MS; never final when the read was capped. */
function foldDay(ns: string, day: string, now: number): Promise<SpeedDay> {
  const c = cache();
  const key = `${ns}:${day}`;
  const hit = c.open.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.value;
  for (const [k, entry] of c.open) if (now - entry.at >= CACHE_MS) c.open.delete(k);
  const value = (async () => {
    const final = now >= dayStart(day) + DAY_MS + FINAL_AFTER_MS;
    const { chunks, capped } = await speedDb().vitalsForDay(ns, day);
    return rollupSpeedDay(day, chunks.flatMap((chunk) => chunk.rows), { complete: final && !capped, now });
  })();
  c.open.set(key, { at: now, value });
  value.catch(() => {
    if (c.open.get(key)?.value === value) c.open.delete(key);
  });
  return value;
}

export async function loadSpeedDays(ns: string, days: readonly string[], now: number): Promise<SpeedDay[]> {
  const c = cache();
  const db = speedDb();
  const key = (day: string) => `${ns}:${day}`;
  const missing = days.filter((day) => !c.final.has(key(day)));
  const stored = missing.length > 0 ? await db.readSpeed(ns, missing) : new Map<string, SpeedDay>();
  const fresh = new Map<string, SpeedDay>();
  const finished: SpeedDay[] = [];
  for (const day of missing) {
    const rollup = stored.get(day);
    if (rollup?.complete) {
      remember(c.final, key(day), rollup);
      continue;
    }
    // One day at a time: on a first load after a long gap this is up to 14 small reads.
    const folded = await foldDay(ns, day, now);
    fresh.set(day, folded);
    if (folded.complete) finished.push(folded);
  }
  for (const day of finished) remember(c.final, key(day.day), day);
  if (finished.length > 0) await db.writeSpeed(ns, finished).catch((error) => console.warn("[analytics] speed rollup write failed:", (error as Error)?.message));
  return days.map((day) => c.final.get(key(day)) ?? fresh.get(day)!);
}

/** The speed rollups with the first version's whole-site timings attached (never stored with them). */
async function withLegacy(ns: string, days: SpeedDay[], now: number): Promise<SpeedDay[]> {
  const c = cache();
  const key = (day: string) => `${ns}:${day}`;
  const todayDay = utcDay(now);
  const missing = days.map((d) => d.day).filter((day) => !c.legacy.has(key(day)));
  const fresh = new Map<string, SpeedCell | null>();
  if (missing.length > 0) {
    const rows = await speedDb().legacyTimings(ns, missing);
    for (const day of missing) {
      const entry = rows.get(day);
      const cell = entry ? legacySpeedCell(entry.loads, entry.rows) : null;
      if (day < todayDay) remember(c.legacy, key(day), cell);
      fresh.set(day, cell);
    }
  }
  return days.map((day) => {
    const legacy = fresh.has(day.day) ? fresh.get(day.day) : c.legacy.get(key(day.day));
    return legacy ? { ...day, legacy } : day;
  });
}

export function loadSpeed(ns: string, range: SpeedRange, device: DeviceFilter, now = Date.now()): Promise<SpeedView> {
  const c = cache();
  const cacheKey = `${ns}:${range}:${device}`;
  const hit = c.answers.get(cacheKey);
  if (hit && now - hit.at < CACHE_MS) return hit.value;
  const value = (async () => {
    const days = await withLegacy(ns, await loadSpeedDays(ns, lastDays(TREND_DAYS, now), now), now);
    return buildSpeed({ days, range, device, now });
  })();
  c.answers.set(cacheKey, { at: now, value });
  value.catch(() => {
    if (c.answers.get(cacheKey)?.value === value) c.answers.delete(cacheKey);
  });
  return value;
}

/** Tests only. */
export function resetSpeedCacheForTests() {
  const g = globalThis as GlobalWithCache;
  delete g[globalKey];
}
