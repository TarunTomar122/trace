import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

/**
 * DEV ONLY: analytics pulled straight from the VPS LocalDB (db.yourtrace.online).
 * GET /api/dev/localdb-analytics
 *
 * Reads the SQLite document store over its HTTP API so subcollection docs
 * (user_interactions/{uid}/daily/{date}) and newsletter audience data are
 * visible — things the Firestore-shaped client cannot list directly.
 */

const MAX_DOCS = 5000;
const DAY = 24 * 60 * 60 * 1000;

type Doc = { path: string; data: Record<string, unknown> };

function env() {
  const url = (process.env.LOCALDB_URL || '').trim().replace(/\/$/, '');
  const token = (process.env.LOCALDB_API_TOKEN || '').trim();
  return { url, token };
}

async function queryCollection(
  collection: string,
  select: string[],
  limit = MAX_DOCS
): Promise<Doc[]> {
  const { url, token } = env();
  if (!url || !token) throw new Error('LOCALDB_URL / LOCALDB_API_TOKEN not configured');
  // Field selection matters: full user_profiles payloads are ~11 MB and take
  // the better part of a minute over the tunnel; 12 fields is 0.35 MB.
  const res = await fetch(`${url}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection, select, limit }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`localdb ${collection} -> ${res.status}`);
  const json = (await res.json()) as { documents?: Doc[] };
  return (json.documents || []).map((doc) => ({
    path: String(doc.path || ''),
    data: (doc.data || {}) as Record<string, unknown>,
  }));
}

/** Subcollections (user_interactions/{uid}/daily/{date}) are only visible to
 *  the listing endpoint — /query returns direct children only. */
async function listCollection(collection: string, limit = MAX_DOCS): Promise<Doc[]> {
  const { url, token } = env();
  if (!url || !token) throw new Error('LOCALDB_URL / LOCALDB_API_TOKEN not configured');
  const res = await fetch(
    `${url}/documents?collection=${encodeURIComponent(collection)}&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`localdb ${collection} -> ${res.status}`);
  const json = (await res.json()) as { documents?: Doc[] };
  return (json.documents || []).map((doc) => ({
    path: String(doc.path || ''),
    data: (doc.data || {}) as Record<string, unknown>,
  }));
}

/** LocalDB returns ISO strings; Firestore timestamps can still slip through. */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    const obj = value as { _seconds?: number; seconds?: number; toDate?: () => Date };
    if (typeof obj.toDate === 'function') {
      try {
        return obj.toDate();
      } catch {
        return null;
      }
    }
    const seconds = obj._seconds ?? obj.seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000);
  }
  return null;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastNDays(days: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i -= 1) {
    out.push(dayKey(new Date(now - i * DAY)));
  }
  return out;
}

function emptySeries(days: number): Record<string, number> {
  return Object.fromEntries(lastNDays(days).map((d) => [d, 0]));
}

function countBy(values: (string | undefined)[]): [string, number][] {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const key = (value || 'unknown').trim() || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function isSubscribed(profile: Record<string, unknown>): boolean {
  const status = String(profile.subscriptionStatus || '');
  const appStatus = String(profile.appSubscriptionStatus || '');
  if (['trial', 'active'].includes(status)) return true;
  if (['trial', 'active'].includes(appStatus)) return true;
  return profile.isEarlyAdopter === true;
}

function emailPreference(profile: Record<string, unknown>): 'on' | 'off' | 'unset' {
  if ('dailyNewsletterEnabled' in profile) {
    return profile.dailyNewsletterEnabled === true ? 'on' : 'off';
  }
  if ('newsletterOptIn' in profile) {
    return profile.newsletterOptIn === true ? 'on' : 'off';
  }
  return 'unset';
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  try {
    if (!adminAuth) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    const startedAt = Date.now();

    const [profiles, landing, reads, interactions, extensions, clicks, conversions, promoted, runs] =
      await Promise.all([
        queryCollection('user_profiles', [
          'email', 'onboarded', 'subscriptionStatus', 'appSubscriptionStatus',
          'isEarlyAdopter', 'dailyNewsletterEnabled', 'newsletterOptIn',
          'lastActiveAt', 'updatedAt', 'onboardedAt', 'createdAt', 'referralSource',
        ]),
        queryCollection('free_newsletter_subscribers', ['email', 'active', 'subscribedAt']),
        queryCollection('free_reads', ['ids']),
        // user_interactions (and other subcollection data) needs the listing
        // endpoint; it is small enough to pull whole.
        listCollection('user_interactions'),
        queryCollection('extension_sessions', ['expiresAt', 'revokedAt']),
        queryCollection('affiliate_clicks', ['utmSource', 'target', 'createdAt']),
        queryCollection('affiliate_conversions', ['createdAt']),
        queryCollection('promoted_tools', ['status']),
        queryCollection('v3_pipeline_runs', ['last_run_at', 'status'], 100),
      ]);

    const now = Date.now();
    const notes: string[] = [];
    if (profiles.length >= MAX_DOCS) notes.push('user_profiles hit the 5000 doc cap');
    if (clicks.length >= MAX_DOCS) notes.push('affiliate_clicks hit the 5000 doc cap');

    // ---- Audience ----------------------------------------------------------
    const accountEmails = new Set(
      profiles.map((p) => String(p.data.email || '').trim().toLowerCase()).filter(Boolean)
    );
    const planCounts = {
      pro: 0, free: 0, freeStale: 0, paidActive: 0, trial: 0, earlyAdopter: 0,
      subscribedNoEmail: 0,
    };
    const prefCounts = { on: 0, off: 0, unset: 0 };
    let onboarded = 0;
    let dau = 0;
    let wau = 0;
    let mau = 0;

    profiles.forEach(({ data }) => {
      const email = String(data.email || '').trim().toLowerCase();
      const isOnboarded = data.onboarded === true;
      const subscribed = isSubscribed(data);
      const last = toDate(data.lastActiveAt) || toDate(data.updatedAt) || toDate(data.onboardedAt);
      const fresh = !last || now - last.getTime() <= 7 * DAY;

      // Mirror the newsletter flow's bucket rules so the page shows the real
      // send: onboarded + reachable by email, pro > free, free needs activity.
      if (subscribed) {
        if (isOnboarded && email) {
          planCounts.pro += 1;
          const status = String(data.subscriptionStatus || data.appSubscriptionStatus || '');
          if (status === 'active') planCounts.paidActive += 1;
          if (status === 'trial') planCounts.trial += 1;
          if (data.isEarlyAdopter === true) planCounts.earlyAdopter += 1;
        } else {
          planCounts.subscribedNoEmail += 1;
        }
      } else if (isOnboarded && email) {
        if (fresh && last) planCounts.free += 1;
        else planCounts.freeStale += 1;
      }

      if (isOnboarded) onboarded += 1;
      prefCounts[emailPreference(data)] += 1;

      const active = toDate(data.lastActiveAt);
      if (active) {
        const age = now - active.getTime();
        if (age <= DAY) dau += 1;
        if (age <= 7 * DAY) wau += 1;
        if (age <= 30 * DAY) mau += 1;
      }
    });

    const landingSubs = landing.map(({ data }) => data);
    const landingActive = landingSubs.filter((d) => d.active === true);
    const landingEmails = new Set(
      landingActive.map((d) => String(d.email || '').trim().toLowerCase()).filter(Boolean)
    );
    const landingEffective = [...landingEmails].filter((email) => !accountEmails.has(email)).length;

    // ---- Growth ------------------------------------------------------------
    const signups = emptySeries(30);
    const onboardedSeries = emptySeries(30);
    profiles.forEach(({ data }) => {
      const created = toDate(data.createdAt) || toDate(data.onboardedAt);
      if (created) {
        const key = dayKey(created);
        if (key in signups) signups[key] += 1;
      }
      if (data.onboarded === true) {
        const onb = toDate(data.onboardedAt);
        if (onb) {
          const key = dayKey(onb);
          if (key in onboardedSeries) onboardedSeries[key] += 1;
        }
      }
    });
    const landingSeries = emptySeries(30);
    landingActive.forEach((data) => {
      const at = toDate(data.subscribedAt);
      if (at) {
        const key = dayKey(at);
        if (key in landingSeries) landingSeries[key] += 1;
      }
    });

    // ---- Activity ----------------------------------------------------------
    const readsSeries = emptySeries(14);
    reads.forEach(({ path, data }) => {
      const ids = Array.isArray(data.ids) ? data.ids.length : 0;
      const day = path.slice(-10);
      if (day in readsSeries) readsSeries[day] += ids;
    });

    const interactionSeries = emptySeries(14);
    let interactionItems = 0;
    let upvotes = 0;
    let downvotes = 0;
    interactions.forEach(({ data }) => {
      const day = String(data.date || '').slice(0, 10);
      const items = Array.isArray(data.items) ? data.items : [];
      interactionItems += items.length;
      items.forEach((item) => {
        const action = String((item as Record<string, unknown>)?.action || '');
        if (action === 'upvote') upvotes += 1;
        if (action === 'downvote') downvotes += 1;
      });
      if (day in interactionSeries) interactionSeries[day] += items.length;
    });
    if (reads.length < 30) {
      notes.push(`free_reads only has ${reads.length} docs — engagement numbers are thin`);
    }
    if (profiles.length > 0 && mau < profiles.length * 0.2) {
      notes.push(
        `only ${mau}/${profiles.length} profiles have a lastActiveAt inside 30 days — DAU/WAU are unreliable while the web app does not stamp activity`
      );
    }

    // ---- Extensions & acquisition -----------------------------------------
    let extensionActive = 0;
    extensions.forEach(({ data }) => {
      const expires = toDate(data.expiresAt);
      const revoked = toDate(data.revokedAt);
      if (expires && expires.getTime() > now && !revoked) extensionActive += 1;
    });

    const clickSeries = emptySeries(30);
    clicks.forEach(({ data }) => {
      const at = toDate(data.createdAt);
      if (at) {
        const key = dayKey(at);
        if (key in clickSeries) clickSeries[key] += 1;
      }
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      localdbUrl: env().url,
      counts: {
        profiles: profiles.length,
        landingSubscribers: landing.length,
        reads: reads.length,
        interactions: interactions.length,
        extensionSessions: extensions.length,
        affiliateClicks: clicks.length,
        affiliateConversions: conversions.length,
        promotedTools: promoted.length,
      },
      audience: {
        profiles: profiles.length,
        onboarded,
        ...planCounts,
        email: prefCounts,
        landingSubscribers: landing.length,
        landingActive: landingActive.length,
        landingEffective,
        effectiveSend: {
          pro: planCounts.pro,
          free: planCounts.free,
          landing: landingEffective,
        },
      },
      engagement: {
        dau,
        wau,
        mau,
        upvotes,
        downvotes,
        interactionItems,
        extensionActive,
        readsTotal: Object.values(readsSeries).reduce((a, b) => a + b, 0),
      },
      acquisition: {
        clicksTotal: clicks.length,
        clicksBySource: countBy(clicks.map(({ data }) => String(data.utmSource || ''))).slice(0, 8),
        clicksByTarget: countBy(clicks.map(({ data }) => String(data.target || ''))).slice(0, 8),
        conversions: conversions.length,
        referralSources: countBy(profiles.map(({ data }) => String(data.referralSource || ''))).slice(0, 8),
      },
      series: {
        days: lastNDays(30),
        signups,
        onboarded: onboardedSeries,
        landingSignups: landingSeries,
        clickDays: lastNDays(30),
        clicks: clickSeries,
        activityDays: lastNDays(14),
        reads: readsSeries,
        interactions: interactionSeries,
      },
      ops: runs
        .map(({ path, data }) => ({
          job: path.split('/').slice(1).join('/'),
          lastRunAt: String(data.last_run_at || ''),
          status: String(data.status || ''),
        }))
        .sort((a, b) => a.job.localeCompare(b.job)),
      promoted: countBy(promoted.map(({ data }) => String(data.status || ''))),
      notes,
    });
  } catch (error) {
    console.error('LocalDB analytics error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'LocalDB query failed' },
      { status: 500 }
    );
  }
}
