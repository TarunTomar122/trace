import { timingSafeEqual } from 'node:crypto';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NUM, Sparkline, Tag } from '@/components/admin-analytics/kit/cells';
import { AdminPage, PageHead } from '@/components/admin-analytics/kit/shell';
import { countryName, flagOf, fmtCount } from '@/components/admin-analytics/format';
import { Box, DeviceIcon, GroupHead, RankList, type RankRow } from '@/components/admin-analytics/parts';
import { VisitorsChart } from '@/components/admin-analytics/visitors-chart';
import { adminDb } from '@/lib/firebase-admin';
import { CONTACT_EMAIL } from '@/lib/site-links';
import { SPONSOR_PLACEMENTS, type SponsorPlacement } from '@/lib/sponsor-link';
import { audienceConfigured, SERVER_CLICK, sponsorAudience, type Breakdown } from '@/lib/sponsor-audience';
import { faviconUrl } from '@/lib/topic-icons';
import '../../admin/analytics/style.css';

// A sponsor's private stats page: /sponsor/{id}?k={stats_token}, in the look of
// /admin/analytics (its kit and tokens, scoped to .traceAdmin). The link is in
// the sponsor's welcome email (backend/v3/flows/send_sponsor_welcome.py writes
// the token). Trace's own counts, by day and by spot:
// - clicks: sponsor_clicks (app/api/tools/click and /api/tools/go)
// - times shown on the site: sponsor_views.views (app/api/tools/seen)
// - daily emails it went out in: sponsor_views.emails (the daily send)
// PostHog adds who clicked and who visited Trace during the run (lib/sponsor-audience).

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sponsor stats · Trace', robots: { index: false, follow: false } };

// Times shown (site views and emails) were first counted from this moment (the
// release that added them); earlier days show clicks only, and that day is partial.
const VIEWS_SINCE_AT = new Date('2026-11-27T17:52:00Z');
const VIEWS_SINCE = VIEWS_SINCE_AT.toISOString().slice(0, 10);

const PLACES: Record<SponsorPlacement, string> = {
  desktop_tools: 'Feed, Tools column (desktop)',
  pulse_mobile: 'Feed, top of Top articles (phones)',
  home_feed_end: 'Feed, end of Home',
  brief_rail: 'Trace Daily pages',
  email: 'Daily email',
  extension: 'Chrome new tab',
};
const SITE_SPOTS = SPONSOR_PLACEMENTS.filter((p) => p !== 'email' && p !== 'extension');

// A favicon for the sources people know by name.
const SOURCE_HOSTS: Record<string, string> = {
  Google: 'google.com', Gmail: 'mail.google.com', 'Google News': 'news.google.com', Gemini: 'gemini.google.com', Bing: 'bing.com',
  DuckDuckGo: 'duckduckgo.com', ChatGPT: 'chatgpt.com', Perplexity: 'perplexity.ai', Claude: 'claude.ai', X: 'x.com',
  'Hacker News': 'news.ycombinator.com', Reddit: 'reddit.com', YouTube: 'youtube.com', TikTok: 'tiktok.com',
  Instagram: 'instagram.com', Facebook: 'facebook.com', LinkedIn: 'linkedin.com', Threads: 'threads.net', Bluesky: 'bsky.app',
  GitHub: 'github.com', 'Product Hunt': 'producthunt.com', Substack: 'substack.com', 'Daily email': 'yourtrace.online',
};

type Doc = Record<string, unknown>;

function when(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const v = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
  if (typeof v.toDate === 'function') return v.toDate();
  const seconds = v.seconds ?? v._seconds;
  if (typeof seconds === 'number') return new Date(seconds * 1000);
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sameToken(given: string, stored: unknown): boolean {
  if (typeof stored !== 'string' || stored.length < 16) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const n = (v: unknown) => Number(v || 0);
const sum = (rows: Doc[], field: string) => rows.reduce((total, r) => total + n(r[field]), 0);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-11-27" -> "Nov 27". */
const dayLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const dateLabel = (d: Date) => `${dayLabel(d.toISOString().slice(0, 10))}, ${d.getUTCFullYear()}`;
const nextDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

/** "2.4%", or a dash when nothing was shown to divide by. */
function rate(clicks: number, shown: number): string {
  if (shown <= 0) return '—';
  const pct = (clicks / shown) * 100;
  return `${pct >= 10 || pct === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

/** Every UTC day from start to end, inclusive, as YYYY-MM-DD. */
function daysBetween(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  while (cursor.getTime() <= end.getTime() && days.length < 400) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** A breakdown as the kit's ranked-list rows. */
function rankRows(list: Breakdown, label: (key: string) => ReactNode, icon?: (key: string) => ReactNode): RankRow[] {
  const total = list.reduce((t, r) => t + r.count, 0) || 1;
  return list.map((r) => ({ key: r.label, label: label(r.label), icon: icon?.(r.label), value: r.count, share: r.count / total }));
}

const countryLabel = (code: string) => (code === SERVER_CLICK ? 'Email or new tab' : code === 'Other' ? 'Other' : countryName(code));
const countryIcon = (code: string) =>
  code === SERVER_CLICK || code === 'Other' ? null : <span aria-hidden className="text-[15px] leading-none">{flagOf(code)}</span>;
const DEVICE_WORDS: Record<string, string> = { desktop: 'Desktop', mobile: 'Phone', tablet: 'Tablet', unknown: 'Unknown', [SERVER_CLICK]: 'Email or new tab' };
const deviceLabel = (key: string) => DEVICE_WORDS[key] ?? key;
const deviceIcon = (key: string) => (['desktop', 'mobile', 'tablet'].includes(key) ? <DeviceIcon kind={key} /> : null);
function sourceIcon(label: string) {
  const host = SOURCE_HOSTS[label];
  if (!host) return null;
  // eslint-disable-next-line @next/next/no-img-element -- a source's favicon
  return <img src={faviconUrl(host, 32)} alt="" width={16} height={16} loading="lazy" className="size-4 rounded-[3px]" />;
}

/** A headline tile, as /admin/analytics draws them, with a note where that page shows the change. */
function Stat({ label, value, note, spark }: { label: string; value: string; note: string; spark?: Array<number | null> }) {
  return (
    <div className="-mb-px -mr-px flex min-w-0 flex-col gap-1 border-b border-r border-oa-border px-3 py-2.5 sm:px-4">
      <dt className="oa-caption truncate">{label}</dt>
      <dd className="flex items-end justify-between gap-2">
        <span className={`${NUM} text-[22px] font-semibold leading-7 tracking-[-0.01em] text-oa-fg`}>{value}</span>
        {spark ? <Sparkline values={spark} width={56} height={22} tone="flat" className="mb-1 hidden sm:block" /> : null}
      </dd>
      <dd className={`${NUM} truncate text-[12.5px] leading-4 text-oa-muted-fg`} title={note}>
        {note || ' '}
      </dd>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="px-3 py-6 text-center text-[13.5px] text-oa-muted-fg sm:px-4">{children}</p>;
}

export default async function SponsorStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const [{ id }, { k }] = await Promise.all([params, searchParams]);
  if (!adminDb || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) notFound();
  const db = adminDb;
  const snap = await db.collection('promoted_tools').doc(id).get();
  const sponsor = (snap.exists ? snap.data() : null) as Doc | null;
  if (!sponsor || !sameToken(String(k || ''), sponsor.stats_token)) notFound();

  // created_at, not activated_at: a renewal payment resets activated_at.
  const started = when(sponsor.created_at) || when(sponsor.activated_at);
  const ends = when(sponsor.expires_at);
  const now = new Date();
  const live = sponsor.status === 'active' && (!ends || ends.getTime() > now.getTime());

  const [clickDocs, viewDocs, audience] = await Promise.all([
    db.collection('sponsor_clicks').where('sponsor_id', '==', id).get(),
    db.collection('sponsor_views').where('sponsor_id', '==', id).get(),
    // The breakdowns are extra: the page shows without them when analytics is slow or down.
    started ? sponsorAudience(id, started.toISOString(), ends ? ends.toISOString() : '').catch(() => null) : Promise.resolve(null),
  ]);
  const clickRows = clickDocs.docs.map((d) => d.data() as Doc);
  const viewRows = viewDocs.docs.map((d) => d.data() as Doc);

  // A sponsor that started before views were counted: its first counted day is
  // partial, and click rates use only the days counted in full.
  const viewsStartedLate = Boolean(started && started < VIEWS_SINCE_AT);
  const fullDay = (day: unknown) => !viewsStartedLate || String(day) > VIEWS_SINCE;
  const rated = (rows: Doc[]) => rows.filter((r) => fullDay(r.day));
  const ratesFrom = dayLabel(nextDay(VIEWS_SINCE));
  const rateNote = (c: number, shownCount: number, what: string) =>
    shownCount > 0
      ? `${fmtCount(c)} clicks / ${fmtCount(shownCount)} ${what}`
      : viewsStartedLate && now.toISOString().slice(0, 10) <= VIEWS_SINCE
        ? `starts ${ratesFrom}`
        : `no ${what} yet`;

  const clicks = sum(clickRows, 'clicks');
  const siteViews = sum(viewRows, 'views');
  const emails = sum(viewRows, 'emails');
  const shown = siteViews + emails;
  const siteClicksRated = SITE_SPOTS.reduce((t, p) => t + sum(rated(clickRows), `clicks_${p}`), 0);
  const siteViewsRated = sum(rated(viewRows), 'views');
  const emailClicksRated = sum(rated(clickRows), 'clicks_email');
  const emailsRated = sum(rated(viewRows), 'emails');

  // Every day of the run so far (or the whole run once it ended), oldest first.
  type DayRow = { day: string; views: number; emails: number; clicks: number; ratedClicks: number };
  // A run ending at 00:10 doesn't add an empty day.
  const lastDay = ends && ends < now ? new Date(ends.getTime() - 1) : now;
  const byDay = new Map<string, DayRow>();
  const dayRow = (day: string) => byDay.get(day) ?? byDay.set(day, { day, views: 0, emails: 0, clicks: 0, ratedClicks: 0 }).get(day)!;
  for (const day of started ? daysBetween(started, lastDay) : []) dayRow(day);
  for (const r of viewRows) {
    const row = dayRow(String(r.day));
    row.views += n(r.views);
    row.emails += n(r.emails);
  }
  for (const r of clickRows) {
    const row = dayRow(String(r.day));
    row.clicks += n(r.clicks);
    // New-tab views aren't counted, so their clicks stay out of the rate.
    row.ratedClicks += n(r.clicks) - n(r.clicks_extension);
  }
  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  // Days before views were counted have no "shown" number: the chart starts where counting did.
  const counted = (d: DayRow) => !viewsStartedLate || d.day >= VIEWS_SINCE;
  const shownSpark = (pick: (d: DayRow) => number) => days.map((d) => (counted(d) ? pick(d) : null));
  const maxShown = Math.max(1, ...days.map((d) => d.views + d.emails));

  const spots = SPONSOR_PLACEMENTS.map((p) => {
    const views = (rows: Doc[]) => (p === 'email' ? sum(rows, 'emails') : sum(rows, `views_${p}`));
    return {
      key: p,
      place: PLACES[p],
      clicks: sum(clickRows, `clicks_${p}`),
      shown: p === 'extension' ? null : views(viewRows),
      rate: p === 'extension' ? '—' : rate(sum(rated(clickRows), `clicks_${p}`), views(rated(viewRows))),
    };
  });
  const clickSpots: RankRow[] = spots
    .filter((s) => s.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks)
    .map((s) => ({ key: s.key, label: s.place, value: s.clicks, share: clicks ? s.clicks / clicks : 0 }));

  const runDays = started && ends ? Math.max(1, Math.round((ends.getTime() - started.getTime()) / DAY_MS)) : null;
  const dayOfRun = started ? Math.min(runDays ?? Infinity, Math.floor((now.getTime() - started.getTime()) / DAY_MS) + 1) : null;
  const daysLeft = live && ends ? Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / DAY_MS)) : null;
  const host =
    String(sponsor.host || '').trim() ||
    (() => {
      try {
        return new URL(String(sponsor.url || '')).hostname.replace(/^www\./, '');
      } catch {
        return '';
      }
    })();
  const who = audience?.clicks;
  const site = audience?.site;
  const unavailable = audienceConfigured() ? 'Not available right now. Reload in a few minutes.' : 'Not available for this page.';
  const clickNote = (body: ReactNode) =>
    clicks === 0 && (!who || who.clicks === 0) ? (
      <Note>No clicks yet.</Note>
    ) : !who ? (
      <Note>{unavailable}</Note>
    ) : who.clicks === 0 ? (
      <Note>Not picked up by our analytics yet.</Note>
    ) : (
      body
    );

  return (
    <AdminPage>
      <PageHead
        crumb="Trace / Sponsor stats"
        title={String(sponsor.title || host || 'Your sponsor spot')}
        meta={
          <span>
            {host ? (
              <a href={String(sponsor.url || '')} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {/* .traceAdmin a { color: inherit } wins over a class on the link itself. */}
                <span className="text-oa-fg">{host}</span>
              </a>
            ) : null}
            {[started ? `${dateLabel(started)} to ${ends ? dateLabel(ends) : 'open-ended'}` : '', 'Days in UTC']
              .filter(Boolean)
              .map((part, i) => `${host || i > 0 ? ' · ' : ''}${part}`)
              .join('')}
          </span>
        }
        actions={
          <>
            <Tag tone={live ? 'up' : 'neutral'}>{live ? 'Live' : 'Ended'}</Tag>
            {live && dayOfRun && runDays ? <Tag caps={false}>{`Day ${dayOfRun} of ${runDays}`}</Tag> : null}
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <dl className="oa-surface grid grid-cols-2 overflow-hidden border border-oa-border bg-oa-card md:grid-cols-4 2xl:grid-cols-8">
          <Stat label="Times shown" value={fmtCount(shown)} note="site views + emails" spark={shownSpark((d) => d.views + d.emails)} />
          <Stat label="Seen on the site" value={fmtCount(siteViews)} note="half on screen for 1s" spark={shownSpark((d) => d.views)} />
          <Stat label="In daily emails" value={fmtCount(emails)} note="emails sent with it" spark={shownSpark((d) => d.emails)} />
          <Stat label="Clicks" value={fmtCount(clicks)} note={`to ${host || 'your site'}`} spark={days.map((d) => d.clicks)} />
          <Stat label="Click rate, site" value={rate(siteClicksRated, siteViewsRated)} note={rateNote(siteClicksRated, siteViewsRated, 'views')} />
          <Stat label="Click rate, email" value={rate(emailClicksRated, emailsRated)} note={rateNote(emailClicksRated, emailsRated, 'emails')} />
          <Stat label="People who clicked" value={who ? fmtCount(who.people) : '—'} note={who ? 'at least, from analytics' : 'analytics unavailable'} />
          <Stat label="Days left" value={daysLeft == null ? '—' : String(daysLeft)} note={ends ? `${live ? 'until' : 'ended'} ${dateLabel(ends)}` : ''} />
        </dl>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Box
              label="Shown and clicks"
              right={
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 rounded bg-oa-primary" />
                    Shown
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 rounded bg-oa-muted-fg" />
                    Clicks
                  </span>
                </span>
              }
            >
              <VisitorsChart
                points={days.filter(counted).map((d) => ({ label: d.day, visitors: d.views + d.emails, pageviews: d.clicks }))}
                names={{ visitors: 'Shown', pageviews: 'Clicks' }}
              />
            </Box>
          </div>
          <div className="lg:col-span-4">
            <Box label="Clicks by spot" right={`${fmtCount(clicks)} clicks`} flush>
              <RankList rows={clickSpots} empty="No clicks yet." rowsInView={6} />
            </Box>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Box label="Clickers came from" right={who && who.clicks > 0 ? `${fmtCount(who.clicks)} seen by analytics` : undefined} flush>
            {clickNote(<RankList rows={rankRows(who?.sources ?? [], (key) => key, sourceIcon)} empty="No clicks yet." rowsInView={7} />)}
          </Box>
          <Box label="Clickers by country" flush>
            {clickNote(<RankList rows={rankRows(who?.countries ?? [], countryLabel, countryIcon)} empty="No clicks yet." rowsInView={7} />)}
          </Box>
          <Box label="Clickers by device" flush>
            {clickNote(<RankList rows={rankRows(who?.devices ?? [], deviceLabel, deviceIcon)} empty="No clicks yet." rowsInView={4} />)}
          </Box>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Box label="By day" right="newest first" flush>
              <div className="max-h-[22.5rem] min-h-0 overflow-auto">
                <table className="w-full table-fixed text-[13.5px]">
                  <thead className="sticky top-0 z-10 bg-oa-card">
                    <tr className="h-9 border-b border-oa-border text-left text-[12.5px] text-oa-muted-fg">
                      <th className="px-3 font-normal sm:px-4">Day</th>
                      <th className="w-[3.25rem] sm:w-[4.5rem] px-2 text-right font-normal">Site</th>
                      <th className="w-[3.25rem] sm:w-[4.5rem] px-2 text-right font-normal">Emails</th>
                      <th className="w-[3.25rem] sm:w-[4.5rem] px-2 text-right font-normal">Clicks</th>
                      <th className="w-[3.25rem] sm:w-[4.5rem] px-3 text-right font-normal sm:px-4">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...days].reverse().map((d) => {
                      const before = viewsStartedLate && d.day < VIEWS_SINCE;
                      const partial = viewsStartedLate && d.day === VIEWS_SINCE;
                      return (
                        <tr key={d.day} className="h-9 border-b border-oa-border/60 last:border-b-0">
                          <td className="relative truncate px-3 sm:px-4">
                            <span
                              aria-hidden
                              className="absolute inset-y-1 left-1.5 rounded-sm bg-oa-primary/10"
                              style={{ width: `calc(${((d.views + d.emails) / maxShown) * 100}% - 0.75rem)` }}
                            />
                            <span className="relative text-oa-fg">{dayLabel(d.day)}</span>
                            {partial ? <span className="relative text-[12px] text-oa-muted-fg">{' · partial'}</span> : null}
                          </td>
                          <td className={`${NUM} px-2 text-right text-oa-fg`}>{before ? '—' : fmtCount(d.views)}</td>
                          <td className={`${NUM} px-2 text-right text-oa-fg`}>{before ? '—' : fmtCount(d.emails)}</td>
                          <td className={`${NUM} px-2 text-right text-oa-fg`}>{fmtCount(d.clicks)}</td>
                          <td className={`${NUM} px-3 text-right text-oa-muted-fg sm:px-4`}>{fullDay(d.day) ? rate(d.ratedClicks, d.views + d.emails) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {days.length === 0 ? <Note>Nothing yet.</Note> : null}
              </div>
            </Box>
          </div>
          <div className="lg:col-span-4">
            <Box label="Trace during your run" right="each visitor once" flush>
              {!site ? (
                <Note>{unavailable}</Note>
              ) : (
                <>
                  <ul>
                    {(
                      [
                        ['Visitors to yourtrace.online', site.visitors],
                        ['Opened the feed, a story or a Daily page', site.sawSpots],
                        ['Pages viewed', site.pageviews],
                      ] as const
                    ).map(([label, value]) => (
                      <li key={label} className="flex h-9 items-center gap-2 border-b border-oa-border/60 px-3 text-[13.5px] sm:px-4">
                        <span className="min-w-0 flex-1 truncate text-oa-fg">{label}</span>
                        <span className={`${NUM} text-oa-fg`}>{fmtCount(value)}</span>
                      </li>
                    ))}
                  </ul>
                  <GroupHead>Came from</GroupHead>
                  <RankList rows={rankRows(site.sources, (key) => key, sourceIcon)} empty="No visits yet." rowsInView={5} />
                  <GroupHead>Countries</GroupHead>
                  <RankList rows={rankRows(site.countries, countryLabel, countryIcon)} empty="No visits yet." rowsInView={5} />
                  <GroupHead>Devices</GroupHead>
                  <RankList rows={rankRows(site.devices, deviceLabel, deviceIcon)} empty="No visits yet." rowsInView={3} />
                </>
              )}
            </Box>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Box label="By spot" right="code = utm_content" flush>
              <table className="w-full table-fixed text-[13.5px]">
                <thead>
                  <tr className="h-9 border-b border-oa-border text-left text-[12.5px] text-oa-muted-fg">
                    <th className="px-3 font-normal sm:px-4">Spot</th>
                    <th className="w-[3.25rem] sm:w-[4.5rem] px-2 text-right font-normal">Shown</th>
                    <th className="w-[3.25rem] sm:w-[4.5rem] px-2 text-right font-normal">Clicks</th>
                    <th className="w-[3.25rem] sm:w-[4.5rem] px-3 text-right font-normal sm:px-4">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {spots.map((s) => (
                    <tr key={s.key} className="border-b border-oa-border/60 last:border-b-0">
                      <td className="px-3 py-2 sm:px-4">
                        <span className="block truncate text-oa-fg">{s.place}</span>
                        <code className="oa-mono block truncate text-[12px] text-oa-muted-fg">{s.key}</code>
                      </td>
                      <td className={`${NUM} px-2 text-right text-oa-fg`} title={s.shown == null ? 'New-tab views are not counted yet' : undefined}>
                        {s.shown == null ? '—' : fmtCount(s.shown)}
                      </td>
                      <td className={`${NUM} px-2 text-right text-oa-fg`}>{fmtCount(s.clicks)}</td>
                      <td className={`${NUM} px-3 text-right text-oa-muted-fg sm:px-4`}>{s.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </div>
          <div className="lg:col-span-4">
            <Box label="How we count">
              <div className="space-y-2 text-[13px] leading-5 text-oa-muted-fg">
                <p>
                  A site view is your card at least half on screen for a second, once per visit. An email is one daily email sent with your card in it; opens
                  aren&apos;t tracked.
                </p>
                <p>Clicks are counted by Trace, with known bots left out. New-tab cards count clicks, not views.</p>
                {viewsStartedLate ? (
                  <p>
                    Views and emails are counted from {dateLabel(VIEWS_SINCE_AT)}, {VIEWS_SINCE_AT.toISOString().slice(11, 16)} UTC. Click rates start the day
                    after.
                  </p>
                ) : null}
                <p>
                  Visits from Trace arrive tagged <code className="oa-mono text-oa-fg">utm_source=trace</code> and <code className="oa-mono text-oa-fg">utm_medium=sponsored</code>, with
                  the spot in <code className="oa-mono text-oa-fg">utm_content</code>. Your own count can run a little lower: some visitors leave before your page loads, and some block
                  analytics.
                </p>
                <p>Countries, devices and sources come from our analytics, refreshed about every 10 minutes.</p>
                <p>
                  Questions, or a new title, description or link?{' '}
                  <a className="font-medium hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                    <span className="text-oa-primary">{CONTACT_EMAIL}</span>
                  </a>
                </p>
              </div>
            </Box>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
