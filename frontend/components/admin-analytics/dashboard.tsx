import Link from "next/link";
import * as React from "react";

import { NUM } from "@/components/admin-analytics/kit/cells";
import type { Dashboard, RangeId } from "@/lib/analytics/dashboard";

import { countryName, flagOf, fmtCount, fmtDuration, fmtPct, pointLabel } from "./format";
import { LiveNow, type LiveData } from "./live-now";
import { BrowserIcon, Box, DeviceIcon, GroupHead, RankList, Tile, type RankRow } from "./parts";
import { SiteIcon } from "./site-icon";
import { VisitorsChart } from "./visitors-chart";

const RANGE_WORDS: Record<RangeId, string> = { today: "Today", "7d": "7 days", "30d": "30 days", "90d": "90 days" };
/** The range runs up to now, so it is always "so far", against the same stretch before it. */
export const BEFORE_WORDS: Record<RangeId, string> = {
  today: "Today so far, against yesterday by this hour",
  "7d": "So far, against the 7 days before",
  "30d": "So far, against the 30 days before",
  "90d": "So far, against the 90 days before",
};

export function RangePicker({ current }: { current: RangeId }) {
  return (
    <nav aria-label="Range" className="inline-flex h-9 shrink-0 items-stretch rounded-md border border-oa-border bg-oa-bg p-0.5 lg:h-8">
      {(Object.keys(RANGE_WORDS) as RangeId[]).map((id) => (
        <Link
          key={id}
          href={`/admin/analytics?range=${id}`}
          prefetch={false}
          replace
          aria-current={id === current ? "page" : undefined}
          className={`inline-flex items-center rounded px-2.5 text-[13.5px] transition-colors ${
            id === current ? "bg-oa-card font-medium text-oa-fg shadow-[0_0_0_1px_var(--oa-border)]" : "text-oa-muted-fg hover:text-oa-fg"
          }`}
        >
          {RANGE_WORDS[id]}
        </Link>
      ))}
    </nav>
  );
}

function rows(list: Dashboard["sources"]["referrers"], label: (key: string) => React.ReactNode, icon?: (key: string) => React.ReactNode, title?: (key: string) => string): RankRow[] {
  return list.map((row) => ({ key: row.key, label: label(row.key), icon: icon?.(row.key), value: row.value, share: row.share, title: title?.(row.key) }));
}

const EVENT_ROWS: Array<[string, string]> = [
  ["newsletter_signup", "Newsletter signups"],
  ["signin_started", "Sign-ins started"],
  ["signin_completed", "Sign-ins"],
  ["signup_completed", "New accounts"],
  ["onboarded", "Onboarded"],
  ["item_clicked", "Stories clicked"],
  ["summary_opened", "Summaries opened"],
  ["bookmarked", "Saved"],
  ["share", "Shares"],
  ["brief_pref", "Daily email switched"],
  ["newsletter_customized", "Newsletters customized"],
  ["checkout_started", "Checkouts opened"],
  ["purchase_completed", "Purchases"],
];

/** The newsletter forms, by the source lib/posthog.tsx trackNewsletterSignup sends. */
const FORM_WORDS: Record<string, string> = {
  landing: "Home page",
  daily_page: "Brief pages",
  featured_page: "Featured page",
  blog_inline: "Blog",
  feed_prompt: "Feed prompt",
  "(unknown)": "Not known",
};
/** What a funnel step's rate is a share of (lib/analytics/funnel.ts). */
const OF_WORDS: Record<string, string> = { visit: "visitors", account: "accounts", checkout: "checkouts" };
const SHARE_WORDS: Record<string, string> = { x: "X", linkedin: "LinkedIn", copy: "Copied link", native: "Share sheet", link: "From the feed" };

/** "/brief/2026-11-20" -> "Brief, Nov 20"; a story or article keeps its path. */
function readLabel(path: string): string {
  const brief = /^\/brief\/(\d{4}-\d{2}-\d{2})$/.exec(path);
  if (brief) return `Brief, ${pointLabel(brief[1]!)}`;
  const featured = /^\/featured\/(\d{4}-\d{2}-\d{2})\//.exec(path);
  if (featured) return `Featured, ${pointLabel(featured[1]!)}`;
  return path;
}

const READ_ICONS: Record<string, string> = {
  brief: "M4 4h12v12H4zM7 7.5h6M7 10h6M7 12.5h4",
  story: "M5 3h7l3 3v11H5zM12 3v3h3M7.5 10h5M7.5 13h5",
  featured: "M10 3l2.2 4.5 4.8.7-3.5 3.4.8 4.9L10 14.2l-4.3 2.3.8-4.9L3 8.2l4.8-.7z",
};

function ReadIcon({ path }: { path: string }) {
  const kind = path.startsWith("/brief/") ? "brief" : path.startsWith("/featured/") ? "featured" : "story";
  return (
    <svg viewBox="0 0 20 20" className="relative size-4 shrink-0 text-oa-muted-fg" aria-hidden>
      <path d={READ_ICONS[kind]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function AnalyticsDashboard({ data, live }: { data: Dashboard; live: LiveData | null }) {
  const h = data.headline;
  const utmGroups = [
    { id: "source", label: "Source", list: data.sources.utmSource },
    { id: "medium", label: "Medium", list: data.sources.utmMedium },
    { id: "campaign", label: "Campaign", list: data.sources.utmCampaign },
  ].filter((group) => group.list.length > 0);
  const hasUtm = utmGroups.length > 0;
  const funnelMax = Math.max(1, ...data.funnel.map((s) => s.count));
  const signups = data.events.newsletter_signup?.n ?? 0;
  const shares = data.events.share?.n ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Headline strip: 2 across on a phone, 4 on a laptop, 8 on a wide screen. */}
      <dl className="oa-surface grid grid-cols-2 overflow-hidden border border-oa-border bg-oa-card md:grid-cols-4 2xl:grid-cols-8">
        <Tile label="Visitors" value={fmtCount(h.visitors.value)} current={h.visitors.value} previous={h.visitors.previous} kind="count" spark={h.visitors.spark} />
        <Tile label="Pageviews" value={fmtCount(h.pageviews.value)} current={h.pageviews.value} previous={h.pageviews.previous} kind="count" spark={h.pageviews.spark} />
        <Tile label="Visits" value={fmtCount(h.sessions.value)} current={h.sessions.value} previous={h.sessions.previous} kind="count" spark={h.sessions.spark} />
        <Tile label="Bounce" value={fmtPct(h.bounce.value)} current={h.bounce.value} previous={h.bounce.previous} kind="rate" lowerIsBetter spark={h.bounce.spark} />
        <Tile label="Visit length" value={fmtDuration(h.avgSession.value)} current={h.avgSession.value} previous={h.avgSession.previous} kind="seconds" spark={h.avgSession.spark} />
        <Tile label="Signed in" value={fmtPct(data.signedIn.share)} current={data.signedIn.share} previous={null} kind="rate" spark={[]} />
        <Tile label="Sign-ups" value={fmtCount(h.signups.value)} current={h.signups.value} previous={h.signups.previous} kind="count" spark={h.signups.spark} />
        <Tile label="Paid" value={fmtCount(h.paid.value)} current={h.paid.value} previous={h.paid.previous} kind="count" spark={h.paid.spark} />
      </dl>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Box
            label="Visitors"
            right={
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 rounded bg-oa-primary" />
                  Visitors
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 rounded bg-oa-muted-fg" />
                  Pageviews
                </span>
              </span>
            }
          >
            <VisitorsChart points={data.series} />
          </Box>
        </div>
        <div className="lg:col-span-4">
          <Box label="Live now" right="last 5 minutes" flush>
            <LiveNow initial={live} />
          </Box>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${hasUtm ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        <Box label="Sources" right={`${fmtCount(data.sources.referrers.length)} sites`} flush>
          <RankList
            rows={rows(data.sources.referrers, (key) => (key === "(direct)" ? "Direct" : key), (key) => <SiteIcon host={key} />)}
            empty="No visits yet."
          />
        </Box>
        {hasUtm ? (
          <Box label="Campaigns" flush>
            {utmGroups.map((group) => (
              <React.Fragment key={group.id}>
                <GroupHead>{group.label}</GroupHead>
                <RankList rows={group.list.map((r) => ({ key: r.key, label: r.key, value: r.value, share: r.share }))} empty="" rowsInView={4} />
              </React.Fragment>
            ))}
          </Box>
        ) : null}
        <Box label="Countries" flush>
          <RankList
            rows={rows(data.sources.countries, countryName, (key) => <span aria-hidden className="text-[15px] leading-none">{flagOf(key)}</span>)}
            empty="No visits yet."
            rowsInView={7}
          />
          <a
            href="https://db-ip.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto border-t border-oa-border px-3 py-1.5 text-[12px] text-oa-muted-fg hover:text-oa-fg sm:px-4"
          >
            IP geolocation by DB-IP
          </a>
        </Box>
        <Box label="Devices" flush>
          <RankList rows={rows(data.sources.devices, (key) => key[0]!.toUpperCase() + key.slice(1), (key) => <DeviceIcon kind={key} />)} empty="No visits yet." rowsInView={3} />
          <div className="border-t border-oa-border" />
          <RankList rows={rows(data.sources.browsers, (key) => key, (key) => <BrowserIcon name={key} />)} empty="No browsers yet." rowsInView={5} />
        </Box>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Box label="Pages" right={`${fmtCount(data.pages.paths.length)} shown`} flush>
            <PageTable rows={data.pages.paths} />
          </Box>
        </div>
        <div className="lg:col-span-4">
          <Box label="Most read" flush>
            {data.reads.length > 0 ? (
              <ul className="min-h-0 overflow-y-auto" style={{ maxHeight: "18rem" }}>
                {data.reads.map((row) => {
                  const max = data.reads[0]!.views || 1;
                  return (
                    <li key={row.path}>
                      <a href={row.path} target="_blank" rel="noreferrer" className="relative flex h-9 items-center gap-2.5 px-3 text-[13.5px] hover:bg-oa-accent sm:px-4" title={row.path}>
                        <span aria-hidden className="absolute inset-y-1 left-1.5 rounded-sm bg-oa-primary/10" style={{ width: `calc(${(row.views / max) * 100}% - 0.75rem)` }} />
                        <ReadIcon path={row.path} />
                        <span className="relative min-w-0 flex-1 truncate text-oa-fg">{readLabel(row.path)}</span>
                        <span className={`${NUM} relative text-oa-fg`}>{fmtCount(row.views)}</span>
                        <span className={`${NUM} relative w-10 text-right text-[12.5px] text-oa-muted-fg`} title="visitors">
                          {fmtCount(row.visitors)}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-[13.5px] text-oa-muted-fg">No stories or briefs opened yet.</p>
            )}
          </Box>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Box label="Funnel">
            <ol className="flex flex-col gap-1.5">
              {data.funnel.map((step) => (
                <li key={step.id} className="grid grid-cols-[minmax(7.5rem,10rem)_1fr_3.5rem] items-center gap-2 text-[13.5px] sm:grid-cols-[11rem_1fr_4rem_3.5rem] sm:gap-3">
                  <span className="truncate text-oa-fg">{step.label}</span>
                  <span className="relative h-6 rounded-sm bg-oa-bg">
                    <span className="absolute inset-y-0 left-0 rounded-sm bg-oa-primary/70" style={{ width: `${Math.max(step.count > 0 ? 1.5 : 0, (step.count / funnelMax) * 100)}%` }} />
                  </span>
                  <span className={`${NUM} text-right text-oa-fg`}>{fmtCount(step.count)}</span>
                  <span className={`${NUM} hidden text-right text-[12.5px] text-oa-muted-fg sm:block`} title={step.of ? `of ${OF_WORDS[step.of] ?? step.of}` : undefined}>
                    {step.rate == null ? "" : fmtPct(step.rate, step.rate < 0.1 && step.rate > 0 ? 1 : 0)}
                  </span>
                </li>
              ))}
            </ol>
          </Box>
        </div>
        <div className="lg:col-span-4">
          <Box label="Signups by form" right={`${fmtCount(signups)} signups · ${fmtCount(shares)} shares`} flush>
            <RankList
              rows={data.forms.map((r) => ({ key: r.key, label: FORM_WORDS[r.key] ?? r.key, value: r.value, share: r.share }))}
              empty="No newsletter signups yet."
              rowsInView={data.shares.length > 0 ? 5 : 8}
            />
            {data.shares.length > 0 ? (
              <>
                <GroupHead>Shared to</GroupHead>
                <RankList rows={data.shares.map((r) => ({ key: r.key, label: SHARE_WORDS[r.key] ?? r.key, value: r.value, share: r.share }))} empty="" rowsInView={3} />
              </>
            ) : null}
          </Box>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Box label="Routes" flush>
            <PageTable rows={data.pages.routes} />
          </Box>
        </div>
        <div className="lg:col-span-4">
          <Box label="What people did" right={`daily email ${fmtCount(data.brief.on)} on · ${fmtCount(data.brief.off)} off`} flush>
            <ul className="min-h-0 overflow-y-auto">
              {EVENT_ROWS.map(([id, label]) => (
                <li key={id} className="flex h-9 items-center gap-2 border-b border-oa-border/60 px-3 text-[13.5px] last:border-b-0 sm:px-4">
                  <span className="min-w-0 flex-1 truncate text-oa-fg">{label}</span>
                  <span className={`${NUM} text-oa-fg`}>{fmtCount(data.events[id]?.n ?? 0)}</span>
                  <span className={`${NUM} w-12 text-right text-[12.5px] text-oa-muted-fg`} title="people">
                    {fmtCount(data.events[id]?.v ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </Box>
        </div>
      </div>
    </div>
  );
}

function PageTable({ rows }: { rows: Dashboard["pages"]["paths"] }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-center text-[13.5px] text-oa-muted-fg">No pageviews yet.</p>;
  const max = rows[0]!.views || 1;
  return (
    <div className="max-h-[22.5rem] min-h-0 overflow-auto">
      <table className="w-full table-fixed text-[13.5px]">
        <thead className="sticky top-0 z-10 bg-oa-card">
          <tr className="h-9 border-b border-oa-border text-left text-[12.5px] text-oa-muted-fg">
            <th className="px-3 font-normal sm:px-4">Page</th>
            <th className="w-[4.5rem] px-2 text-right font-normal">Views</th>
            <th className="w-[4.5rem] px-2 text-right font-normal">Visitors</th>
            <th className="w-[4.5rem] px-3 text-right font-normal sm:px-4">Exit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="h-9 border-b border-oa-border/60 last:border-b-0">
              <td className="relative truncate px-3 sm:px-4" title={row.key}>
                <span aria-hidden className="absolute inset-y-1 left-1.5 rounded-sm bg-oa-primary/10" style={{ width: `calc(${(row.views / max) * 100}% - 0.75rem)` }} />
                <span className="relative text-oa-fg">{row.key}</span>
              </td>
              <td className={`${NUM} px-2 text-right text-oa-fg`}>{fmtCount(row.views)}</td>
              <td className={`${NUM} px-2 text-right text-oa-fg`}>{row.visitors > 0 || row.exitRate != null ? fmtCount(row.visitors) : ""}</td>
              <td className={`${NUM} px-3 text-right text-oa-muted-fg sm:px-4`}>{row.exitRate == null ? "" : fmtPct(row.exitRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
