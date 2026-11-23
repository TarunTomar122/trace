import { PRODUCTION_HOSTS } from "./normalize.ts";
import type { DayRollup, EventChunk } from "./rollup.ts";
import type { LegacyTotal } from "./legacy.ts";
import { DEV_NAMESPACE, PROD_NAMESPACE, sqlite, transaction } from "./store.ts";
import type { SaltStore } from "./visitor.ts";

/**
 * The analytics store's interface (the shape StocksBrew's LocalDB version has), over the SQLite file of
 * lib/analytics/store.ts. Every method is synchronous underneath; they return promises so the dashboard and
 * ingest code reads the same as it does there.
 */

/** Only the live site writes "production"; next dev and any preview host write "development". */
export function analyticsNamespace(host: string | null | undefined, nodeEnv: string | undefined = process.env.NODE_ENV): string {
  const name = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  return nodeEnv === "production" && PRODUCTION_HOSTS.includes(name) ? PROD_NAMESPACE : DEV_NAMESPACE;
}

/**
 * At most this many raw events are read for one day (the oldest first). Trace sees a few thousand a day; the cap
 * keeps a runaway day from filling the 512 MB the web service has.
 */
export const MAX_DAY_EVENTS = 50_000;
/** At most this many raw events for the live view (the last five minutes). */
export const MAX_LIVE_EVENTS = 5_000;

export type AnalyticsDb = {
  writeChunk(ns: string, id: string, chunk: EventChunk): Promise<void>;
  salts(ns: string): SaltStore;
  /** A day's raw chunks; `capped` when there were more than MAX_DAY_EVENTS (the day then never becomes final). */
  chunksForDay(ns: string, day: string): Promise<ChunkRead<EventChunk>>;
  chunksSince(ns: string, sinceMs: number): Promise<EventChunk[]>;
  /** Ids and days of raw chunks whose newest event is before `beforeMs`. */
  oldChunks(ns: string, beforeMs: number): Promise<Array<{ id: string; days: string[] }>>;
  deleteChunks(ns: string, ids: readonly string[]): Promise<void>;
  readRollups(ns: string, days: readonly string[]): Promise<Map<string, DayRollup>>;
  writeRollups(ns: string, rollups: readonly DayRollup[]): Promise<void>;
  /** The first version's daily totals for these days (lib/analytics/legacy.ts). */
  legacyTotals(ns: string, days: readonly string[]): Promise<Map<string, LegacyTotal[]>>;
};

/** Days a chunk touches, from its first and last day (a chunk is a few seconds, or a spool of a few minutes). */
export function daysBetween(first: string, last: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${first}T00:00:00Z`), end = Date.parse(`${last}T00:00:00Z`); t <= end && out.length < 32; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out.length > 0 ? out : [first];
}

/** What a capped read returns: the chunks, and whether it stopped at the cap (so the day can't be final). */
export type ChunkRead<T> = { chunks: T[]; capped: boolean };

/**
 * Raw chunk bodies from `table` matching `where`, oldest first, stopped once `cap` events are in hand. The ids and
 * counts are read first (small rows, ordered by the (first_ts, id) index), then the bodies 100 at a time by id,
 * so no sort ever carries a body.
 */
export function readChunks<T>(ns: string, table: "event_chunks" | "vitals_chunks", where: string, args: Array<string | number>, cap: number, parse: (body: string) => T | null): ChunkRead<T> {
  const db = sqlite(ns);
  const index = db.prepare(`SELECT id, count FROM ${table} WHERE ${where} ORDER BY first_ts, id`).all(...args);
  const ids: string[] = [];
  let seen = 0;
  let capped = false;
  for (const row of index) {
    if (seen >= cap) {
      capped = true;
      break;
    }
    ids.push(String(row.id));
    seen += Number(row.count) || 0;
  }
  const chunks: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    const bodies = new Map(db.prepare(`SELECT id, body FROM ${table} WHERE id IN (${inList(part.length)})`).all(...part).map((row) => [String(row.id), String(row.body)]));
    for (const id of part) {
      const body = bodies.get(id);
      const chunk = body == null ? null : parse(body);
      if (chunk) chunks.push(chunk);
    }
  }
  if (capped) console.warn(`[analytics] ${table} read stopped at ${cap} rows; the day stays open`);
  return { chunks, capped };
}

function parseChunk(body: string): EventChunk | null {
  try {
    const data = JSON.parse(body) as EventChunk;
    return data && Array.isArray(data.events) ? data : null;
  } catch {
    return null;
  }
}

function parseRollup(body: string): DayRollup | null {
  try {
    const data = JSON.parse(body) as DayRollup;
    return data && typeof data.day === "string" && Array.isArray(data.hours) ? data : null;
  } catch {
    return null;
  }
}

export function inList(count: number): string {
  return Array.from({ length: count }, () => "?").join(",");
}

const sqliteDb: AnalyticsDb = {
  async writeChunk(ns, id, chunk) {
    // Same id, same content (ingest makes it from a hash): a retried write replaces, never doubles.
    sqlite(ns)
      .prepare("INSERT OR REPLACE INTO event_chunks VALUES(?,?,?,?,?,?,?,?)")
      .run(id, chunk.days[0] ?? "", chunk.days[chunk.days.length - 1] ?? "", chunk.first_ts, chunk.last_ts, chunk.count, JSON.stringify(chunk), chunk.created_at);
  },

  salts(ns) {
    return {
      async read(day) {
        const salt = sqlite(ns).prepare("SELECT key FROM salt WHERE day=?").get(day)?.key;
        return typeof salt === "string" && salt.length >= 32 ? salt : null;
      },
      async create(day, salt) {
        return Number(sqlite(ns).prepare("INSERT OR IGNORE INTO salt VALUES(?,?)").run(day, salt).changes) > 0;
      },
      async removeBefore(day) {
        sqlite(ns).prepare("DELETE FROM salt WHERE day < ?").run(day);
      },
    };
  },

  async chunksForDay(ns, day) {
    return readChunks(ns, "event_chunks", "first_day <= ? AND last_day >= ?", [day, day], MAX_DAY_EVENTS, parseChunk);
  },

  async chunksSince(ns, sinceMs) {
    return readChunks(ns, "event_chunks", "last_ts >= ?", [sinceMs], MAX_LIVE_EVENTS, parseChunk).chunks;
  },

  async oldChunks(ns, beforeMs) {
    const rows = sqlite(ns).prepare("SELECT id, first_day, last_day FROM event_chunks WHERE last_ts < ? LIMIT 5000").all(beforeMs);
    return rows.map((row) => ({ id: String(row.id), days: daysBetween(String(row.first_day), String(row.last_day)) }));
  },

  async deleteChunks(ns, ids) {
    const db = sqlite(ns);
    const remove = db.prepare("DELETE FROM event_chunks WHERE id = ?");
    transaction(db, () => {
      for (const id of ids) remove.run(id);
    });
  },

  async readRollups(ns, days) {
    const out = new Map<string, DayRollup>();
    for (let i = 0; i < days.length; i += 200) {
      const part = days.slice(i, i + 200);
      const rows = sqlite(ns).prepare(`SELECT day, body FROM daily WHERE day IN (${inList(part.length)})`).all(...part);
      for (const row of rows) {
        const rollup = parseRollup(String(row.body));
        if (rollup) out.set(String(row.day), rollup);
      }
    }
    return out;
  },

  async writeRollups(ns, rollups) {
    if (rollups.length === 0) return;
    const db = sqlite(ns);
    const put = db.prepare("INSERT OR REPLACE INTO daily VALUES(?,?)");
    transaction(db, () => {
      for (const rollup of rollups) put.run(rollup.day, JSON.stringify(rollup));
    });
  },

  async legacyTotals(ns, days) {
    const out = new Map<string, LegacyTotal[]>();
    for (let i = 0; i < days.length; i += 200) {
      const part = days.slice(i, i + 200);
      const rows = sqlite(ns).prepare(`SELECT day, kind, label, n FROM totals WHERE day IN (${inList(part.length)}) AND kind IN ('visitors','page','source','country','device')`).all(...part);
      for (const row of rows) {
        const day = String(row.day);
        const list = out.get(day) ?? [];
        list.push({ kind: String(row.kind), label: String(row.label), n: Number(row.n) || 0 });
        out.set(day, list);
      }
    }
    return out;
  },
};

export function analyticsDb(): AnalyticsDb {
  return sqliteDb;
}
