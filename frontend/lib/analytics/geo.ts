import { promises as fs } from "fs";

import { MmdbReader } from "./mmdb.ts";

/**
 * Country lookup for the first-party analytics, from db-ip.com's "IP to
 * Country Lite" database (CC BY 4.0, credited on /admin/analytics). The file is
 * downloaded on the VPS by backend/agentdata/geo_db.py into /srv/tikrr-data/geo/
 * and read here once into memory (about 8.5 MB). The monthly refresh needs no
 * restart: the file's mtime is checked at most once an hour and a newer file is
 * read again. With no file (a laptop), every lookup is null and nothing breaks.
 */

export const DEFAULT_GEO_MMDB_PATH = "/srv/tikrr-data/geo/dbip-country-lite.mmdb";
const RECHECK_MS = 60 * 60 * 1000;

type GeoState = {
  reader: MmdbReader | null;
  mtimeMs: number;
  checkedAt: number;
  loading: Promise<void> | null;
};

const globalKey = "__sbAnalyticsGeo" as const;
type GlobalWithGeo = typeof globalThis & { [globalKey]?: GeoState };

function state(): GeoState {
  const g = globalThis as GlobalWithGeo;
  if (!g[globalKey]) g[globalKey] = { reader: null, mtimeMs: 0, checkedAt: 0, loading: null };
  return g[globalKey]!;
}

function geoPath(): string {
  return process.env.GEO_MMDB_PATH?.trim() || DEFAULT_GEO_MMDB_PATH;
}

async function refresh(s: GeoState, now: number): Promise<void> {
  s.checkedAt = now;
  try {
    const path = geoPath();
    const stat = await fs.stat(/* turbopackIgnore: true */ path);
    if (s.reader && stat.mtimeMs === s.mtimeMs) return;
    const buf = await fs.readFile(/* turbopackIgnore: true */ path);
    s.reader = new MmdbReader(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    s.mtimeMs = stat.mtimeMs;
  } catch (error) {
    // No file, or a bad one: keep whatever was loaded before. The path is ours, never a visitor's.
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") console.warn("[analytics] geo database not loaded:", (error as Error)?.message);
  }
}

/** Make sure the database is loaded (or known to be missing). Cheap after the first call. */
export async function ensureGeo(now = Date.now()): Promise<void> {
  const s = state();
  if (s.loading) return s.loading;
  if (s.checkedAt && now - s.checkedAt < RECHECK_MS) return;
  s.loading = refresh(s, now).finally(() => {
    s.loading = null;
  });
  return s.loading;
}

/** The visitor's country ("US"), or null when unknown. Call ensureGeo() first; this never waits. */
export function countryOf(ip: string | null | undefined): string | null {
  if (!ip) return null;
  try {
    return state().reader?.country(ip) ?? null;
  } catch {
    return null;
  }
}
