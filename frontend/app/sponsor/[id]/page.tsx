import { timingSafeEqual } from 'node:crypto';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { CONTACT_EMAIL } from '@/lib/site-links';
import { SPONSOR_PLACEMENTS, type SponsorPlacement } from '@/lib/sponsor-link';
import { audienceConfigured, sponsorAudience, type Breakdown } from '@/lib/sponsor-audience';

// A sponsor's private stats page: /sponsor/{id}?k={stats_token}. The link is
// in their welcome email (backend/v3/flows/send_sponsor_welcome.py writes the
// token). Trace's own counts, by day and by spot:
// - clicks: sponsor_clicks (app/api/tools/click and /api/tools/go)
// - times shown on the site: sponsor_views.views (app/api/tools/seen)
// - daily emails it went out in: sponsor_views.emails (the daily send)
// PostHog adds who clicked and who visited Trace during the run (lib/sponsor-audience).

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sponsor stats — Trace', robots: { index: false, follow: false } };

// Times shown (site views and emails) were first counted from this moment;
// earlier days show clicks only, and that day is partly counted.
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
const SITE_SPOTS = SPONSOR_PLACEMENTS.filter((p) => p !== 'email' && p !== 'extension');
const n = (v: unknown) => Number(v || 0);
const fmt = (v: number) => v.toLocaleString('en-US');
const longDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "2.4%", or a dash when nothing was shown to divide by. */
function rate(clicks: number, shown: number): string {
  if (shown <= 0) return '—';
  const pct = (clicks / shown) * 100;
  return `${pct >= 10 || pct === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

function rateNote(clicks: number, shown: number, what: string, fromNextDay: boolean): string {
  const base = `${fmt(clicks)} clicks / ${fmt(shown)} ${what}`;
  return fromNextDay ? `${base}, from ${shortDay(nextDay(VIEWS_SINCE))}` : base;
}

const nextDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

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

const sum = (rows: Doc[], field: string) => rows.reduce((total, r) => total + n(r[field]), 0);

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

  // created before views were counted: that sponsor's first counted day is partial,
  // and click rates use only the days counted in full.
  const viewsStartedLate = Boolean(started && started < VIEWS_SINCE_AT);
  const fullDay = (day: unknown) => !viewsStartedLate || String(day) > VIEWS_SINCE;
  const rated = (rows: Doc[]) => rows.filter((r) => fullDay(r.day));

  const clicks = sum(clickRows, 'clicks');
  const siteViews = sum(viewRows, 'views');
  const emails = sum(viewRows, 'emails');
  const shown = siteViews + emails;
  const siteClicksRated = SITE_SPOTS.reduce((t, p) => t + sum(rated(clickRows), `clicks_${p}`), 0);
  const siteViewsRated = sum(rated(viewRows), 'views');
  const emailClicksRated = sum(rated(clickRows), 'clicks_email');
  const emailsRated = sum(rated(viewRows), 'emails');

  // Days of the run so far (or the whole run once it ended), newest first.
  type DayRow = { views: number; emails: number; clicks: number; ratedClicks: number };
  const blank = (): DayRow => ({ views: 0, emails: 0, clicks: 0, ratedClicks: 0 });
  const lastDay = ends && ends < now ? ends : now;
  const byDay = new Map<string, DayRow>();
  for (const day of started ? daysBetween(started, lastDay) : []) byDay.set(day, blank());
  for (const r of viewRows) {
    const row = byDay.get(String(r.day)) ?? blank();
    row.views += n(r.views);
    row.emails += n(r.emails);
    byDay.set(String(r.day), row);
  }
  for (const r of clickRows) {
    const row = byDay.get(String(r.day)) ?? blank();
    row.clicks += n(r.clicks);
    // New-tab views aren't counted, so their clicks stay out of the rate.
    row.ratedClicks += n(r.clicks) - n(r.clicks_extension);
    byDay.set(String(r.day), row);
  }
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const maxShown = Math.max(1, ...days.map(([, d]) => d.views + d.emails));

  const spots = SPONSOR_PLACEMENTS.map((p) => {
    const views = (rows: Doc[]) => (p === 'email' ? sum(rows, 'emails') : sum(rows, `views_${p}`));
    return {
      key: p,
      place: PLACES[p],
      clicks: sum(clickRows, `clicks_${p}`),
      shown: views(viewRows),
      rate: rate(sum(rated(clickRows), `clicks_${p}`), views(rated(viewRows))),
      counted: p !== 'extension',
    };
  });

  const runDays = started && ends ? Math.max(1, Math.round((ends.getTime() - started.getTime()) / DAY_MS)) : null;
  const dayOfRun = started ? Math.min(runDays ?? Infinity, Math.floor((now.getTime() - started.getTime()) / DAY_MS) + 1) : null;
  const daysLeft = live && ends ? Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / DAY_MS)) : null;
  const host = String(sponsor.host || '').trim() || (() => {
    try {
      return new URL(String(sponsor.url || '')).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  const clickAudience = audience?.clicks;
  const site = audience?.site;
  const unavailable = audienceConfigured() ? 'Not available right now. Try again in a few minutes.' : 'Not available for this page.';

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#0f1419]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <main className="mx-auto max-w-[880px] px-4 py-10 sm:px-8 sm:py-14">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo */}
          <img src="/trace.webp" alt="" className="h-6 w-auto" />
          <span className="text-[17px] font-extrabold tracking-[-0.02em]">Trace</span>
        </Link>

        <header className="mt-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#1634cc]">Sponsor stats</p>
            <h1 className="mt-2 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-[34px]">{String(sponsor.title || '')}</h1>
            <p className="mt-2 text-[14px] leading-[1.6] text-[#536471]">
              {host && (
                <>
                  <a className="font-semibold text-[#0f1419] underline-offset-2 hover:underline" href={String(sponsor.url || '')} target="_blank" rel="noopener noreferrer">
                    {host}
                  </a>
                  {' · '}
                </>
              )}
              {started ? `${longDay(started)} to ${ends ? longDay(ends) : 'open-ended'}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[13px] font-semibold">
            <span className={`rounded-full px-3 py-1 ${live ? 'bg-[#e7f6ec] text-[#137333]' : 'bg-[#f1f1f1] text-[#536471]'}`}>{live ? 'Live' : 'Ended'}</span>
            {live && dayOfRun && runDays && <span className="rounded-full bg-white px-3 py-1 ring-1 ring-[#e5e5e5]">Day {dayOfRun} of {runDays}</span>}
            {daysLeft !== null && <span className="rounded-full bg-white px-3 py-1 ring-1 ring-[#e5e5e5]">{daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}</span>}
          </div>
        </header>

        <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Times shown" value={fmt(shown)} note={`${fmt(siteViews)} on the site · ${fmt(emails)} in emails`} />
          <Stat
            label="Clicks"
            value={fmt(clicks)}
            note={clickAudience && clickAudience.people > 0 ? `from at least ${fmt(clickAudience.people)} ${clickAudience.people === 1 ? 'person' : 'people'}` : `to ${host || 'your site'}`}
          />
          <Stat label="Click rate, site" value={rate(siteClicksRated, siteViewsRated)} note={rateNote(siteClicksRated, siteViewsRated, 'views', viewsStartedLate)} />
          <Stat label="Click rate, email" value={rate(emailClicksRated, emailsRated)} note={rateNote(emailClicksRated, emailsRated, 'emails', viewsStartedLate)} />
        </section>

        <Card title="By day" subtitle="UTC. Site is your card seen on the site; emails is daily emails sent with it.">
          <div className="overflow-x-auto">
            <table className="w-full text-[14px] tabular-nums">
              <thead>
                <tr className="text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8b98a5]">
                  <th className="py-2 pr-3 font-semibold">Day</th>
                  <th className="hidden w-[34%] py-2 pr-3 font-semibold sm:table-cell" aria-label="Times shown, bar" />
                  <th className="py-2 pr-3 text-right font-semibold">Site</th>
                  <th className="py-2 pr-3 text-right font-semibold">Emails</th>
                  <th className="py-2 pr-3 text-right font-semibold">Clicks</th>
                  <th className="py-2 text-right font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody>
                {days.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-[#536471]">Nothing yet.</td>
                  </tr>
                )}
                {days.map(([day, d]) => (
                  <tr key={day} className="border-t border-[#eff3f4]">
                    <td className="whitespace-nowrap py-2 pr-3">
                      {shortDay(day)}
                      {viewsStartedLate && day === VIEWS_SINCE && <span className="ml-1.5 rounded bg-[#fff4d6] px-1 text-[11px] font-semibold text-[#8a6100]">partial</span>}
                    </td>
                    <td className="hidden py-2 pr-3 sm:table-cell">
                      <div className="flex h-2 overflow-hidden rounded-full bg-[#f1f3f5]">
                        <div className="bg-[#1634cc]" style={{ width: `${(d.views / maxShown) * 100}%` }} />
                        <div className="bg-[#8fa2f0]" style={{ width: `${(d.emails / maxShown) * 100}%` }} />
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right">{day < VIEWS_SINCE ? '—' : fmt(d.views)}</td>
                    <td className="py-2 pr-3 text-right">{day < VIEWS_SINCE ? '—' : fmt(d.emails)}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{fmt(d.clicks)}</td>
                    <td className="py-2 text-right text-[#536471]">{fullDay(day) ? rate(d.ratedClicks, d.views + d.emails) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 hidden flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#536471] sm:flex">
            <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full bg-[#1634cc]" />Seen on the site</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full bg-[#8fa2f0]" />Daily emails sent</span>
          </p>
        </Card>

        <Card title="By spot" subtitle="Where your card appears. The code is the utm_content tag on visits from that spot.">
          <div className="overflow-x-auto">
            <table className="w-full text-[14px] tabular-nums">
              <thead>
                <tr className="text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8b98a5]">
                  <th className="py-2 pr-3 font-semibold">Spot</th>
                  <th className="py-2 pr-3 text-right font-semibold">Shown</th>
                  <th className="py-2 pr-3 text-right font-semibold">Clicks</th>
                  <th className="py-2 text-right font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody>
                {spots.map((s) => (
                  <tr key={s.key} className="border-t border-[#eff3f4]">
                    <td className="py-2 pr-3">
                      {s.place} <code className="mt-0.5 block w-fit rounded bg-[#f4f4f5] px-1 text-[12px] text-[#536471] sm:ml-1 sm:mt-0 sm:inline">{s.key}</code>
                    </td>
                    <td className="py-2 pr-3 text-right">{s.counted ? fmt(s.shown) : 'not counted'}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{fmt(s.clicks)}</td>
                    <td className="py-2 text-right text-[#536471]">{s.counted ? s.rate : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Who clicked" subtitle={clickAudience ? `${fmt(clickAudience.clicks)} clicks our analytics saw. It misses people who block analytics, so it can be lower than the count above.` : undefined}>
          {clicks === 0 && (!clickAudience || clickAudience.clicks === 0) ? (
            <p className="text-[14px] text-[#536471]">No clicks yet.</p>
          ) : !clickAudience ? (
            <p className="text-[14px] text-[#536471]">{unavailable}</p>
          ) : clickAudience.clicks === 0 ? (
            <p className="text-[14px] text-[#536471]">Our analytics hasn&apos;t picked these clicks up yet. It can take about 10 minutes, and it misses people who block analytics.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3">
              <Bars title="Country" rows={clickAudience.countries} />
              <Bars title="Device" rows={clickAudience.devices} />
              <Bars title="Came to Trace from" rows={clickAudience.sources} />
            </div>
          )}
        </Card>

        <Card
          title="Trace's audience during your run"
          subtitle={site ? `Everyone who visited yourtrace.online since ${started ? longDay(started) : 'your start'}, counted once each.` : undefined}
        >
          {!site ? (
            <p className="text-[14px] text-[#536471]">{unavailable}</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Mini label="Visitors" value={fmt(site.visitors)} />
                <Mini label="Opened the feed, a story or a Trace Daily page" value={fmt(site.sawSpots)} />
                <Mini label="Pages viewed" value={fmt(site.pageviews)} />
              </div>
              {site.visitors > 0 && (
                <div className="mt-6 grid gap-6 sm:grid-cols-3">
                  <Bars title="Country" rows={site.countries} />
                  <Bars title="Device" rows={site.devices} />
                  <Bars title="Came from" rows={site.sources} />
                </div>
              )}
            </>
          )}
        </Card>

        <section className="mt-8 space-y-3 text-[13px] leading-[1.7] text-[#536471]">
          <p>
            <strong className="text-[#0f1419]">How we count.</strong> A view on the site is your card at least half on screen for a second,
            once per visit. An email is one daily email sent with your card in it; we don&apos;t track opens. Cards in the Chrome new tab
            aren&apos;t counted as views yet, only their clicks. Clicks are counted by Trace from real visitors, with known bots left out.
            {viewsStartedLate ? ` We started counting views and emails on ${longDay(VIEWS_SINCE_AT)} at ${VIEWS_SINCE_AT.toISOString().slice(11, 16)} UTC, so earlier days show clicks only and click rates start the day after.` : ''}
            {' '}Country, device and source come from our analytics and refresh about every 10 minutes.
          </p>
          <p>
            In your own analytics, visits from Trace arrive tagged <code className="rounded bg-[#f1f1f1] px-1">utm_source=trace</code> and{' '}
            <code className="rounded bg-[#f1f1f1] px-1">utm_medium=sponsored</code>, with the spot in <code className="rounded bg-[#f1f1f1] px-1">utm_content</code>.
            Your numbers can run a little lower than ours: some visitors leave before your page loads, and some block analytics.
          </p>
          <p>
            Questions, or want to change your title, description or link?{' '}
            <a className="font-semibold text-[#1634cc]" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-[#e5e5e5] sm:p-5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8b98a5]">{label}</p>
      <p className="mt-2 text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums sm:text-[34px]">{value}</p>
      <p className="mt-2 text-[12px] leading-[1.5] text-[#536471]">{note}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f7f8f9] p-3">
      <p className="text-[22px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">{value}</p>
      <p className="mt-1.5 text-[12px] leading-[1.4] text-[#536471]">{label}</p>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-xl bg-white p-4 ring-1 ring-[#e5e5e5] sm:p-6">
      <h2 className="text-[16px] font-bold">{title}</h2>
      {subtitle && <p className="mt-1 text-[13px] leading-[1.5] text-[#536471]">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bars({ title, rows }: { title: string; rows: Breakdown }) {
  const total = rows.reduce((t, r) => t + r.count, 0);
  return (
    <div>
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8b98a5]">{title}</h3>
      <ul className="mt-2 space-y-2">
        {rows.map((r) => {
          const share = total ? Math.round((r.count / total) * 100) : 0;
          return (
            <li key={r.label} className="text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate" title={r.label}>{r.label}</span>
                <span className="shrink-0 tabular-nums text-[#536471]">
                  {fmt(r.count)} <span className="text-[#8b98a5]">· {share}%</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f1f3f5]">
                <div className="h-full rounded-full bg-[#1634cc]" style={{ width: `${share}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
