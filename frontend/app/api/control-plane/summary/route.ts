import { NextRequest, NextResponse } from 'next/server';
import { isControlPlaneRequestAuthenticated } from '@/lib/control-plane-auth';
import { localFirestoreFromEnv } from '@/lib/local-firestore';

type EventMetric = { event: string; users: number; occurrences: number };
type Experiment = {
  id: string;
  name?: string;
  hypothesis?: string;
  status?: string;
  metric?: string;
  variants?: Array<{ name: string; allocation?: number }>;
  updatedAt?: string;
};

const EVENT_ALIASES = {
  signups: ['user_signed_up', 'user_signed_up'],
  onboarding: ['onboarding_completed'],
  feedOpened: ['feed_viewed'],
  storyOpened: ['feed_item_clicked', 'summary_opened'],
  subscription: ['subscription_started', 'purchase_completed'],
};

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value || 0);
}

function sumEvents(metrics: EventMetric[], names: string[], field: 'users' | 'occurrences'): number {
  const wanted = new Set(names);
  return metrics.filter((metric) => wanted.has(metric.event)).reduce((sum, metric) => sum + metric[field], 0);
}

async function posthogMetrics(days: number): Promise<{ metrics: EventMetric[]; daily: Array<{ date: string; visitors: number; pageviews: number }> }> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!apiKey) return { metrics: [], daily: [] };
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com').replace(/\/$/, '');
  const query = async (hogql: string) => {
    const response = await fetch(`${host}/api/projects/@current/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: hogql } }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`PostHog query failed (${response.status})`);
    return response.json() as Promise<{ results?: unknown[][] }>;
  };

  const [eventData, dailyData] = await Promise.all([
    query(`SELECT event, count(DISTINCT distinct_id), count() FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY GROUP BY event ORDER BY count() DESC LIMIT 100`),
    query(`SELECT toDate(timestamp), count(DISTINCT distinct_id), count() FROM events WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY GROUP BY toDate(timestamp) ORDER BY toDate(timestamp)`),
  ]);

  return {
    metrics: (eventData.results || []).map((row) => ({ event: String(row[0] || ''), users: asNumber(row[1]), occurrences: asNumber(row[2]) })),
    daily: (dailyData.results || []).map((row) => ({ date: String(row[0] || ''), visitors: asNumber(row[1]), pageviews: asNumber(row[2]) })),
  };
}

export async function GET(request: NextRequest) {
  if (!isControlPlaneRequestAuthenticated(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get('days') || 28), 7), 90);
  const warnings: string[] = [];
  let metrics: EventMetric[] = [];
  let daily: Array<{ date: string; visitors: number; pageviews: number }> = [];
  try {
    ({ metrics, daily } = await posthogMetrics(days));
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : 'PostHog metrics unavailable');
  }

  const db = localFirestoreFromEnv();
  let experiments: Experiment[] = [];
  if (db) {
    try {
      const snapshot = await db.collection('control_plane_experiments').limit(100).get();
      experiments = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) } as Experiment));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'LocalDB experiments unavailable');
    }
  } else {
    warnings.push('LocalDB is not configured for this deployment.');
  }

  const signupUsers = sumEvents(metrics, EVENT_ALIASES.signups, 'users');
  const onboardingUsers = sumEvents(metrics, EVENT_ALIASES.onboarding, 'users');
  const feedUsers = sumEvents(metrics, EVENT_ALIASES.feedOpened, 'users');
  const storyUsers = sumEvents(metrics, EVENT_ALIASES.storyOpened, 'users');
  const subscriptionUsers = sumEvents(metrics, EVENT_ALIASES.subscription, 'users');
  const rate = (numerator: number, denominator: number) => denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    periodDays: days,
    configured: { posthog: Boolean(process.env.POSTHOG_PERSONAL_API_KEY), localdb: Boolean(db) },
    warnings,
    northStar: { name: 'Paid subscriptions', value: subscriptionUsers, unit: 'unique users' },
    funnel: [
      { key: 'visitors', label: 'Visitors', value: daily.reduce((sum, day) => sum + day.visitors, 0), rate: null },
      { key: 'signups', label: 'Signups', value: signupUsers, rate: rate(signupUsers, daily.reduce((sum, day) => sum + day.visitors, 0)) },
      { key: 'onboarding', label: 'Onboarding complete', value: onboardingUsers, rate: rate(onboardingUsers, signupUsers) },
      { key: 'feed', label: 'Feed opened', value: feedUsers, rate: rate(feedUsers, onboardingUsers) },
      { key: 'stories', label: 'Story interaction', value: storyUsers, rate: rate(storyUsers, feedUsers) },
      { key: 'subscriptions', label: 'Paid subscription', value: subscriptionUsers, rate: rate(subscriptionUsers, signupUsers) },
    ],
    daily,
    experiments: experiments.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
    eventMetrics: metrics.slice(0, 30),
    retention: { d1: null, d7: null, d21: null, note: 'Retention cohorts will be populated after the control-plane event schema is live.' },
  });
}
