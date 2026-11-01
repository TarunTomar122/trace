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
// ~300 sends a day for 60 days, plus their events.
const EMAIL_MAX_DOCS = 40000;
const DAY = 24 * 60 * 60 * 1000;

type Doc = { path: string; data: Record<string, unknown> };

function env() {
  const url = (process.env.LOCALDB_URL || '').trim().replace(/\/$/, '');
  const token = (process.env.LOCALDB_API_TOKEN || '').trim();
  return { url, token };
}

type Filter = { field: string; op: string; value: unknown };

async function queryCollection(
  collection: string,
  select: string[],
  limit = MAX_DOCS,
  filters: Filter[] = []
): Promise<Doc[]> {
  const { url, token } = env();
  if (!url || !token) throw new Error('LOCALDB_URL / LOCALDB_API_TOKEN not configured');
  // Field selection matters: full user_profiles payloads are ~11 MB and take
  // the better part of a minute over the tunnel; 12 fields is 0.35 MB.
  const res = await fetch(`${url}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection, select, limit, filters }),
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

/** Unique visitors per day who arrived from a Trace email (?from=email), or null. */
async function emailVisitsByDay(days: number): Promise<Record<string, number> | null> {
  const key = (process.env.POSTHOG_PERSONAL_API_KEY || '').trim();
  if (!key) return null;
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com').replace(/\/+$/, '');
  try {
    const res = await fetch(`${host}/api/projects/@current/query/`, {
      signal: AbortSignal.timeout(10_000),
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      // from=email-share is a reader forwarding the brief, not the email itself.
      body: JSON.stringify({
        query: {
          kind: 'HogQLQuery',
          query: `SELECT toDate(toTimeZone(timestamp, 'UTC')) AS day, count(DISTINCT person_id)
                  FROM events
                  WHERE event = '$pageview'
                    AND properties.$current_url ILIKE '%from=email%'
                    AND properties.$current_url NOT ILIKE '%from=email-share%'
                    AND timestamp >= now() - INTERVAL ${days} DAY
                  GROUP BY day ORDER BY day`,
        },
      }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: [string, number][] };
    const series = emptySeries(days);
    (json.results || []).forEach(([day, visitors]) => {
      const keyDay = String(day).slice(0, 10);
      if (keyDay in series) series[keyDay] = Number(visitors) || 0;
    });
    return series;
  } catch {
    return null;
  }
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
    // The email panels cover the same 30 days as their charts.
    const emailSince = dayKey(new Date(Date.now() - 29 * DAY));
    // The overview compares with the 30 days before, so the send log and its
    // events are read for 60.
    const prevSince = dayKey(new Date(Date.now() - 59 * DAY));

    const emailVisitsPromise = emailVisitsByDay(30);
    const [profiles, landing, reads, interactions, extensions, clicks, conversions, promoted, runs, sendsAll, eventsAll] =
      await Promise.all([
        queryCollection('user_profiles', [
          'email', 'onboarded', 'subscriptionStatus', 'appSubscriptionStatus',
          'isEarlyAdopter', 'dailyNewsletterEnabled', 'newsletterOptIn',
          'lastActiveAt', 'updatedAt', 'onboardedAt', 'createdAt', 'referralSource',
          'newsletterUnsubscribedAt', 'newsletterSuppressedAt', 'newsletterSuppressedReason',
          'winbackSends', 'newsletterTopics', 'deleted',
        ]),
        queryCollection('free_newsletter_subscribers', [
          'email', 'active', 'subscribedAt', 'source', 'unsubscribedAt', 'unsubscribeReason',
        ]),
        queryCollection('free_reads', ['ids']),
        // user_interactions (and other subcollection data) needs the listing
        // endpoint; it is small enough to pull whole.
        listCollection('user_interactions'),
        queryCollection('extension_sessions', ['expiresAt', 'revokedAt']),
        queryCollection('affiliate_clicks', ['utmSource', 'target', 'createdAt']),
        queryCollection('affiliate_conversions', ['createdAt']),
        queryCollection('promoted_tools', ['status']),
        queryCollection('v3_pipeline_runs', ['last_run_at', 'status'], 100),
        // One doc per send attempt (backend/v1/tools/email_sender.py) and one per open
        // or click (Brevo's, via backend/v3/flows/sync_brevo.py), joined on track_id.
        queryCollection('email_sends', [
          'to', 'bucket', 'subject', 'transport', 'status', 'track_id', 'dkim',
          'error', 'fallback_from', 'sent_at', 'date',
        ], EMAIL_MAX_DOCS, [{ field: 'date', op: '>=', value: prevSince }]),
        // Opens, clicks and delivery failures; Apple's proxy loads are left out
        // (they open every email, read or not).
        queryCollection('email_events', ['track_id', 'kind', 'target', 'at', 'date'], EMAIL_MAX_DOCS, [
          { field: 'kind', op: 'in', value: ['open', 'click', 'bounce', 'blocked'] },
          { field: 'date', op: '>=', value: prevSince },
        ]),
      ]);
    const sends = sendsAll.filter(({ data }) => String(data.date || '').slice(0, 10) >= emailSince);
    const events = eventsAll.filter(
      ({ data }) => ['open', 'click'].includes(String(data.kind || '')) && String(data.date || '').slice(0, 10) >= emailSince
    );

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

      // Paid-era plan counts (Trace is free now), still in the JSON as
      // `audience`; the page shows the email setting counts (prefCounts).
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

    // ---- Email (send log + Brevo's opens and clicks) ------------------------
    // email_events only carries the track_id minted per send, so bucket and
    // recipient come from the join against email_sends.
    const trackBucket = new Map<string, string>();
    const trackRecipient = new Map<string, string>();
    const sendRows = sends.map(({ data }) => data);
    sendRows.forEach((data) => {
      const trackId = String(data.track_id || '').trim();
      if (!trackId) return;
      trackBucket.set(trackId, String(data.bucket || '').trim() || 'unknown');
      trackRecipient.set(trackId, String(data.to || '').trim());
    });

    const emailSendsSeries = emptySeries(30);
    const emailOpensSeries = emptySeries(30);
    const emailClicksSeries = emptySeries(30);
    const recipients = new Set<string>();
    const sortedSends = [...sendRows].sort((a, b) =>
      String(b.sent_at || b.date || '').localeCompare(String(a.sent_at || a.date || ''))
    );
    let emailSent = 0;
    let emailFailed = 0;
    let emailFallbacks = 0;
    sortedSends.forEach((data) => {
      const to = String(data.to || '').trim().toLowerCase();
      if (to) recipients.add(to);
      if (String(data.status || '').trim() === 'sent') emailSent += 1;
      else emailFailed += 1;
      if (String(data.fallback_from || '').trim()) emailFallbacks += 1;
      const day = String(data.date || '').slice(0, 10);
      if (day in emailSendsSeries) emailSendsSeries[day] += 1;
    });

    const openedTracks = new Set<string>();
    const clickedTracks = new Set<string>();
    const clickTargets: string[] = [];
    const bucketEngagement = new Map<string, { openers: Set<string>; clickers: Set<string>; clicks: number }>();
    const engagementFor = (bucket: string) => {
      if (!bucketEngagement.has(bucket)) {
        bucketEngagement.set(bucket, { openers: new Set(), clickers: new Set(), clicks: 0 });
      }
      return bucketEngagement.get(bucket)!;
    };

    const eventRows = events.map(({ data }) => data);
    let openEvents = 0;
    let clickEvents = 0;
    eventRows.forEach((data) => {
      const kind = String(data.kind || '').trim();
      const trackId = String(data.track_id || '').trim();
      const day = String(data.date || '').slice(0, 10);
      const stats = engagementFor(trackBucket.get(trackId) || 'unknown');
      if (kind === 'open') {
        openEvents += 1;
        if (day in emailOpensSeries) emailOpensSeries[day] += 1;
        if (trackId) {
          openedTracks.add(trackId);
          stats.openers.add(trackId);
        }
      } else if (kind === 'click') {
        clickEvents += 1;
        if (day in emailClicksSeries) emailClicksSeries[day] += 1;
        if (trackId) {
          clickedTracks.add(trackId);
          stats.clickers.add(trackId);
        }
        stats.clicks += 1;
        const target = String(data.target || '').trim();
        if (target) clickTargets.push(target);
      }
    });

    const emailSendsTotal = sendRows.length;
    // The daily's buckets since Trace went free, then the paid-era ones while
    // they are still inside the window.
    const DAILY_BUCKETS = ['member', 'winback', 'landing', 'pro', 'free'];
    const emailByBucket = DAILY_BUCKETS.map((bucket) => {
      const stats = bucketEngagement.get(bucket);
      const rows = sendRows.filter((d) => String(d.bucket || '').trim() === bucket);
      const sent = rows.length;
      // Only mail that left through Brevo has opens and clicks, so rates are
      // out of those sends (landing moved from our MTA to Brevo on 2026-11-01).
      const brevoSent = rows.filter((d) => String(d.transport || '').trim() === 'brevo').length;
      const openers = stats?.openers.size || 0;
      const clickers = stats?.clickers.size || 0;
      return {
        bucket,
        sent,
        tracked: brevoSent > 0,
        openers,
        clickers,
        clicks: stats?.clicks || 0,
        openRate: brevoSent ? Math.round((openers / brevoSent) * 100) : 0,
        clickRate: brevoSent ? Math.round((clickers / brevoSent) * 100) : 0,
      };
    }).filter((row) => row.sent > 0);
    const unknownBucketed = sendRows.filter(
      (d) => !DAILY_BUCKETS.includes(String(d.bucket || '').trim())
    ).length;
    if (unknownBucketed > 0) {
      notes.push(
        `${unknownBucketed} send(s) are one-offs (welcome, tests and the like) — counted in the totals, not the per-bucket rows`
      );
    }
    // EMAIL_TRACKING=0 on the VPS: no pixel or wrapped links of our own.
    // backend/v3/flows/sync_brevo.py copies Brevo's opens and clicks in.
    notes.push(
      "Opens and clicks come from Brevo for the mail sent through it, synced before each morning's send; mail from our own server is untracked"
    );
    if (emailSendsTotal > 0 && openEvents === 0) {
      notes.push(
        'sends recorded but no opens yet — on the VPS: cd ~/trace/backend && ../.venv/bin/python -m v3.flows.sync_brevo'
      );
    }
    if (sendsAll.length >= EMAIL_MAX_DOCS) notes.push(`email_sends hit the ${EMAIL_MAX_DOCS} doc cap`);
    if (eventsAll.length >= EMAIL_MAX_DOCS) notes.push(`email_events hit the ${EMAIL_MAX_DOCS} doc cap`);

    const recentSends = sortedSends.slice(0, 25).map((data) => {
      const trackId = String(data.track_id || '').trim();
      return {
        to: String(data.to || ''),
        bucket: String(data.bucket || ''),
        transport: String(data.transport || ''),
        status: String(data.status || ''),
        dkim: String(data.dkim || ''),
        subject: String(data.subject || ''),
        sentAt: String(data.sent_at || ''),
        error: String(data.error || '').slice(0, 120),
        opened: openedTracks.has(trackId),
        clicked: clickedTracks.has(trackId),
      };
    });

    const recentClicks = eventRows
      .filter((data) => String(data.kind || '').trim() === 'click')
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
      .slice(0, 15)
      .map((data) => {
        const trackId = String(data.track_id || '').trim();
        return {
          at: String(data.at || ''),
          target: String(data.target || ''),
          bucket: trackBucket.get(trackId) || 'unknown',
          to: trackRecipient.get(trackId) || '',
        };
      });

    // ---- Email growth --------------------------------------------------------
    // Signups by day whether or not they later left (landingSignups above only
    // counts the ones still on the list), against opt-outs and bounces.
    // Same window as the charts: from UTC midnight 29 days ago.
    const inWindow = (at: Date | null): at is Date => Boolean(at && dayKey(at) >= emailSince);
    // Brevo's opt-outs set the suppression fields too (sync_brevo.py); they're
    // unsubscribes, so only the delivery failures count as bounced here.
    const OPT_OUT_REASONS = new Set(['unsubscribe', 'complaint']);
    const LANDING_BOUNCES = new Set(['brevo:hard_bounce', 'brevo:blocked_in_brevo']);
    const newSubsSeries = emptySeries(30);
    const unsubSeries = emptySeries(30);
    const suppressedSeries = emptySeries(30);
    const bump = (series: Record<string, number>, at: Date | null) => {
      if (!at) return;
      const key = dayKey(at);
      if (key in series) series[key] += 1;
    };
    const recentSignups: { at: string; email: string; source: string; active: boolean; hasAccount: boolean }[] = [];
    const sources = new Map<string, number>();
    let newSubs = 0;
    let newSubsStillOn = 0;
    const unsubscribed = new Set<string>();
    const bounced = new Set<string>();
    const bounceReasons = new Map<string, number>();
    landingSubs.forEach((data) => {
      const email = String(data.email || '').trim().toLowerCase();
      const at = toDate(data.subscribedAt);
      if (inWindow(at)) {
        bump(newSubsSeries, at);
        newSubs += 1;
        if (data.active === true) newSubsStillOn += 1;
        const source = String(data.source || 'unknown');
        sources.set(source, (sources.get(source) || 0) + 1);
        recentSignups.push({
          at: at.toISOString(),
          email,
          source,
          active: data.active === true,
          hasAccount: accountEmails.has(email),
        });
      }
      const left = toDate(data.unsubscribedAt);
      if (data.active !== true && inWindow(left)) {
        const reason = String(data.unsubscribeReason || '');
        if (LANDING_BOUNCES.has(reason)) {
          bounced.add(email);
          bump(suppressedSeries, left);
          bounceReasons.set(reason.replace('brevo:', ''), (bounceReasons.get(reason.replace('brevo:', '')) || 0) + 1);
        } else if (!unsubscribed.has(email)) {
          unsubscribed.add(email);
          bump(unsubSeries, left);
        }
      }
    });
    let topicsPicked = 0;
    const winbackSends: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
    profiles.forEach(({ data }) => {
      if (data.deleted === true) return;
      const email = String(data.email || '').trim().toLowerCase();
      // newsletterUnsubscribedAt is never cleared, so a reader who turned the
      // daily back on only counts while it's still off.
      const off = emailPreference(data) === 'off';
      const left = toDate(data.newsletterUnsubscribedAt);
      const blocked = toDate(data.newsletterSuppressedAt);
      const reason = String(data.newsletterSuppressedReason || 'unknown');
      if (off && inWindow(blocked) && !OPT_OUT_REASONS.has(reason)) {
        if (!bounced.has(email)) {
          bounced.add(email);
          bump(suppressedSeries, blocked);
          bounceReasons.set(reason, (bounceReasons.get(reason) || 0) + 1);
        }
      } else if (off && inWindow(left) && !unsubscribed.has(email)) {
        unsubscribed.add(email);
        bump(unsubSeries, left);
      }
      if (Array.isArray(data.newsletterTopics) && data.newsletterTopics.length > 0) topicsPicked += 1;
      const wb = Math.min(3, Number(data.winbackSends) || 0);
      if (wb > 0) winbackSends[String(wb)] += 1;
    });
    recentSignups.sort((a, b) => b.at.localeCompare(a.at));

    // Who the latest morning's daily reached, by bucket (welcome emails go out
    // all day and would otherwise make an evening one look like the latest send).
    const dailyRows = sortedSends.filter((d) => ['member', 'winback', 'landing'].includes(String(d.bucket || '')));
    const lastSendDate = dailyRows.length ? String(dailyRows[0].date || '').slice(0, 10) : '';
    const lastSendBuckets = countBy(
      dailyRows
        .filter((d) => String(d.date || '').slice(0, 10) === lastSendDate && String(d.status || '') === 'sent')
        .map((d) => String(d.bucket || ''))
    );

    const emailVisits = await emailVisitsPromise;
    if (!emailVisits) {
      notes.push(
        process.env.POSTHOG_PERSONAL_API_KEY
          ? 'visits from email: the PostHog query failed or timed out'
          : 'visits from email need POSTHOG_PERSONAL_API_KEY in frontend/.env'
      );
    }

    // ---- Overview (mailcheap-style headline numbers) ------------------------
    // Daily sends only (member, win-back, email-only); rates over the mail
    // Brevo tracked, matched to its events by track_id so an open the day
    // after a send still counts for that send.
    const DAILY = new Set(['member', 'winback', 'landing']);
    const dailySends = sendsAll
      .map(({ data }) => data)
      .filter((d) => DAILY.has(String(d.bucket || '')) && String(d.status || '') === 'sent');
    const eventsByTrack = new Map<string, Set<string>>();
    eventsAll.forEach(({ data }) => {
      const trackId = String(data.track_id || '');
      if (!trackId) return;
      if (!eventsByTrack.has(trackId)) eventsByTrack.set(trackId, new Set());
      eventsByTrack.get(trackId)!.add(String(data.kind || ''));
    });
    // Reader-level changes over 60 days, by day: who joined, left, or bounced.
    const joinedDays: string[] = [];
    const leftDays = new Map<string, string>();
    const bouncedDays = new Map<string, string>();
    const inRange = (at: Date | null): at is Date => Boolean(at && dayKey(at) >= prevSince);
    landingSubs.forEach((data) => {
      const email = String(data.email || '').trim().toLowerCase();
      const at = toDate(data.subscribedAt);
      if (inRange(at)) joinedDays.push(dayKey(at));
      const left = toDate(data.unsubscribedAt);
      if (data.active !== true && inRange(left)) {
        (LANDING_BOUNCES.has(String(data.unsubscribeReason || '')) ? bouncedDays : leftDays).set(email, dayKey(left));
      }
    });
    profiles.forEach(({ data }) => {
      if (data.deleted === true || emailPreference(data) !== 'off') return;
      const email = String(data.email || '').trim().toLowerCase();
      const blocked = toDate(data.newsletterSuppressedAt);
      const left = toDate(data.newsletterUnsubscribedAt);
      if (inRange(blocked) && !OPT_OUT_REASONS.has(String(data.newsletterSuppressedReason || ''))) {
        if (!bouncedDays.has(email)) bouncedDays.set(email, dayKey(blocked));
      } else if (inRange(left) && !leftDays.has(email) && !bouncedDays.has(email)) {
        leftDays.set(email, dayKey(left));
      }
    });
    const between = (day: string, from: string, to: string) => day >= from && day < to;
    const tomorrow = dayKey(new Date(now + DAY));
    const windowStats = (from: string, to: string) => {
      const rows = dailySends.filter((d) => between(String(d.date || '').slice(0, 10), from, to));
      const tracked = rows.filter((d) => String(d.transport || '') === 'brevo');
      let opened = 0;
      let clicked = 0;
      let bouncedSends = 0;
      tracked.forEach((d) => {
        const kinds = eventsByTrack.get(String(d.track_id || ''));
        if (!kinds) return;
        if (kinds.has('open') || kinds.has('click')) opened += 1;
        if (kinds.has('click')) clicked += 1;
        if (kinds.has('bounce') || kinds.has('blocked')) bouncedSends += 1;
      });
      const days = new Set(rows.map((d) => String(d.date || '').slice(0, 10))).size;
      const left = [...leftDays.values()].filter((day) => between(day, from, to)).length;
      const pct = (n: number, of: number) => (of ? Math.round((n / of) * 1000) / 10 : null);
      return {
        days,
        sent: rows.length,
        tracked: tracked.length,
        delivered: pct(tracked.length - bouncedSends, tracked.length),
        opened: pct(opened, tracked.length),
        clicked: pct(clicked, tracked.length),
        bounced: pct(bouncedSends, tracked.length),
        unsubscribed: pct(left, rows.length),
        unsubscribes: left,
        joined: joinedDays.filter((day) => between(day, from, to)).length,
      };
    };
    const current = windowStats(emailSince, tomorrow);
    const previous = windowStats(prevSince, emailSince);

    // Daily readers: who got the morning email as a subscriber (account
    // holders and email-only readers; win-back isn't subscribed), per day.
    const readersByDay = new Map<string, Set<string>>();
    dailySends.forEach((d) => {
      if (String(d.bucket || '') === 'winback') return;
      const day = String(d.date || '').slice(0, 10);
      if (!readersByDay.has(day)) readersByDay.set(day, new Set());
      readersByDay.get(day)!.add(String(d.to || '').toLowerCase());
    });
    const days60 = lastNDays(60);
    const readers = days60.map((day) => readersByDay.get(day)?.size ?? null);

    // One row per morning send, newest first (beehiiv's post list).
    const sendDays = [...new Set(dailySends.map((d) => String(d.date || '').slice(0, 10)))]
      .filter((day) => day >= emailSince)
      .sort()
      .reverse();
    const issues = sendDays.map((day) => {
      const stats = windowStats(day, dayKey(new Date(Date.parse(`${day}T00:00:00Z`) + DAY)));
      const rows = dailySends.filter((d) => String(d.date || '').slice(0, 10) === day);
      const count = (bucket: string) => rows.filter((d) => String(d.bucket || '') === bucket).length;
      return {
        day,
        // The daily's subject; win-back emails that morning carry their own.
        subject: String(
          (rows.find((d) => d.subject && String(d.bucket || '') !== 'winback') || rows.find((d) => d.subject))?.subject || ''
        ),
        recipients: rows.length,
        members: count('member'),
        landing: count('landing'),
        winback: count('winback'),
        tracked: stats.tracked,
        opened: stats.opened,
        clicked: stats.clicked,
        unsubscribes: stats.unsubscribes,
        joined: stats.joined,
      };
    });
    const overview = {
      current,
      previous,
      // Deltas only mean something when the earlier window has nearly a full month of sends.
      comparable: previous.days >= 25,
      readersDays: days60,
      readers,
      readersNow: readers.slice().reverse().find((n) => n !== null) ?? 0,
      readersSplit: {
        members: lastSendBuckets.find(([b]) => b === 'member')?.[1] ?? 0,
        emailOnly: lastSendBuckets.find(([b]) => b === 'landing')?.[1] ?? 0,
        day: lastSendDate,
      },
      issues,
    };

    return NextResponse.json({
      overview,
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
        emailSends: sends.length,
        emailEvents: events.length,
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
        emailSends: emailSendsSeries,
        emailOpens: emailOpensSeries,
        emailClicks: emailClicksSeries,
        newSubs: newSubsSeries,
        unsubscribes: unsubSeries,
        suppressed: suppressedSeries,
        emailVisits: emailVisits || {},
        activityDays: lastNDays(14),
        reads: readsSeries,
        interactions: interactionSeries,
      },
      growth: {
        newSubs,
        newSubsStillOn,
        sources: [...sources.entries()].sort((a, b) => b[1] - a[1]),
        unsubscribes: unsubscribed.size,
        suppressed: bounced.size,
        suppressedReasons: [...bounceReasons.entries()].sort((a, b) => b[1] - a[1]),
        // Email-only readers: subscribers who also have an account get the member email.
        listActive: landingEffective,
        accountsDailyOn: prefCounts.on + prefCounts.unset,
        accountsDailyOff: prefCounts.off,
        topicsPicked,
        winbackSends,
        emailVisitors: emailVisits ? Object.values(emailVisits).reduce((a, b) => a + b, 0) : null,
        lastSendDate,
        lastSendBuckets,
        recentSignups: recentSignups.slice(0, 20),
      },
      email: {
        totals: {
          sends: emailSendsTotal,
          recipients: recipients.size,
          sent: emailSent,
          failed: emailFailed,
          fallbacks: emailFallbacks,
          openEvents,
          clickEvents,
          openers: openedTracks.size,
          clickers: clickedTracks.size,
          openRate: emailSendsTotal ? Math.round((openedTracks.size / emailSendsTotal) * 100) : 0,
          clickRate: emailSendsTotal ? Math.round((clickedTracks.size / emailSendsTotal) * 100) : 0,
          lastSendAt: sortedSends.length
            ? String(sortedSends[0].sent_at || sortedSends[0].date || '')
            : '',
        },
        transport: countBy(sendRows.map((d) => String(d.transport || ''))),
        dkim: countBy(sendRows.map((d) => String(d.dkim || ''))),
        byBucket: emailByBucket,
        topTargets: countBy(clickTargets).slice(0, 8),
        recentSends,
        recentClicks,
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
