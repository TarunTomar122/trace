'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * The email at a glance, laid out like mailcheap's overview and beehiiv's
 * post list: six headline numbers for the last 30 days, the readership line,
 * where new readers came from, and one row per morning send.
 */

type WindowStats = {
  days: number;
  sent: number;
  tracked: number;
  delivered: number | null;
  opened: number | null;
  clicked: number | null;
  bounced: number | null;
  unsubscribed: number | null;
  unsubscribes: number;
  joined: number;
};

export type EmailOverviewData = {
  overview: {
    current: WindowStats;
    previous: WindowStats;
    comparable: boolean;
    readersDays: string[];
    readers: (number | null)[];
    readersNow: number;
    readersSplit: { members: number; emailOnly: number; day: string };
    issues: {
      day: string;
      subject: string;
      recipients: number;
      members: number;
      landing: number;
      winback: number;
      tracked: number;
      opened: number | null;
      clicked: number | null;
      unsubscribes: number;
      joined: number;
    }[];
  };
  series: { days: string[]; newSubs: Record<string, number>; emailVisits: Record<string, number> };
  growth: {
    newSubs: number;
    newSubsStillOn: number;
    sources: [string, number][];
    listActive: number;
    accountsDailyOn: number;
    topicsPicked: number;
    winbackSends: Record<string, number>;
    emailVisitors: number | null;
    recentSignups: { at: string; email: string; source: string; active: boolean; hasAccount: boolean }[];
  };
};

const SOURCE_LABELS: Record<string, string> = {
  landing_page: 'Homepage',
  daily_page: 'Brief page',
  featured_page: 'Story page',
  blog: 'Blog',
  feed_prompt: 'Feed prompt',
};

const TOOLTIP = { fontSize: 12, borderRadius: 12, color: '#111' };
const TOOLTIP_LABEL = { color: '#555' };

const PANEL = 'rounded-2xl border border-black/[0.08] bg-white dark:border-white/10 dark:bg-white/[0.03]';

function shortDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function fmt(n: number) {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString();
}

/** "+1.2 pts" for rates, "+12%" for counts; green when it moved the good way. */
function Delta({ now, before, kind, goodWhenUp, comparable }: {
  now: number | null;
  before: number | null;
  kind: 'rate' | 'count';
  goodWhenUp: boolean;
  comparable: boolean;
}) {
  if (!comparable || now === null || before === null) {
    return <span className="text-secondary/40">&nbsp;</span>;
  }
  let change: number;
  let label: string;
  if (kind === 'rate') {
    change = Math.round((now - before) * 10) / 10;
    label = `${change > 0 ? '+' : ''}${change} pts`;
  } else {
    if (!before) return <span className="text-secondary/40">new</span>;
    change = Math.round(((now - before) / before) * 100);
    label = `${change > 0 ? '+' : ''}${change}%`;
  }
  if (change === 0) return <span className="text-secondary/50">no change</span>;
  const good = goodWhenUp ? change > 0 : change < 0;
  return <span className={good ? 'text-green-600' : 'text-red-500'}>{label}</span>;
}

function Kpi({ label, value, help, children }: {
  label: string;
  value: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4" title={help}>
      <p className="text-[13px] text-secondary/60">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs tabular-nums">{children}</p>
    </div>
  );
}

const pct = (n: number | null) => (n === null ? '—' : `${n}%`);

export default function EmailOverview({ data }: { data: EmailOverviewData }) {
  const { overview, growth } = data;
  const { current, previous, comparable } = overview;

  // Last 30 days on the solid line, the 30 before dashed behind it, day for day.
  const readersChart = useMemo(() => {
    const days = overview.readersDays;
    return days.slice(30).map((day, i) => ({
      day: shortDay(day),
      'Last 30 days': overview.readers[30 + i],
      ...(comparable ? { 'Previous 30 days': overview.readers[i] } : {}),
    }));
  }, [overview, comparable]);
  const firstReaders = overview.readers.slice(30).find((n) => n !== null) ?? null;
  const readerChange = firstReaders === null ? null : overview.readersNow - firstReaders;
  // The dashed line only once there's a full earlier month to compare with.
  const hasPrevious = comparable && overview.readers.slice(0, 30).some((n) => n !== null);

  const joinedChart = useMemo(
    () => data.series.days.map((day) => ({ day: shortDay(day), 'New subscribers': data.series.newSubs[day] ?? 0 })),
    [data.series]
  );
  const visitsChart = useMemo(
    () => data.series.days.map((day) => ({ day: shortDay(day), Visitors: data.series.emailVisits[day] ?? 0 })),
    [data.series]
  );

  const winbackTotal = ['1', '2', '3'].reduce((acc, n) => acc + (growth.winbackSends[n] || 0), 0);

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Email</h2>
        <p className="mt-1 text-sm text-secondary/60">Last 30 days</p>
      </div>

      <div className={PANEL}>
        <div className="grid grid-cols-2 divide-black/[0.06] border-b border-black/[0.06] sm:grid-cols-3 lg:grid-cols-6 lg:divide-x dark:divide-white/10 dark:border-white/10">
          <Kpi label="Sent" value={fmt(current.sent)} help="Daily emails that went out: account holders, email-only readers and win-back">
            <Delta now={current.sent} before={previous.sent} kind="count" goodWhenUp comparable={comparable} />
          </Kpi>
          <Kpi label="Delivered" value={pct(current.delivered)} help="Of the emails Brevo tracked, the share that didn't bounce or get blocked">
            <Delta now={current.delivered} before={previous.delivered} kind="rate" goodWhenUp comparable={comparable} />
          </Kpi>
          <Kpi label="Opened" value={pct(current.opened)} help="Of the emails Brevo tracked, the share opened (Apple's automatic opens left out)">
            <Delta now={current.opened} before={previous.opened} kind="rate" goodWhenUp comparable={comparable} />
          </Kpi>
          <Kpi label="Clicked" value={pct(current.clicked)} help="Of the emails Brevo tracked, the share with at least one click">
            <Delta now={current.clicked} before={previous.clicked} kind="rate" goodWhenUp comparable={comparable} />
          </Kpi>
          <Kpi label="Unsubscribed" value={pct(current.unsubscribed)} help={`${current.unsubscribes} people turned the email off, per email sent`}>
            <Delta now={current.unsubscribed} before={previous.unsubscribed} kind="rate" goodWhenUp={false} comparable={comparable} />
          </Kpi>
          <Kpi label="Bounced" value={pct(current.bounced)} help="Of the emails Brevo tracked, the share that bounced or was blocked">
            <Delta now={current.bounced} before={previous.bounced} kind="rate" goodWhenUp={false} comparable={comparable} />
          </Kpi>
        </div>

        <p className="border-b border-black/[0.06] px-5 py-2.5 text-xs text-secondary/50 dark:border-white/10">
          Opened, clicked, delivered and bounced are out of the {fmt(current.tracked)} emails Brevo tracks (since 2 Nov,
          everyone; before that, email-only mail went out from our own server untracked). Unsubscribed is people who turned it off,
          per email sent.{comparable ? '' : ' Changes vs the month before show once there are 30 days of history (the send log starts 21 Sep).'}
        </p>

        <div className="px-6 pb-4 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[13px] text-secondary/60">Daily readers</p>
              <div className="flex items-baseline gap-3">
                <p className="text-4xl font-semibold tabular-nums">{fmt(overview.readersNow)}</p>
                {growth.newSubs > 0 ? (
                  <p className="text-sm text-green-600">+{growth.newSubs} joined the email list in 30 days</p>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-secondary/50">
                Subscribers who got the latest email
                {overview.readersSplit.day ? ` (${shortDay(overview.readersSplit.day)})` : ''}:{' '}
                {overview.readersSplit.members} with an account, {overview.readersSplit.emailOnly} email-only.
                Win-back isn&apos;t counted.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-secondary/60">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-black dark:bg-white" /> Last 30 days
                {readerChange !== null ? (
                  <span className="font-semibold text-black dark:text-white">
                    {readerChange >= 0 ? '+' : ''}{readerChange}
                  </span>
                ) : null}
              </span>
              {hasPrevious ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 border-t border-dashed border-black/40 dark:border-white/40" /> Previous 30 days
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-4 h-64 text-neutral-900 dark:text-neutral-100">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={readersChart} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="readersFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(120,120,120,0.18)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8a8a8a' }} tickLine={false} axisLine={false} interval={6} />
                <YAxis tick={{ fontSize: 11, fill: '#8a8a8a' }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP} labelStyle={TOOLTIP_LABEL} />
                <Line
                  type="monotone"
                  dataKey="Previous 30 days"
                  stroke="#9a9a9a"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="Last 30 days"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="url(#readersFill)"
                  dot={false}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${PANEL} px-6 py-5`}>
          <p className="text-[13px] text-secondary/60">New subscribers</p>
          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums">{growth.newSubs}</p>
            <p className="text-sm text-secondary/60">
              {growth.sources.map(([source, n]) => `${n} from ${SOURCE_LABELS[source] || source}`).join(' · ')}
            </p>
          </div>
          <div className="mt-3 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={joinedChart}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8a8a8a' }} tickLine={false} axisLine={false} interval={6} />
                <YAxis hide allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP} labelStyle={TOOLTIP_LABEL} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="New subscribers" fill="#17a34a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-secondary/50">
            {growth.newSubsStillOn} of them still subscribed. {growth.topicsPicked} accounts have picked their topics.
          </p>
        </div>

        <div className={`${PANEL} px-6 py-5`}>
          <p className="text-[13px] text-secondary/60">Came to the site from the email</p>
          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums">{growth.emailVisitors ?? '—'}</p>
            <p className="text-sm text-secondary/60">visits over 30 days (unique visitors per day, added up)</p>
          </div>
          {growth.emailVisitors === null ? (
            <p className="mt-6 text-sm text-secondary/50">No PostHog data: add POSTHOG_PERSONAL_API_KEY to frontend/.env</p>
          ) : (
            <div className="mt-3 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visitsChart}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8a8a8a' }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP} labelStyle={TOOLTIP_LABEL} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="Visitors" fill="#1634cc" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className={PANEL}>
        <div className="flex items-baseline justify-between px-6 pb-2 pt-5">
          <p className="text-[15px] font-semibold">Sends</p>
          <p className="text-xs text-secondary/50">Opened and clicked: the share of Brevo-tracked emails that day</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-black/[0.06] text-left text-xs text-secondary/50 dark:border-white/10">
                <th className="px-6 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Subject</th>
                <th className="px-3 py-2.5 text-right font-medium">Sent to</th>
                <th className="px-3 py-2.5 text-right font-medium">Opened</th>
                <th className="px-3 py-2.5 text-right font-medium">Clicked</th>
                <th className="px-3 py-2.5 text-right font-medium" title="Joined the email list that day">Joined</th>
                <th className="px-6 py-2.5 text-right font-medium" title="Turned the email off that day">Left</th>
              </tr>
            </thead>
            <tbody>
              {overview.issues.map((row) => (
                <tr key={row.day} className="border-b border-black/[0.04] last:border-0 dark:border-white/5">
                  <td className="whitespace-nowrap px-6 py-3 font-medium">{shortDay(row.day)}</td>
                  <td className="max-w-[320px] truncate px-3 py-3 text-secondary/70" title={row.subject}>{row.subject || '—'}</td>
                  <td
                    className="px-3 py-3 text-right tabular-nums"
                    title={`${row.members} account holders · ${row.landing} email-only · ${row.winback} win-back`}
                  >
                    {row.recipients}
                    <span className="ml-1 text-xs text-secondary/40">
                      {row.winback ? `(${row.winback} win-back)` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{pct(row.opened)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{pct(row.clicked)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-green-600">{row.joined ? `+${row.joined}` : '—'}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-red-500">{row.unsubscribes ? `−${row.unsubscribes}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${PANEL} px-6 py-5`}>
          <p className="mb-3 text-[15px] font-semibold">Newest subscribers</p>
          {growth.recentSignups.length === 0 ? (
            <p className="text-sm text-secondary/50">No signups in 30 days</p>
          ) : (
            <ul className="max-h-72 divide-y divide-black/[0.05] overflow-y-auto dark:divide-white/5">
              {growth.recentSignups.map((row) => (
                <li key={`${row.email}-${row.at}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{row.email}</span>
                  <span className="shrink-0 text-xs text-secondary/50">
                    {SOURCE_LABELS[row.source] || row.source} · {shortDay(row.at.slice(0, 10))}
                    {row.active ? '' : <span className="ml-1 text-red-500">left</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${PANEL} px-6 py-5`}>
          <p className="text-[15px] font-semibold">Win-back</p>
          <p className="mt-1 text-xs text-secondary/50">
            Old accounts that went quiet get up to 3 emails, 4 days apart. Coming back to the site moves them to the daily.
          </p>
          <div className="mt-4 space-y-3">
            {['1', '2', '3'].map((n) => {
              const count = growth.winbackSends[n] || 0;
              const width = winbackTotal ? Math.round((count / winbackTotal) * 100) : 0;
              return (
                <div key={n}>
                  <div className="flex justify-between text-xs">
                    <span className="text-secondary/60">Had {n} of 3</span>
                    <span className="tabular-nums font-semibold">{count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-black/[0.05] dark:bg-white/10">
                    <div className="h-2 rounded-full bg-black/70 dark:bg-white/70" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
