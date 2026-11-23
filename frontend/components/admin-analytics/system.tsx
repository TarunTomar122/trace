import * as React from "react";

import { NUM } from "@/components/admin-analytics/kit/cells";
import { greenShare, groupChecks, STALE_AFTER_MS, stripRows, unitName, type OpsCheck, type OpsHealth, type OpsStatus } from "@/lib/analytics/ops-health";
import { dayText } from "@/lib/analytics/signups-view";

import { fmtCount, fmtPct } from "./format";
import { Box, GroupHead } from "./parts";

/**
 * The System tab of /admin/analytics, ported from StocksBrew: Trace's live checks, the last 24 hours as a strip,
 * its jobs and timers from systemd, the LocalDB backups, memory and disks, and Caddy's traffic once Trace has an
 * access log. Everything comes from the admin snapshot (backend/vps/trace-analytics-snapshot.py, every 5 minutes).
 * Server-rendered, no hooks.
 */

const DOT: Record<OpsStatus, string> = {
  ok: "bg-signal-bullish",
  warn: "bg-amber-500",
  fail: "bg-signal-bearish",
  unknown: "bg-oa-muted-fg/40",
};
const TEXT: Record<OpsStatus, string> = {
  ok: "text-signal-bullish",
  warn: "text-amber-700 dark:text-amber-400",
  fail: "text-signal-bearish",
  unknown: "text-oa-muted-fg",
};

export function fmtBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "n/a";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let unit = 0;
  while (Math.abs(value) >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function fmtSecs(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return "n/a";
  if (s < 10) return `${s.toFixed(1)}s`;
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

function ago(iso: string | null | undefined, now: number): string {
  if (!iso) return "never";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "n/a";
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = minutes / 60;
  if (hours < 36) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** "in 4 min", "in 2.5 h", "in 3 days"; "due" once the time has passed (the snapshot is up to 5 minutes old). */
function until(iso: string | null | undefined, now: number): string {
  if (!iso) return "not scheduled";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "n/a";
  const minutes = Math.round((then - now) / 60000);
  if (minutes < 1) return "due";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = minutes / 60;
  if (hours < 36) return `in ${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
  return `in ${Math.round(hours / 24)} days`;
}

function Dot({ status, className = "" }: { status: OpsStatus; className?: string }) {
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${DOT[status]} ${className}`} />;
}

function Stat({ label, value, sub, tone, title }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: OpsStatus; title?: string }) {
  return (
    <div className="-mb-px -mr-px flex min-w-0 flex-col gap-1 border-b border-r border-oa-border px-3 py-2.5 sm:px-4" title={title}>
      <dt className="oa-caption truncate">{label}</dt>
      <dd className={`${NUM} truncate text-[22px] font-semibold leading-7 tracking-[-0.01em] ${tone && tone !== "ok" ? TEXT[tone] : "text-oa-fg"}`}>{value}</dd>
      <dd className="truncate text-[12.5px] leading-4 text-oa-muted-fg">{sub ?? " "}</dd>
    </div>
  );
}

function checkOf(checks: OpsCheck[], id: string): OpsCheck | undefined {
  return checks.find((c) => c.id === id);
}

function statusOf(checks: OpsCheck[], id: string): OpsStatus | undefined {
  return checkOf(checks, id)?.status;
}

function overallWords(checks: OpsCheck[]): { text: string; tone: OpsStatus } {
  const red = checks.filter((c) => c.status === "fail").length;
  const amber = checks.filter((c) => c.status === "warn").length;
  if (red) return { text: `${red} red`, tone: "fail" };
  if (amber) return { text: `${amber} amber`, tone: "warn" };
  return { text: "All green", tone: "ok" };
}

/** One row of the 24-hour strip: a cell per 15 minutes, coloured by the worst check result in it. */
function StripRow({ label, cells, strong = false }: { label: string; cells: Array<OpsStatus | null>; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
      <span className={`truncate text-[13px] ${strong ? "font-medium text-oa-fg" : "text-oa-muted-fg"}`} title={label}>
        {label}
      </span>
      <span className="flex h-3.5 gap-px" role="img" aria-label={`${label}: ${cells.filter((c) => c && c !== "ok").length} slots not green`}>
        {cells.map((cell, index) => (
          <span key={index} className={`min-w-0 flex-1 first:rounded-l-sm last:rounded-r-sm ${cell ? DOT[cell] : "bg-oa-border/50"}`} />
        ))}
      </span>
    </div>
  );
}

function Bar({ share, tone = "primary" }: { share: number; tone?: "primary" | OpsStatus }) {
  const color = tone === "primary" ? "bg-oa-primary/70" : DOT[tone];
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-oa-border/60">
      <span className={`absolute inset-y-0 left-0 rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} />
    </span>
  );
}

export function SystemDashboard({ data, now }: { data: OpsHealth; now: number }) {
  const latest = data.latest!;
  const checks = latest.checks;
  const stale = now - Date.parse(latest.generated_at) > STALE_AFTER_MS;
  const overall = overallWords(checks);
  const sys = latest.system;
  const memShare = sys.mem_total ? sys.mem_available / sys.mem_total : null;
  const swapShare = sys.swap_total ? sys.swap_used / sys.swap_total : null;
  const root = sys.disks.find((d) => d.mount === "/");
  const t15 = latest.traffic.last_15m;
  const t60 = latest.traffic.last_60m;
  // Without an access log the traffic tiles say why instead of a bare n/a.
  const noTraffic = t15 ? undefined : checkOf(checks, "http_5xx")?.detail;
  const site = checkOf(checks, "site_public");

  // Strip: overall, then only the checks that were not green at some point in the last 24 hours.
  const ids = checks.map((c) => c.id);
  const strip = stripRows(data.history, ids, now);
  const labelOf = new Map(checks.map((c) => [c.id, c.label]));
  const troubled = strip.slice(1).filter((row) => row.cells.some((cell) => cell === "warn" || cell === "fail"));
  const green = greenShare(data.history, now);

  const jobs = latest.jobs;
  const failedRuns = jobs.reduce((sum, j) => sum + j.failures, 0);
  const timers = latest.timers;
  const services = [...latest.services].sort((a, b) => (b.memory ?? 0) - (a.memory ?? 0));
  const memMax = Math.max(1, ...services.map((s) => s.memory ?? 0));
  const backup = latest.backup;
  const backups = backup?.files ?? [];
  const backupMax = Math.max(1, ...backups.map((f) => f.bytes));
  const kept = backup?.dailies != null ? `${fmtCount(backup.dailies)} kept` : null;
  const where = backup?.offsite === false ? "this box only" : backup?.offsite ? "copied offsite" : null;

  return (
    <div className="flex flex-col gap-3">
      {stale ? (
        <p className="oa-surface border border-amber-500/40 bg-oa-card px-3 py-2 text-[13.5px] text-amber-700 sm:px-4 dark:text-amber-400">
          The checks stopped {ago(latest.generated_at, now)}. Everything below is from then.
        </p>
      ) : null}

      <dl className="oa-surface grid grid-cols-2 overflow-hidden border border-oa-border bg-oa-card md:grid-cols-4 2xl:grid-cols-8">
        <Stat label="Status" value={overall.text} tone={stale ? "warn" : overall.tone} sub={`checked ${ago(latest.generated_at, now)}`} />
        <Stat label="Response p95" value={t15?.p95_ms != null ? `${fmtCount(t15.p95_ms)} ms` : "n/a"} tone={statusOf(checks, "http_p95")} sub={t15 ? `${fmtCount(t15.requests)} requests, 15 min` : noTraffic} />
        <Stat label="Server errors" value={t15 ? fmtCount(t15.errors_5xx) : "n/a"} tone={statusOf(checks, "http_5xx")} sub={t60 ? `${fmtCount(t60.errors_5xx)} in the last hour` : noTraffic} />
        <Stat label="Public site" value={site?.ms != null ? `${fmtCount(site.ms)} ms` : "n/a"} tone={site?.status} sub="home page through Cloudflare" title={site?.detail} />
        <Stat label="Memory free" value={fmtBytes(sys.mem_available)} tone={statusOf(checks, "memory")} sub={memShare != null ? `${fmtPct(memShare)} of ${fmtBytes(sys.mem_total)}` : undefined} />
        <Stat label="Swap used" value={fmtPct(swapShare)} tone={statusOf(checks, "swap")} sub={sys.swap_total ? `${fmtBytes(sys.swap_used)} of ${fmtBytes(sys.swap_total)}` : "no swap"} />
        <Stat label="System disk" value={root ? fmtBytes(root.free) : "n/a"} tone={statusOf(checks, "disk:/")} sub={root ? `free of ${fmtBytes(root.total)}` : undefined} />
        <Stat
          label="Backup"
          value={backup?.last_ok_at ? ago(backup.last_ok_at, now) : "None yet"}
          tone={statusOf(checks, "backup")}
          title={checkOf(checks, "backup")?.detail}
          sub={backup?.compressed_bytes ? [fmtBytes(backup.compressed_bytes), kept, where].filter(Boolean).join(", ") : backup?.error ? "last run failed" : undefined}
        />
      </dl>

      <Box label="Last 24 hours" right={green != null ? `${fmtPct(green)} of runs all green` : "no history yet"}>
        <div className="flex flex-col gap-1.5">
          <StripRow label="All checks" cells={strip[0]!.cells} strong />
          {troubled.map((row) => (
            <StripRow key={row.id} label={labelOf.get(row.id) ?? row.id} cells={row.cells} />
          ))}
          <div className="grid grid-cols-[6.5rem_1fr] gap-2 text-[12px] text-oa-muted-fg sm:grid-cols-[9.5rem_1fr] sm:gap-3">
            <span />
            <span className={`${NUM} flex justify-between`}>
              <span>24 h ago</span>
              <span>12 h</span>
              <span>now</span>
            </span>
          </div>
        </div>
      </Box>

      <Box label="Checks" right={latest.alert?.enabled ? "email alerts on" : "email alerts off"} flush>
        <div className="columns-1 gap-0 md:columns-2 xl:columns-3 [column-rule:1px_solid_var(--oa-border)]">
          {groupChecks(checks).map((group) => (
            <div key={group.group} className="break-inside-avoid pb-1">
              <GroupHead>{group.label}</GroupHead>
              <ul>
                {group.checks.map((c) => (
                  <li key={c.id} className="flex h-9 items-center gap-2.5 px-3 text-[13.5px] sm:px-4" title={c.detail}>
                    <Dot status={c.status} />
                    <span className="shrink-0 text-oa-fg">{c.label}</span>
                    <span className={`min-w-0 flex-1 truncate text-right text-[12.5px] ${c.status === "ok" ? "text-oa-muted-fg" : TEXT[c.status]}`}>{c.detail}</span>
                  </li>
                ))}
                {group.group === "traffic"
                  ? (t60?.top_5xx ?? []).map((row) => (
                      <li key={row.path} className="flex h-8 items-center gap-2.5 px-3 pl-7 text-[12.5px] sm:px-4 sm:pl-8" title="server errors in the last hour">
                        <span className="oa-mono min-w-0 flex-1 truncate text-oa-fg">{row.path}</span>
                        <span className={`${NUM} text-signal-bearish`}>{fmtCount(row.count)}</span>
                      </li>
                    ))
                  : null}
              </ul>
            </div>
          ))}
        </div>
      </Box>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Box label="Jobs, last 24 hours" right={`${fmtCount(jobs.length)} units · ${fmtCount(failedRuns)} failed runs`} flush>
            {jobs.length ? (
              <div className="max-h-[22.5rem] min-h-0 overflow-auto">
                <table className="w-full table-fixed whitespace-nowrap text-[13.5px] sm:min-w-[36rem]">
                  <thead className="sticky top-0 z-10 bg-oa-card">
                    <tr className="h-9 border-b border-oa-border text-left text-[12.5px] text-oa-muted-fg">
                      <th className="px-3 font-normal sm:px-4">Job</th>
                      <th className="w-[3rem] px-2 text-right font-normal sm:w-[3.5rem]">Runs</th>
                      <th className="w-[3.75rem] px-2 text-right font-normal sm:w-[4rem]">Failed</th>
                      <th className="w-[4.25rem] px-2 text-right font-normal sm:w-[4.5rem]">Median</th>
                      <th className="hidden w-[4rem] px-2 text-right font-normal sm:table-cell">Max</th>
                      <th className="hidden w-[4.5rem] px-2 text-right font-normal sm:table-cell">CPU</th>
                      <th className="hidden w-[5rem] px-2 text-right font-normal sm:table-cell">Peak</th>
                      <th className="w-[5.5rem] px-3 text-right font-normal sm:w-[6.5rem] sm:px-4">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.unit} className="h-9 border-b border-oa-border/60 last:border-b-0">
                        <td className="truncate px-3 sm:px-4" title={j.unit}>
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <Dot status={!j.last_ok ? "fail" : j.failures ? "warn" : "ok"} />
                            <span className="truncate text-oa-fg">{unitName(j.unit)}</span>
                          </span>
                        </td>
                        <td className={`${NUM} px-2 text-right text-oa-fg`}>{fmtCount(j.runs)}</td>
                        <td className={`${NUM} px-2 text-right ${j.failures ? "text-signal-bearish" : "text-oa-muted-fg"}`}>{j.failures ? fmtCount(j.failures) : "0"}</td>
                        <td className={`${NUM} px-2 text-right text-oa-fg`}>{fmtSecs(j.median_s)}</td>
                        <td className={`${NUM} hidden px-2 text-right text-oa-muted-fg sm:table-cell`}>{fmtSecs(j.max_s)}</td>
                        <td className={`${NUM} hidden px-2 text-right text-oa-fg sm:table-cell`}>{fmtSecs(j.cpu_s)}</td>
                        <td className={`${NUM} hidden px-2 text-right text-oa-muted-fg sm:table-cell`}>{j.mem_peak ? fmtBytes(j.mem_peak) : "n/a"}</td>
                        <td className={`${NUM} px-3 text-right text-[12.5px] text-oa-muted-fg sm:px-4`}>{ago(j.last_at, now).replace(" min ago", "m ago").replace(" h ago", "h ago")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-6 text-center text-[13.5px] text-oa-muted-fg">No job runs in the journal yet.</p>
            )}
          </Box>
        </div>
        <div className="lg:col-span-4">
          <Box label="Timers" right="next run" flush>
            {timers.length ? (
              <ul className="max-h-[22.5rem] min-h-0 overflow-y-auto">
                {timers.map((t) => (
                  <li key={t.unit} className="flex h-9 items-center gap-2.5 border-b border-oa-border/60 px-3 text-[13.5px] last:border-b-0 sm:px-4" title={`${t.unit}${t.user ? " (trace user)" : ""}, last ran ${ago(t.last_at, now)}`}>
                    <span className="min-w-0 flex-1 truncate text-oa-fg">{unitName(t.unit)}</span>
                    <span className={`${NUM} shrink-0 text-right text-[12.5px] text-oa-muted-fg`}>{until(t.next_at, now)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-[13.5px] text-oa-muted-fg">No Trace timers found.</p>
            )}
          </Box>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Box label="LocalDB backups" right={[kept, where].filter(Boolean).join(" · ") || undefined} flush>
            {backups.length ? (
              <ul className="max-h-[27rem] min-h-0 overflow-y-auto">
                {backups.map((f) => (
                  <li key={f.at} className="relative grid h-9 grid-cols-[1fr_4.5rem_5.5rem] items-center gap-2 px-3 text-[13.5px] sm:px-4">
                    <span aria-hidden className="absolute inset-y-1 left-1.5 rounded-sm bg-oa-primary/10" style={{ width: `calc(${(f.bytes / backupMax) * 100}% - 0.75rem)` }} />
                    <span className="relative min-w-0 truncate text-oa-fg">{dayText(Date.parse(f.at), now)}</span>
                    <span className={`${NUM} relative text-right text-oa-fg`}>{fmtBytes(f.bytes)}</span>
                    <span className={`${NUM} relative text-right text-[12.5px] text-oa-muted-fg`}>{ago(f.at, now)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-[13.5px] text-oa-muted-fg">No backups on the box yet.</p>
            )}
          </Box>
        </div>
        <div className="lg:col-span-4">
          <Box label="Memory" right={`load ${sys.load.map((x) => x.toFixed(1)).join(" ")} on ${sys.cpus} cores`} flush>
            <ul>
              {services.map((s) => (
                <li key={s.name} className="grid h-9 grid-cols-[1fr_4.5rem_3.5rem] items-center gap-2 px-3 text-[13.5px] sm:px-4">
                  <span className="relative min-w-0">
                    <span className="block truncate text-oa-fg">{s.name}</span>
                    <span className="absolute inset-x-0 -bottom-1.5">
                      <Bar share={(s.memory ?? 0) / memMax} />
                    </span>
                  </span>
                  <span className={`${NUM} text-right text-oa-fg`}>{fmtBytes(s.memory)}</span>
                  <span className={`${NUM} text-right text-[12.5px] text-oa-muted-fg`} title="CPU, share of one core over the last 5 minutes">
                    {s.cpu_pct != null ? `${s.cpu_pct.toFixed(s.cpu_pct < 10 ? 1 : 0)}%` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <GroupHead>Disks</GroupHead>
            <ul className="pb-2">
              {sys.disks.map((d) => {
                const used = d.total ? 1 - d.free / d.total : 0;
                const tone = statusOf(checks, `disk:${d.mount}`) ?? "unknown";
                return (
                  <li key={d.mount} className="flex flex-col gap-1.5 px-3 py-1.5 text-[13.5px] sm:px-4">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-oa-fg">{d.label}</span>
                      <span className={`${NUM} text-[12.5px] text-oa-muted-fg`}>
                        {fmtBytes(d.free)} free of {fmtBytes(d.total)}
                      </span>
                    </span>
                    <Bar share={used} tone={tone === "ok" ? "primary" : tone} />
                  </li>
                );
              })}
            </ul>
          </Box>
        </div>
      </div>
    </div>
  );
}
