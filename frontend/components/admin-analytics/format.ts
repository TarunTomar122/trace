/** Number and label formats for /admin/analytics. Pure, shared by server and client parts. */

export function fmtCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "n/a";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `${(n / 1000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return Math.round(n).toLocaleString("en-US");
}

export function fmtPct(share: number | null | undefined, digits = 0): string {
  if (share == null || !Number.isFinite(share)) return "n/a";
  return `${(share * 100).toFixed(digits)}%`;
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "n/a";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/**
 * Change against the previous period: a ratio for counts ("+12%"), points for
 * rates ("−3 pts"). Null when there is nothing to compare with.
 */
export function change(value: number | null, previous: number | null, kind: "count" | "rate" | "seconds"): { text: string; dir: "up" | "down" | "flat" } | null {
  if (value == null || previous == null) return null;
  if (kind === "rate") {
    const pts = Math.round((value - previous) * 100);
    return { text: `${pts > 0 ? "+" : pts < 0 ? "−" : ""}${Math.abs(pts)} pts`, dir: pts > 0 ? "up" : pts < 0 ? "down" : "flat" };
  }
  if (previous === 0) return value === 0 ? null : { text: "new", dir: "up" };
  const pct = Math.round(((value - previous) / previous) * 100);
  return { text: `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%`, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

/** "US" -> the flag emoji; "??" -> a white flag. */
export function flagOf(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

let regionNames: Intl.DisplayNames | null = null;

export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "Unknown";
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The x-axis label for a point: "14:00" for hours, "Nov 12" for days. */
export function pointLabel(label: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label);
  if (!match) return label;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(match[2]) - 1]} ${Number(match[3])}`;
}

/** A page-speed figure: "640 ms", "2.4 s", or a layout-shift score "0.05". */
export function fmtSpeed(metric: "lcp" | "inp" | "cls" | "ttfb" | "fcp", value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  if (metric === "cls") return value < 0.01 ? (value === 0 ? "0" : "<0.01") : value.toFixed(2);
  // Rounded first, so 996 ms reads "1.0 s" (not "1000 ms") and 9,960 ms "10 s" (not "10.0 s").
  const ms = value < 100 ? Math.round(value) : Math.round(value / 10) * 10;
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(value / 100) / 10;
  return seconds < 10 ? `${seconds.toFixed(1)} s` : `${Math.round(value / 1000)} s`;
}
