"use client";

import * as React from "react";

import { countryName, flagOf, fmtCount } from "./format";

export type LiveData = {
  visitors: number;
  pageviews: number;
  pages: Array<{ path: string; visitors: number }>;
  countries: Array<{ code: string; visitors: number }>;
  at: string;
};

const POLL_MS = 15_000;

/** The last five minutes, read again every 15 seconds while the tab is visible. */
export function LiveNow({ initial }: { initial: LiveData | null }) {
  const [data, setData] = React.useState<LiveData | null>(initial);
  const [stale, setStale] = React.useState(false);

  React.useEffect(() => {
    let stopped = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/admin/analytics/live", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error(String(response.status));
        const next = (await response.json()) as LiveData;
        if (!stopped) {
          setData(next);
          setStale(false);
        }
      } catch {
        if (!stopped) setStale(true);
      }
    };
    const timer = window.setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  const max = Math.max(1, ...(data?.pages.map((p) => p.visitors) ?? [1]));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-end gap-3 px-3 pt-3 sm:px-4">
        <span className="relative mb-2.5 flex size-2.5">
          {data && data.visitors > 0 ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal-bullish opacity-60 motion-reduce:animate-none" /> : null}
          <span className={`relative inline-flex size-2.5 rounded-full ${data && data.visitors > 0 ? "bg-signal-bullish" : "bg-oa-muted-fg/50"}`} />
        </span>
        <span className="oa-mono text-[34px] font-semibold leading-10 tabular-nums text-oa-fg">{data ? fmtCount(data.visitors) : "n/a"}</span>
        <span className="mb-1.5 text-[13.5px] text-oa-muted-fg">
          {data?.visitors === 1 ? "visitor" : "visitors"} · {data ? fmtCount(data.pageviews) : "n/a"} views
        </span>
      </div>
      {data && data.countries.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pt-1 text-[13px] text-oa-muted-fg sm:px-4">
          {data.countries.map((c) => (
            <span key={c.code} title={countryName(c.code)} className="whitespace-nowrap">
              <span aria-hidden>{flagOf(c.code)}</span> <span className="oa-mono tabular-nums">{c.visitors}</span>
            </span>
          ))}
        </div>
      ) : null}
      <ul className="mt-2 min-h-0 flex-1 overflow-y-auto border-t border-oa-border">
        {data && data.pages.length > 0 ? (
          data.pages.map((page) => (
            <li key={page.path} className="relative flex h-9 items-center gap-2 px-3 text-[13.5px] sm:px-4">
              <span aria-hidden className="absolute inset-y-1 left-1.5 rounded-sm bg-signal-bullish/10" style={{ width: `calc(${(page.visitors / max) * 100}% - 0.75rem)` }} />
              <span className="relative min-w-0 flex-1 truncate text-oa-fg">{page.path}</span>
              <span className="oa-mono relative tabular-nums text-oa-fg">{page.visitors}</span>
            </li>
          ))
        ) : (
          <li className="px-3 py-6 text-center text-[13.5px] text-oa-muted-fg sm:px-4">Nobody on the site right now.</li>
        )}
      </ul>
      {stale ? <p className="border-t border-oa-border px-3 py-1.5 text-[12.5px] text-oa-muted-fg sm:px-4">Couldn&apos;t refresh. Trying again.</p> : null}
    </div>
  );
}
