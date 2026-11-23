import { daysBetween, inList, MAX_DAY_EVENTS, readChunks, type ChunkRead } from "./db.ts";
import type { LegacyTiming } from "./legacy.ts";
import type { SpeedDay, VitalsChunk } from "./speed.ts";
import { sqlite, transaction } from "./store.ts";

/**
 * Where real-user page speed lives, next to the rest of the analytics in the same SQLite file and namespace
 * (lib/analytics/store.ts):
 *
 *   vitals_chunks   one chunk of raw page-load rows per flush (lib/analytics/ingest.ts),
 *                   deleted RAW_KEEP_DAYS after their day once that day's speed rollup is final
 *   speed_daily     one rollup per UTC day: histograms per route, device and metric (lib/analytics/speed.ts)
 */

export type SpeedDb = {
  writeVitals(ns: string, id: string, chunk: VitalsChunk): Promise<void>;
  /** A day's raw chunks; `capped` when there were more than MAX_DAY_EVENTS rows (the day then never becomes final). */
  vitalsForDay(ns: string, day: string): Promise<ChunkRead<VitalsChunk>>;
  /** Ids and days of raw chunks whose newest row is before `beforeMs`. */
  oldVitals(ns: string, beforeMs: number): Promise<Array<{ id: string; days: string[] }>>;
  deleteVitals(ns: string, ids: readonly string[]): Promise<void>;
  readSpeed(ns: string, days: readonly string[]): Promise<Map<string, SpeedDay>>;
  writeSpeed(ns: string, days: readonly SpeedDay[]): Promise<void>;
  /** The first version's timings and measured loads for these days (lib/analytics/legacy.ts). */
  legacyTimings(ns: string, days: readonly string[]): Promise<Map<string, { loads: number; rows: LegacyTiming[] }>>;
};

function parseChunk(body: string): VitalsChunk | null {
  try {
    const data = JSON.parse(body) as VitalsChunk;
    return data && Array.isArray(data.rows) ? data : null;
  } catch {
    return null;
  }
}

function parseDay(body: string): SpeedDay | null {
  try {
    const data = JSON.parse(body) as SpeedDay;
    return data && typeof data.day === "string" && data.routes && typeof data.routes === "object" ? data : null;
  } catch {
    return null;
  }
}

const sqliteSpeedDb: SpeedDb = {
  async writeVitals(ns, id, chunk) {
    sqlite(ns)
      .prepare("INSERT OR REPLACE INTO vitals_chunks VALUES(?,?,?,?,?,?,?,?)")
      .run(id, chunk.days[0] ?? "", chunk.days[chunk.days.length - 1] ?? "", chunk.first_ts, chunk.last_ts, chunk.count, JSON.stringify(chunk), chunk.created_at);
  },

  async vitalsForDay(ns, day) {
    return readChunks(ns, "vitals_chunks", "first_day <= ? AND last_day >= ?", [day, day], MAX_DAY_EVENTS, parseChunk);
  },

  async oldVitals(ns, beforeMs) {
    const rows = sqlite(ns).prepare("SELECT id, first_day, last_day FROM vitals_chunks WHERE last_ts < ? LIMIT 5000").all(beforeMs);
    return rows.map((row) => ({ id: String(row.id), days: daysBetween(String(row.first_day), String(row.last_day)) }));
  },

  async deleteVitals(ns, ids) {
    const db = sqlite(ns);
    const remove = db.prepare("DELETE FROM vitals_chunks WHERE id = ?");
    transaction(db, () => {
      for (const id of ids) remove.run(id);
    });
  },

  async readSpeed(ns, days) {
    const out = new Map<string, SpeedDay>();
    for (let i = 0; i < days.length; i += 200) {
      const part = days.slice(i, i + 200);
      for (const row of sqlite(ns).prepare(`SELECT day, body FROM speed_daily WHERE day IN (${inList(part.length)})`).all(...part)) {
        const day = parseDay(String(row.body));
        if (day) out.set(String(row.day), day);
      }
    }
    return out;
  },

  async writeSpeed(ns, days) {
    if (days.length === 0) return;
    const db = sqlite(ns);
    const put = db.prepare("INSERT OR REPLACE INTO speed_daily VALUES(?,?)");
    transaction(db, () => {
      // The first version's timings are added when a day is read, never stored with it.
      for (const day of days) put.run(day.day, JSON.stringify({ ...day, legacy: undefined }));
    });
  },

  async legacyTimings(ns, days) {
    const out = new Map<string, { loads: number; rows: LegacyTiming[] }>();
    const db = sqlite(ns);
    for (let i = 0; i < days.length; i += 200) {
      const part = days.slice(i, i + 200);
      for (const row of db.prepare(`SELECT day, metric, value, n FROM timings WHERE day IN (${inList(part.length)})`).all(...part)) {
        const day = String(row.day);
        const entry = out.get(day) ?? { loads: 0, rows: [] };
        entry.rows.push({ metric: String(row.metric), value: Number(row.value), n: Number(row.n) || 0 });
        out.set(day, entry);
      }
      for (const row of db.prepare(`SELECT day, n FROM totals WHERE kind='loads' AND label='all' AND day IN (${inList(part.length)})`).all(...part)) {
        const day = String(row.day);
        const entry = out.get(day) ?? { loads: 0, rows: [] };
        entry.loads = Number(row.n) || 0;
        out.set(day, entry);
      }
    }
    return out;
  },
};

export function speedDb(): SpeedDb {
  return sqliteSpeedDb;
}
