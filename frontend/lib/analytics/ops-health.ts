import { readSnapshotFile } from "./snapshot-file.ts";

/**
 * Trace's health for the owner's System tab (/admin/analytics?tab=system).
 *
 * backend/vps/trace-analytics-snapshot.py runs every 5 minutes on the VPS and puts `ops` into the admin snapshot,
 * in the shape of StocksBrew's tm_ops_health documents (this is a port of StocksBrew's lib/ops-health.ts):
 *
 *   ops.latest    the last run in full: checks (Trace's web app, its LocalDB, the daily brief, the pipeline,
 *                 the box), the box numbers (copied from StocksBrew's own run, so both tabs agree), services'
 *                 memory, traffic from Trace's Caddy log when there is one, a 24 h journal summary per Trace job,
 *                 the timers and the LocalDB backups
 *   ops.history   one compact line per run for the last 24 hours (a letter per check)
 *
 * Nothing in them identifies a visitor. This module checks their shape and folds the history into the strip the
 * page draws. Admin only: the page calls it after verifying the admin cookie.
 */

export type OpsStatus = "ok" | "warn" | "fail" | "unknown";

export type OpsCheck = {
  id: string;
  group: string;
  label: string;
  status: OpsStatus;
  detail: string;
  ms?: number;
};

export type OpsJob = {
  unit: string;
  runs: number;
  failures: number;
  median_s: number | null;
  p95_s: number | null;
  max_s: number | null;
  cpu_s: number;
  mem_peak: number;
  last_at: string | null;
  last_failed_at: string | null;
  last_ok: boolean;
};

export type OpsTimer = { unit: string; next_at: string | null; last_at: string | null; user: boolean };

export type OpsTraffic = {
  requests: number;
  errors_5xx: number;
  error_rate: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
  cache_hit_rate: number | null;
  top_5xx: Array<{ path: string; count: number }>;
};

export type OpsBackup = {
  ok: boolean;
  at: string | null;
  error: string | null;
  last_ok_at: string | null;
  compressed_bytes: number | null;
  /** Local copies kept. */
  dailies: number | null;
  weeklies: number | null;
  /** Copied off the box too; null when not known. */
  offsite: boolean | null;
  /** The newest few, newest first. */
  files: Array<{ at: string; bytes: number }>;
};

export type OpsLatest = {
  generated_at: string;
  overall: OpsStatus;
  checks: OpsCheck[];
  system: {
    mem_total: number;
    mem_available: number;
    swap_total: number;
    swap_used: number;
    load: number[];
    cpus: number;
    disks: Array<{ mount: string; label: string; free: number; total: number }>;
  };
  /** When StocksBrew's run read the box numbers above. */
  system_at: string | null;
  services: Array<{ name: string; memory: number | null; cpu_pct: number | null }>;
  traffic: { last_5m?: OpsTraffic; last_15m?: OpsTraffic; last_60m?: OpsTraffic };
  jobs: OpsJob[];
  timers: OpsTimer[];
  backup: OpsBackup | null;
  alert: { enabled?: boolean } | null;
  took_ms: number | null;
};

export type OpsHistoryEntry = { t: string; o: string; c: Record<string, string>; r?: number | null; e?: number | null; p?: number | null };

export type OpsHealth = { latest: OpsLatest | null; history: OpsHistoryEntry[] };

const STATUSES: readonly OpsStatus[] = ["ok", "warn", "fail", "unknown"];
const LETTER: Record<string, OpsStatus> = { g: "ok", a: "warn", r: "fail", u: "unknown" };
const RANK: Record<OpsStatus, number> = { ok: 0, unknown: 1, warn: 2, fail: 3 };

/** The snapshot runs every 5 minutes: older than this, the page says the checks themselves stopped. */
export const STALE_AFTER_MS = 15 * 60 * 1000;

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const obj = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

function status(value: unknown): OpsStatus {
  return STATUSES.includes(value as OpsStatus) ? (value as OpsStatus) : "unknown";
}

function traffic(value: unknown): OpsTraffic | undefined {
  const t = obj(value);
  if (num(t.requests) == null) return undefined;
  return {
    requests: num(t.requests) ?? 0,
    errors_5xx: num(t.errors_5xx) ?? 0,
    error_rate: num(t.error_rate),
    p50_ms: num(t.p50_ms),
    p95_ms: num(t.p95_ms),
    cache_hit_rate: num(t.cache_hit_rate),
    top_5xx: arr(t.top_5xx)
      .map((row) => ({ path: str(obj(row).path) ?? "", count: num(obj(row).count) ?? 0 }))
      .filter((row) => row.path),
  };
}

/** The stored run, shape-checked. Null when it is missing or not ours. */
export function parseLatest(raw: unknown): OpsLatest | null {
  const doc = obj(raw);
  const generated = str(doc.generated_at);
  if (!generated || !Array.isArray(doc.checks)) return null;
  const system = obj(doc.system);
  const backup = doc.backup == null ? null : obj(doc.backup);
  const alert = doc.alert == null ? null : obj(doc.alert);
  return {
    generated_at: generated,
    overall: status(doc.overall),
    checks: arr(doc.checks)
      .map((row) => {
        const c = obj(row);
        return {
          id: str(c.id) ?? "",
          group: str(c.group) ?? "other",
          label: str(c.label) ?? str(c.id) ?? "",
          status: status(c.status),
          detail: str(c.detail) ?? "",
          ms: num(c.ms) ?? undefined,
        };
      })
      .filter((c) => c.id),
    system: {
      mem_total: num(system.mem_total) ?? 0,
      mem_available: num(system.mem_available) ?? 0,
      swap_total: num(system.swap_total) ?? 0,
      swap_used: num(system.swap_used) ?? 0,
      load: arr(system.load).map((x) => num(x) ?? 0),
      cpus: num(system.cpus) ?? 1,
      disks: arr(system.disks).map((row) => {
        const d = obj(row);
        return { mount: str(d.mount) ?? "", label: str(d.label) ?? str(d.mount) ?? "", free: num(d.free) ?? 0, total: num(d.total) ?? 0 };
      }),
    },
    system_at: str(doc.system_at),
    services: arr(doc.services)
      .map((row) => {
        const s = obj(row);
        return { name: str(s.name) ?? "", memory: num(s.memory), cpu_pct: num(s.cpu_pct) };
      })
      .filter((s) => s.name),
    traffic: { last_5m: traffic(obj(doc.traffic).last_5m), last_15m: traffic(obj(doc.traffic).last_15m), last_60m: traffic(obj(doc.traffic).last_60m) },
    jobs: arr(doc.jobs)
      .map((row) => {
        const j = obj(row);
        return {
          unit: str(j.unit) ?? "",
          runs: num(j.runs) ?? 0,
          failures: num(j.failures) ?? 0,
          median_s: num(j.median_s),
          p95_s: num(j.p95_s),
          max_s: num(j.max_s),
          cpu_s: num(j.cpu_s) ?? 0,
          mem_peak: num(j.mem_peak) ?? 0,
          last_at: str(j.last_at),
          last_failed_at: str(j.last_failed_at),
          last_ok: j.last_ok !== false,
        };
      })
      .filter((j) => j.unit),
    timers: arr(doc.timers)
      .map((row) => {
        const t = obj(row);
        return { unit: str(t.unit) ?? "", next_at: str(t.next_at), last_at: str(t.last_at), user: t.user === true };
      })
      .filter((t) => t.unit),
    backup: backup
      ? {
          ok: backup.ok === true,
          at: str(backup.at),
          error: str(backup.error),
          last_ok_at: str(backup.last_ok_at),
          compressed_bytes: num(backup.compressed_bytes),
          dailies: num(backup.dailies),
          weeklies: num(backup.weeklies),
          offsite: typeof backup.offsite === "boolean" ? backup.offsite : null,
          files: arr(backup.files)
            .map((row) => ({ at: str(obj(row).at) ?? "", bytes: num(obj(row).bytes) ?? 0 }))
            .filter((f) => f.at && Number.isFinite(Date.parse(f.at))),
        }
      : null,
    alert: alert ? { enabled: alert.enabled === true } : null,
    took_ms: num(doc.took_ms),
  };
}

export function parseHistory(raw: unknown): OpsHistoryEntry[] {
  return arr(obj(raw).entries)
    .map((row) => {
      const e = obj(row);
      const c = obj(e.c);
      return {
        t: str(e.t) ?? "",
        o: str(e.o) ?? "u",
        c: Object.fromEntries(Object.entries(c).filter(([, v]) => typeof v === "string")) as Record<string, string>,
        r: num(e.r),
        e: num(e.e),
        p: num(e.p),
      };
    })
    .filter((e) => e.t && Number.isFinite(Date.parse(e.t)))
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
}

export function worstOf(statuses: Iterable<OpsStatus>): OpsStatus {
  let out: OpsStatus | null = null;
  for (const s of statuses) if (out == null || RANK[s] > RANK[out]) out = s;
  return out ?? "unknown";
}

/**
 * The last 24 hours as `buckets` slots per row (oldest first): the worst status any run in that slot had, or null
 * where no run landed (the job was not running). Row "overall" first, then each check id in `ids`.
 */
export function stripRows(history: OpsHistoryEntry[], ids: readonly string[], now: number, buckets = 96, hours = 24): Array<{ id: string; cells: Array<OpsStatus | null> }> {
  const span = hours * 3600 * 1000;
  const start = now - span;
  const width = span / buckets;
  const rows = ["overall", ...ids].map((id) => ({ id, cells: new Array<OpsStatus | null>(buckets).fill(null) }));
  for (const entry of history) {
    const at = Date.parse(entry.t);
    if (!(at > start && at <= now)) continue;
    const slot = Math.min(buckets - 1, Math.floor((at - start) / width));
    rows.forEach((row) => {
      const letter = row.id === "overall" ? entry.o : entry.c[row.id];
      if (!letter) return;
      const value = LETTER[letter] ?? "unknown";
      const current = row.cells[slot];
      row.cells[slot] = current == null ? value : worstOf([current, value]);
    });
  }
  return rows;
}

/** Share of the last 24 h's runs that were all green (null without history). */
export function greenShare(history: OpsHistoryEntry[], now: number, hours = 24): number | null {
  const since = now - hours * 3600 * 1000;
  const recent = history.filter((e) => Date.parse(e.t) > since);
  if (!recent.length) return null;
  return recent.filter((e) => e.o === "g").length / recent.length;
}

export const GROUP_LABELS: Record<string, string> = {
  site: "Site",
  services: "Services",
  traffic: "Traffic",
  data: "Data",
  box: "Box",
};

export function groupChecks(checks: OpsCheck[]): Array<{ group: string; label: string; checks: OpsCheck[] }> {
  const order = Object.keys(GROUP_LABELS);
  const groups = new Map<string, OpsCheck[]>();
  for (const check of checks) groups.set(check.group, [...(groups.get(check.group) ?? []), check]);
  return [...groups.entries()]
    .sort(([a], [b]) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)))
    .map(([group, list]) => ({ group, label: GROUP_LABELS[group] ?? group, checks: list }));
}

/** "trace-localdb-backup.service" -> "localdb-backup". */
export function unitName(unit: string): string {
  return unit.replace(/^trace-/, "").replace(/\.service$/, "");
}

/** The tab's data from the snapshot file, or null when there is no file or no `ops` block in it yet. */
export async function loadOpsHealth(): Promise<OpsHealth | null> {
  const snapshot = await readSnapshotFile();
  const ops = obj(snapshot?.ops);
  const latest = parseLatest(ops.latest);
  return latest ? { latest, history: parseHistory(ops.history) } : null;
}
