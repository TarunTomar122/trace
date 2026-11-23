import { legacyRoute } from "./normalize.ts";
import { emptyRollup, type DayRollup, type HourRow } from "./rollup.ts";
import { bucketOf, emptyCell, type HistMetric, type SpeedCell } from "./speed.ts";

/**
 * The first version of Trace's analytics (Nov 21 to the rollups' launch) kept only daily totals: the `totals`
 * table (visitors, and pageviews by page, source, country and device) and the `timings` table (page-load
 * timings in 10 ms bins, no route or device). Those tables are left as they were and read here, so the
 * dashboard keeps its history. Nothing writes to them any more, so a day's totals add straight onto its rollup.
 *
 * What they never had stays blank: visits, bounces, visit length, signed in, campaigns, browsers, key events.
 * Their counts are pageviews, not visitors, for pages, sources, countries and devices. They have no hours either,
 * so a day's visitors and pageviews are spread evenly over its hours (for the hourly chart and the same-hour cut).
 */

export type LegacyTotal = { kind: string; label: string; n: number };
export type LegacyTiming = { metric: string; value: number; n: number };

/** n spread over `hours` hours as evenly as whole numbers allow, the remainder on the earliest hours. */
function spread(n: number, hours: number): number[] {
  const count = Math.max(1, Math.min(24, hours));
  const base = Math.floor(n / count);
  const extra = n - base * count;
  return Array.from({ length: 24 }, (_, h) => (h < count ? base + (h < extra ? 1 : 0) : 0));
}

function own(counter: Record<string, number>, key: string, by: number) {
  if (key === "__proto__" || !(by > 0)) return;
  counter[key] = (Object.prototype.hasOwnProperty.call(counter, key) ? counter[key]! : 0) + by;
}

/**
 * One day's rollup from its legacy totals. `hours`: how many hours of the day had passed (24 for a finished day),
 * the stretch its counts are spread over. Null when the day has nothing.
 */
export function legacyRollup(day: string, rows: readonly LegacyTotal[], hours = 24): DayRollup | null {
  if (rows.length === 0) return null;
  const out = emptyRollup(day, true);
  for (const row of rows) {
    const n = Number(row.n) || 0;
    if (n <= 0 || typeof row.label !== "string") continue;
    if (row.kind === "visitors") out.v += n;
    else if (row.kind === "page") {
      const route = legacyRoute(row.label);
      out.pv += n;
      // Only routes were ever kept, so the page and its route are the same row.
      for (const record of [out.pages, out.routes]) {
        if (route === "__proto__") continue;
        const target = Object.prototype.hasOwnProperty.call(record, route) ? record[route]! : (record[route] = { pv: 0, v: 0, x: 0, e: 0 });
        target.pv += n;
      }
    } else if (row.kind === "source") {
      // "Internal" was a move inside the site, not a visit's source.
      if (row.label === "Internal") continue;
      own(out.refs, row.label === "Direct" ? "(direct)" : row.label, n);
    } else if (row.kind === "country") own(out.countries, /^[A-Z]{2}$/.test(row.label) ? row.label : "??", n);
    else if (row.kind === "device") own(out.devices, row.label, n);
  }
  if (out.v === 0 && out.pv === 0) return null;
  out.lpv = out.pv;
  const v = spread(out.v, hours);
  const pv = spread(out.pv, hours);
  out.hours = out.hours.map((row: HourRow, h) => ({ ...row, v: v[h]!, pv: pv[h]! }));
  return out;
}

/** The legacy timings of a day as one speed cell (whole site, no route or device). Null when there are none. */
export function legacySpeedCell(loads: number, rows: readonly LegacyTiming[]): SpeedCell | null {
  const cell = emptyCell();
  cell.n = Math.max(0, Number(loads) || 0);
  for (const row of rows) {
    const metric = row.metric as HistMetric;
    if (!["lcp", "inp", "cls", "ttfb", "fcp", "origin"].includes(metric)) continue;
    const n = Number(row.n) || 0;
    if (n <= 0 || !Number.isFinite(row.value)) continue;
    // Layout shift was kept in thousandths; durations in milliseconds, rounded to 10.
    const value = metric === "cls" ? row.value / 1000 : row.value;
    const hist = (cell.h[metric] ??= []);
    const bucket = bucketOf(metric, value);
    while (hist.length <= bucket) hist.push(0);
    hist[bucket] = (hist[bucket] ?? 0) + n;
  }
  return cell.n > 0 || Object.keys(cell.h).length > 0 ? cell : null;
}
