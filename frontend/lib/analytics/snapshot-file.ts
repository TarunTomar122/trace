import { readFile, stat } from "node:fs/promises";

/**
 * The admin snapshot (backend/vps/trace-analytics-snapshot.py writes it every 5 minutes, root:trace-web 0640).
 * It carries the Signups list with full emails, so only the admin page reads it, after the cookie check.
 * TRACE_ANALYTICS_SNAPSHOT points it at a local copy for development.
 *
 * Parsed once per file version: a request that finds the same size and modification time reuses the last parse.
 */

export const DEFAULT_SNAPSHOT_PATH = "/var/lib/trace-analytics-snapshot/latest.json";

export function snapshotPath(): string {
  return process.env.TRACE_ANALYTICS_SNAPSHOT?.trim() || DEFAULT_SNAPSHOT_PATH;
}

type Cached = { path: string; mtimeMs: number; size: number; value: Record<string, unknown> };
const globalKey = "__traceAdminSnapshot" as const;
type GlobalWithSnapshot = typeof globalThis & { [globalKey]?: Cached };

export async function readSnapshotFile(): Promise<Record<string, unknown> | null> {
  const path = snapshotPath();
  const g = globalThis as GlobalWithSnapshot;
  try {
    const info = await stat(path);
    const hit = g[globalKey];
    if (hit && hit.path === path && hit.mtimeMs === info.mtimeMs && hit.size === info.size) return hit.value;
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    g[globalKey] = { path, mtimeMs: info.mtimeMs, size: info.size, value: value as Record<string, unknown> };
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}
