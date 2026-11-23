import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * The analytics database: Node's built-in SQLite, one file per namespace in TRACE_ANALYTICS_DIR (the service's
 * private /var/lib/trace-web-analytics in production; a temp folder elsewhere). "production" holds the live
 * site's numbers; everything else (next dev, a preview host) writes "development", so test traffic never lands
 * in the owner's numbers.
 *
 *   event_chunks    raw events, one row per flush (lib/analytics/ingest.ts), deleted 5 days after their day
 *                   once that day's rollup is final (lib/analytics/retention.ts)
 *   daily           one rollup per UTC day (lib/analytics/rollup.ts DayRollup, as JSON)
 *   vitals_chunks   raw page-load timings, kept like event_chunks
 *   speed_daily     one speed rollup per UTC day (lib/analytics/speed.ts SpeedDay, as JSON)
 *   salt            the day's visitor-hash salt; earlier days' are deleted
 *
 * The first version's tables (totals, timings, seen) stay as they were. Nothing writes to them any more; the
 * dashboard reads totals and timings for its history (lib/analytics/legacy.ts), and seen rows (daily visitor
 * hashes) are deleted after five days as before.
 *
 * One web process (trace-web) owns the files, so every call is synchronous and short; reads are capped by the
 * callers.
 */

export const PROD_NAMESPACE = "production";
export const DEV_NAMESPACE = "development";
export const NAMESPACES = [PROD_NAMESPACE, DEV_NAMESPACE] as const;
export type Namespace = (typeof NAMESPACES)[number];

const SCHEMA = `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=1500;
  CREATE TABLE IF NOT EXISTS salt(day TEXT PRIMARY KEY, key TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS seen(day TEXT, visitor TEXT, last INTEGER, PRIMARY KEY(day, visitor));
  CREATE INDEX IF NOT EXISTS seen_last ON seen(last);
  CREATE TABLE IF NOT EXISTS totals(day TEXT, kind TEXT, label TEXT, n INTEGER, PRIMARY KEY(day, kind, label));
  CREATE TABLE IF NOT EXISTS timings(day TEXT, metric TEXT, value INTEGER, n INTEGER, PRIMARY KEY(day, metric, value));
  CREATE TABLE IF NOT EXISTS event_chunks(id TEXT PRIMARY KEY, first_day TEXT NOT NULL, last_day TEXT NOT NULL,
    first_ts INTEGER NOT NULL, last_ts INTEGER NOT NULL, count INTEGER NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS event_chunks_day ON event_chunks(last_day, first_day);
  CREATE INDEX IF NOT EXISTS event_chunks_last ON event_chunks(last_ts);
  CREATE INDEX IF NOT EXISTS event_chunks_order ON event_chunks(first_ts, id);
  CREATE TABLE IF NOT EXISTS daily(day TEXT PRIMARY KEY, body TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS vitals_chunks(id TEXT PRIMARY KEY, first_day TEXT NOT NULL, last_day TEXT NOT NULL,
    first_ts INTEGER NOT NULL, last_ts INTEGER NOT NULL, count INTEGER NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS vitals_chunks_day ON vitals_chunks(last_day, first_day);
  CREATE INDEX IF NOT EXISTS vitals_chunks_last ON vitals_chunks(last_ts);
  CREATE INDEX IF NOT EXISTS vitals_chunks_order ON vitals_chunks(first_ts, id);
  CREATE TABLE IF NOT EXISTS speed_daily(day TEXT PRIMARY KEY, body TEXT NOT NULL);`;

const globalKey = "__traceAnalyticsDb" as const;
type GlobalWithDb = typeof globalThis & { [globalKey]?: Map<string, DatabaseSync> };

export function analyticsDir(): string {
  return process.env.TRACE_ANALYTICS_DIR?.trim() || join(tmpdir(), "trace-web-analytics");
}

/** The open database for a namespace, made on first use. */
export function sqlite(ns: string): DatabaseSync {
  if (!(NAMESPACES as readonly string[]).includes(ns)) throw new Error("unknown analytics namespace");
  const g = globalThis as GlobalWithDb;
  const open = (g[globalKey] ??= new Map());
  const existing = open.get(ns);
  if (existing) return existing;
  const dir = analyticsDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dir, `${ns}.sqlite`));
  db.exec(SCHEMA);
  open.set(ns, db);
  return db;
}

/** Run `work` in one write transaction. */
export function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = work();
    db.exec("COMMIT");
    return out;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * The first version's privacy rules, kept, hourly (instrumentation.ts): earlier days' salts go (so old visitor ids
 * can never be recomputed), and the old daily visitor hashes after five days.
 */
export function maintain(now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  for (const ns of NAMESPACES) {
    const db = sqlite(ns);
    db.prepare("DELETE FROM salt WHERE day < ?").run(today);
    db.prepare("DELETE FROM seen WHERE last < ?").run(now - 5 * 86_400_000);
  }
}

/** Tests only: close every open file, so the next call opens TRACE_ANALYTICS_DIR afresh. */
export function closeAnalyticsForTests() {
  const g = globalThis as GlobalWithDb;
  for (const db of g[globalKey]?.values() ?? []) db.close();
  g[globalKey]?.clear();
}
