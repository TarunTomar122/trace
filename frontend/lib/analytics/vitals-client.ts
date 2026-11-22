"use client";

/**
 * How fast the page loaded, measured by the browser itself, once per full page load (client-side navigations
 * after it are not measured: their time is the router's, and the slow part people feel is the first load).
 * No library: Navigation Timing for TTFB and the cache, and PerformanceObserver for FCP, LCP, CLS and the slowest
 * interaction (INP). The report goes out with the beacon (lib/analytics/beacon.ts) when the tab is hidden or
 * closed, or when the visitor moves to another page in the app, whichever comes first. Browsers without an
 * entry type (Safari has no LCP before 26, no layout shifts) just leave that figure out.
 */

export type VitalsPayload = { p: string; vw: number; origin?: number; ttfb?: number; fcp?: number; lcp?: number; inp?: number; cls?: number; ct?: string; c?: string };

/** CLS: the worst burst of unexpected layout shifts (each under 1 s after the last, the burst at most 5 s long). */
export class ClsWindow {
  value = 0;
  private sum = 0;
  private first = 0;
  private last = 0;

  add(value: number, at: number) {
    if (this.sum > 0 && at - this.last < 1000 && at - this.first < 5000) this.sum += value;
    else {
      this.sum = value;
      this.first = at;
    }
    this.last = at;
    if (this.sum > this.value) this.value = this.sum;
  }
}

/** INP from each interaction's longest event: the worst, skipping one per 50 interactions (the 98th percentile). */
export function inpOf(durations: Iterable<number>): number | undefined {
  const list = [...durations].sort((a, b) => b - a);
  return list.length ? list[Math.min(list.length - 1, Math.floor(list.length / 50))] : undefined;
}

type Nav = Pick<PerformanceNavigationTiming, "transferSize" | "decodedBodySize"> & { serverTiming?: ReadonlyArray<{ name: string; description: string }> };

/**
 * Which cache served the page: the browser's own (nothing came over the network), else what Varnish says in
 * `Server-Timing: cache;desc=hit|miss|pass|stale` (backend/vps/web/varnish.vcl). Undefined when unknown.
 */
export function cacheOf(nav: Nav): string | undefined {
  if (nav.transferSize === 0 && nav.decodedBodySize > 0) return "browser";
  const desc = nav.serverTiming?.find((entry) => entry.name === "cache")?.description?.toLowerCase();
  return desc && ["hit", "miss", "pass", "stale"].includes(desc) ? desc : undefined;
}

type Entry = PerformanceEntry & { value?: number; hadRecentInput?: boolean; interactionId?: number; duration: number };

let finish: (() => void) | null = null;
let started = false;

/** "/news/" and "/news" are the same page; anything that isn't a URL matches nothing. */
export function samePath(url: string, path: string): boolean {
  try {
    const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
    return trim(new URL(url, "http://x").pathname) === trim(path);
  } catch {
    return false;
  }
}

function prerendering(): boolean {
  return (document as Document & { prerendering?: boolean }).prerendering === true;
}

/**
 * Start measuring this page load. `path` is the first pageview the beacon counts; when it is not the page the
 * document loaded (the visit landed on an excluded page such as /admin and moved on in the app), there is no
 * page load to measure and nothing is reported. `deliver` gets the report once.
 */
export function startVitals(path: string, deliver: (report: VitalsPayload) => void) {
  if (started || typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
  started = true;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as (PerformanceNavigationTiming & Nav & { activationStart?: number }) | undefined;
    if (!nav || !samePath(nav.name, path)) return;
    // A prerendered page counts from when it was shown: activationStart is only known once it is, so read it late.
    const since = (t: number) => Math.round(Math.max(0, t - (nav.activationStart || 0)));
    // Paints after the tab was first hidden (opened in the background) say nothing about the page. A page still
    // prerendering is hidden too, but that is not the visitor's doing.
    let hiddenAt = !prerendering() && document.visibilityState === "hidden" ? 0 : Infinity;
    for (const e of performance.getEntriesByType("visibility-state")) {
      if (e.name === "hidden" && e.startTime >= (nav.activationStart || 0)) hiddenAt = Math.min(hiddenAt, e.startTime);
    }
    const report: VitalsPayload = { p: path, vw: window.innerWidth };
    const cache = cacheOf(nav);
    if (cache) report.c = cache;
    const origin = nav.serverTiming?.find(entry => entry.name === "trace-origin");
    if (cache !== "browser" && origin) report.origin = origin.duration;
    const net = (navigator as Navigator & { connection?: { effectiveType?: unknown } }).connection?.effectiveType;
    if (typeof net === "string") report.ct = net;

    const cls = new ClsWindow();
    const interactions = new Map<number, number>();
    const watching: Array<[PerformanceObserver, (e: Entry) => void]> = [];
    const watch = (type: string, onEntry: (e: Entry) => void, options: Record<string, unknown> = {}) => {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return false;
      try {
        const po = new PerformanceObserver((list) => list.getEntries().forEach((e) => onEntry(e as Entry)));
        po.observe({ type, buffered: true, ...options } as PerformanceObserverInit);
        watching.push([po, onEntry]);
        return true;
      } catch {
        return false;
      }
    };
    watch("paint", (e) => {
      if (e.name === "first-contentful-paint" && e.startTime < hiddenAt) report.fcp = since(e.startTime);
    });
    // The browser stops reporting LCP candidates at the first tap, key or scroll.
    watch("largest-contentful-paint", (e) => {
      if (e.startTime < hiddenAt) report.lcp = since(e.startTime);
    });
    const shifts = watch("layout-shift", (e) => {
      if (!e.hadRecentInput && typeof e.value === "number") cls.add(e.value, e.startTime);
    });
    const onEvent = (e: Entry) => {
      if (e.interactionId) interactions.set(e.interactionId, Math.max(interactions.get(e.interactionId) ?? 0, e.duration));
    };
    watch("event", onEvent, { durationThreshold: 40 });
    watch("first-input", onEvent);

    finish = () => {
      // Never shown (a prerender thrown away): nothing to report, and nothing more will come.
      if (prerendering()) {
        finish = null;
        for (const [po] of watching) po.disconnect();
        return;
      }
      finish = null;
      if (nav.responseStart > 0) report.ttfb = since(nav.responseStart);
      for (const [po, onEntry] of watching) {
        po.takeRecords().forEach((e) => onEntry(e as Entry));
        po.disconnect();
      }
      if (shifts) report.cls = Math.round(cls.value * 10000) / 10000;
      const inp = inpOf(interactions.values());
      if (inp !== undefined) report.inp = Math.round(inp);
      deliver(report);
    };
  } catch {
    // never let measuring break the page
  }
}

/** Close the measurement and hand the report over (tab hidden or closed, or a move to another page). Once. */
export function finishVitals() {
  try {
    finish?.();
  } catch {
    finish = null;
  }
}
