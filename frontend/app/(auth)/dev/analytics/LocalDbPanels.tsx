'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Database, Mail, RefreshCw, Activity, MousePointerClick } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type Series = Record<string, number>;

type LocalDbAnalytics = {
  generatedAt: string;
  localdbUrl: string;
  counts: Record<string, number>;
  audience: {
    profiles: number;
    onboarded: number;
    pro: number;
    free: number;
    freeStale: number;
    paidActive: number;
    trial: number;
    earlyAdopter: number;
    email: { on: number; off: number; unset: number };
    landingSubscribers: number;
    landingActive: number;
    landingEffective: number;
    effectiveSend: { pro: number; free: number; landing: number };
  };
  engagement: {
    dau: number;
    wau: number;
    mau: number;
    upvotes: number;
    downvotes: number;
    interactionItems: number;
    extensionActive: number;
    readsTotal: number;
  };
  acquisition: {
    clicksTotal: number;
    clicksBySource: [string, number][];
    clicksByTarget: [string, number][];
    conversions: number;
    referralSources: [string, number][];
  };
  series: {
    days: string[];
    signups: Series;
    onboarded: Series;
    landingSignups: Series;
    clickDays: string[];
    clicks: Series;
    emailSends: Series;
    emailOpens: Series;
    emailClicks: Series;
    activityDays: string[];
    reads: Series;
    interactions: Series;
  };
  email: {
    totals: {
      sends: number;
      recipients: number;
      sent: number;
      failed: number;
      fallbacks: number;
      openEvents: number;
      clickEvents: number;
      openers: number;
      clickers: number;
      openRate: number;
      clickRate: number;
      lastSendAt: string;
    };
    transport: [string, number][];
    dkim: [string, number][];
    byBucket: {
      bucket: string;
      sent: number;
      openers: number;
      clickers: number;
      clicks: number;
      openRate: number;
      clickRate: number;
      tracked: boolean;
    }[];
    topTargets: [string, number][];
    recentSends: {
      to: string;
      bucket: string;
      transport: string;
      status: string;
      dkim: string;
      subject: string;
      sentAt: string;
      error: string;
      opened: boolean;
      clicked: boolean;
    }[];
    recentClicks: { at: string; target: string; bucket: string; to: string }[];
  };
  ops: { job: string; lastRunAt: string; status: string }[];
  promoted: [string, number][];
  notes: string[];
};

const CARD = 'bg-white dark:bg-white/5 rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm';

function Card({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={CARD}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">{icon}</div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint ? <p className="text-xs text-secondary/50">{hint}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-white/5">
      <p className="text-xs text-secondary/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-secondary/50">{hint}</p> : null}
    </div>
  );
}

function toChart(keys: string[], series: Record<string, Series>) {
  return keys.map((day) => {
    const row: Record<string, string | number> = { day: day.slice(5) };
    Object.entries(series).forEach(([name, values]) => {
      row[name] = values[day] ?? 0;
    });
    return row;
  });
}

export default function LocalDbPanels() {
  const { user } = useAuth();
  const [data, setData] = useState<LocalDbAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/dev/localdb-analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setData(json as LocalDbAnalytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load LocalDB analytics');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const growth = useMemo(
    () =>
      data
        ? toChart(data.series.days, {
            Signups: data.series.signups,
            Onboarded: data.series.onboarded,
            'Landing signups': data.series.landingSignups,
          })
        : [],
    [data]
  );

  const activity = useMemo(
    () =>
      data
        ? toChart(data.series.activityDays, {
            Reads: data.series.reads,
            Interactions: data.series.interactions,
          })
        : [],
    [data]
  );

  const emailActivity = useMemo(
    () =>
      data
        ? toChart(data.series.days, {
            Sent: data.series.emailSends,
            Opens: data.series.emailOpens,
            Clicks: data.series.emailClicks,
          })
        : [],
    [data]
  );

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white px-6 py-4 shadow-sm dark:border-white/5 dark:bg-white/5">
        <div className="flex items-center gap-3">
          <Database size={18} className="text-blue-500" />
          <div>
            <h2 className="text-sm font-semibold">VPS LocalDB (live)</h2>
            <p className="text-xs text-secondary/50">
              {data?.localdbUrl || '—'}
              {data ? ` · snapshot ${new Date(data.generatedAt).toLocaleTimeString()}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-semibold dark:border-white/10"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-500">{error}</div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-3 px-2 py-6 text-sm text-secondary/60">
          <RefreshCw size={16} className="animate-spin" /> Reading the LocalDB…
        </div>
      ) : null}

      {data ? (
        <>
          <Card
            title="Newsletter audience"
            icon={<Mail size={16} />}
            hint="What tomorrow's send resolves to, from the same data the flow reads"
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Pro (gets 10)" value={data.audience.effectiveSend.pro} hint={`${data.audience.paidActive} paid · ${data.audience.trial} trial · ${data.audience.earlyAdopter} early adopter`} />
              <Stat label="Free (gets 5)" value={data.audience.effectiveSend.free} hint={`${data.audience.freeStale} skipped as inactive >7d`} />
              <Stat
                label="Landing (gets 5)"
                value={data.audience.effectiveSend.landing}
                hint={`${data.audience.landingActive} active · ${data.audience.landingSubscribers} total signups`}
              />
              <Stat
                label="Email prefs"
                value={`${data.audience.email.on} on`}
                hint={`${data.audience.email.off} off · ${data.audience.email.unset} unset (defaults on)`}
              />
            </div>
          </Card>

          <Card
            title="Daily email delivery"
            icon={<Mail size={16} />}
            hint={
              data.email.totals.lastSendAt
                ? `email_sends — last attempt ${new Date(data.email.totals.lastSendAt).toLocaleString()}`
                : 'email_sends — nothing recorded yet'
            }
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat
                label="Sent"
                value={data.email.totals.sent}
                hint={`${data.email.totals.recipients} unique recipients`}
              />
              <Stat
                label="Failed"
                value={data.email.totals.failed}
                hint={`${data.email.totals.fallbacks} fell back to Brevo`}
              />
              <Stat
                label="Openers"
                value={data.email.totals.openers}
                hint={`${data.email.totals.openRate}% of sends · ${data.email.totals.openEvents} open events`}
              />
              <Stat
                label="Clickers"
                value={data.email.totals.clickers}
                hint={`${data.email.totals.clickRate}% of sends · ${data.email.totals.clickEvents} click events`}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.email.transport.map(([name, count]) => (
                <span
                  key={name}
                  className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600"
                >
                  via {name}: {count}
                </span>
              ))}
              {data.email.dkim.map(([name, count]) => (
                <span
                  key={name}
                  className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-secondary/70 dark:bg-white/10"
                >
                  dkim {name}: {count}
                </span>
              ))}
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card
              title="Email engagement (30d)"
              icon={<MousePointerClick size={16} />}
              hint="Sends against opens and clicks (Brevo's, synced each morning)"
            >
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={emailActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} width={28} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                    <Line type="monotone" dataKey="Sent" stroke="#1d9bf0" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Opens" stroke="#17bf63" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Clicks" stroke="#f5a623" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Per bucket (30d)" icon={<Mail size={16} />} hint="Who got it and how many of them acted on it">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1 text-xs font-semibold text-secondary/60">
                  <span>Bucket</span>
                  <span className="flex gap-6">
                    <span className="w-24 text-right">Sent</span>
                    <span className="w-32 text-right">Opened</span>
                    <span className="w-32 text-right">Clicked</span>
                  </span>
                </div>
                {data.email.byBucket.length === 0 ? (
                  <p className="px-1 text-sm text-secondary/50">No daily sends in the last 30 days</p>
                ) : null}
                {data.email.byBucket.map((row) => (
                  <div
                    key={row.bucket}
                    className="flex items-center justify-between rounded-xl border border-black/5 px-4 py-2 text-xs dark:border-white/5"
                  >
                    <span className="font-semibold capitalize">{row.bucket}</span>
                    <span className="flex gap-6 tabular-nums">
                      <span className="w-24 text-right">{row.sent}</span>
                      {row.tracked ? (
                        <>
                          <span className="w-32 text-right">
                            {row.openers} <span className="text-secondary/50">({row.openRate}%)</span>
                          </span>
                          <span className="w-32 text-right">
                            {row.clickers} <span className="text-secondary/50">({row.clickRate}%)</span>
                          </span>
                        </>
                      ) : (
                        <span className="w-[17.5rem] text-right text-secondary/50">untracked (own server)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Recent sends" icon={<Mail size={16} />} hint="Newest first, with whether that send was opened or clicked">
              {data.email.recentSends.length === 0 ? (
                <p className="text-sm text-secondary/50">No sends recorded yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-secondary/50">
                        <th className="py-2 pr-3 font-medium">When</th>
                        <th className="py-2 pr-3 font-medium">To</th>
                        <th className="py-2 pr-3 font-medium">Bucket</th>
                        <th className="py-2 pr-3 font-medium">Via</th>
                        <th className="py-2 pr-3 font-medium">DKIM</th>
                        <th className="py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.email.recentSends.map((row) => (
                        <tr key={`${row.to}-${row.sentAt}`} className="border-t border-black/5 dark:border-white/5">
                          <td className="py-2 pr-3 text-secondary/60">
                            {row.sentAt ? new Date(row.sentAt).toLocaleString() : '—'}
                          </td>
                          <td className="max-w-[180px] truncate py-2 pr-3">{row.to}</td>
                          <td className="py-2 pr-3 capitalize">{row.bucket || '—'}</td>
                          <td className="py-2 pr-3">{row.transport}</td>
                          <td className="py-2 pr-3">{row.dkim}</td>
                          <td className="py-2">
                            {row.status !== 'sent' ? (
                              <span className="font-semibold text-red-500">failed</span>
                            ) : row.clicked ? (
                              <span className="font-semibold text-amber-500">clicked</span>
                            ) : row.opened ? (
                              <span className="font-semibold text-green-500">opened</span>
                            ) : (
                              <span className="text-secondary/40">sent</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Recent clicks" icon={<MousePointerClick size={16} />} hint="Where readers actually went, and the most popular targets">
              {data.email.topTargets.length > 0 ? (
                <div className="mb-4">
                  <p className="mb-1 text-xs font-semibold text-secondary/60">Top targets</p>
                  <ul className="space-y-1">
                    {data.email.topTargets.map(([target, count]) => (
                      <li key={target} className="flex items-center justify-between text-xs">
                        <span className="truncate pr-3 text-secondary/70">{target}</span>
                        <span className="tabular-nums font-semibold">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.email.recentClicks.length === 0 ? (
                <p className="text-sm text-secondary/50">No clicks recorded yet</p>
              ) : (
                <ul className="space-y-2">
                  {data.email.recentClicks.map((row) => (
                    <li
                      key={`${row.at}-${row.target}`}
                      className="flex items-center justify-between rounded-xl border border-black/5 px-3 py-2 text-xs dark:border-white/5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-secondary/70">{row.target}</span>
                        <span className="text-secondary/40">
                          {row.at ? new Date(row.at).toLocaleString() : '—'} · {row.bucket}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Signups (30d)" icon={<Activity size={16} />} hint="Profiles created, onboarded, and landing-page emails">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} width={28} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                    <Line type="monotone" dataKey="Signups" stroke="#1d9bf0" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Onboarded" stroke="#17bf63" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Landing signups" stroke="#f5a623" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Reading activity (14d)" icon={<Activity size={16} />} hint="Stories read and up/downvotes per day">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={1} />
                    <YAxis tick={{ fontSize: 10 }} width={28} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                    <Bar dataKey="Reads" fill="#1d9bf0" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Interactions" fill="#17bf63" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Engagement" icon={<Activity size={16} />} hint="Activity from user_profiles, interactions and the extension">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Stat label="DAU" value={data.engagement.dau} />
                <Stat label="WAU" value={data.engagement.wau} />
                <Stat label="MAU" value={data.engagement.mau} />
                <Stat label="Upvotes" value={data.engagement.upvotes} hint={`${data.engagement.downvotes} downvotes`} />
                <Stat label="Extension sessions" value={data.engagement.extensionActive} hint="active tokens" />
                <Stat label="Reads (14d)" value={data.engagement.readsTotal} />
              </div>
            </Card>

            <Card title="Acquisition" icon={<MousePointerClick size={16} />} hint="Affiliate clicks, conversions and referral sources">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Clicks" value={data.acquisition.clicksTotal} />
                <Stat label="Conversions" value={data.acquisition.conversions} />
                <Stat label="Promoted tools" value={data.promoted.reduce((acc, [, n]) => acc + n, 0)} />
              </div>
              <div className="mt-4 space-y-3">
                {(
                  [
                    ['Top UTM sources', data.acquisition.clicksBySource],
                    ['Top targets', data.acquisition.clicksByTarget],
                    ['Referral sources', data.acquisition.referralSources],
                  ] as [string, [string, number][]][]
                ).map(([label, rows]) => (
                  <div key={label}>
                    <p className="mb-1 text-xs font-semibold text-secondary/60">{label}</p>
                    {rows.length === 0 ? (
                      <p className="text-xs text-secondary/40">no data</p>
                    ) : (
                      <ul className="space-y-1">
                        {rows.map(([key, value]) => (
                          <li key={key} className="flex items-center justify-between text-xs">
                            <span className="truncate pr-3 text-secondary/70">{key}</span>
                            <span className="tabular-nums font-semibold">{value}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card title="Pipeline health" icon={<Database size={16} />} hint="v3_pipeline_runs — last successful run per job">
            {data.ops.length === 0 ? (
              <p className="text-sm text-secondary/50">No pipeline runs recorded</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {data.ops.map((run) => (
                  <div
                    key={run.job}
                    className="flex items-center justify-between rounded-xl border border-black/5 px-4 py-2 text-xs dark:border-white/5"
                  >
                    <span className="font-semibold">{run.job}</span>
                    <span className="text-secondary/60">
                      {run.lastRunAt ? new Date(run.lastRunAt).toLocaleString() : 'never'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {data.notes.length > 0 ? (
              <ul className="mt-4 space-y-1">
                {data.notes.map((note) => (
                  <li key={note} className="text-xs text-amber-500">
                    {note}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
