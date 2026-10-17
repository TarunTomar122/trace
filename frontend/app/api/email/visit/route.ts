import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { normalizeTrackId } from '@/lib/email-visit';
import { clientIp, rateLimit } from '@/lib/oauth-http';

/**
 *   POST /api/email/visit  { t: <trackId> }
 *
 * A reader landed on the site from one of the daily's own links
 * (`?from=email&et=<trackId>`). The browser reports it
 * (components/EmailVisitTracker.tsx), so a link scanner that only fetches the
 * URL doesn't count; one that runs the page in a real browser still can.
 * One doc per send, `email_events/visit-<trackId>`, and the morning run
 * (backend/v3/flows/send_audience_newsletter.py) treats that address as
 * active: a win-back reader who comes back joins the daily.
 *
 * Not under /api/email/track: blocklists drop "track" paths, and these
 * readers are exactly the ones we want to count.
 */

// "Googlebot/2.1", "link-checker bot", crawlers; not a phone model like "CUBOT X30".
const AUTOMATED_AGENT = /HeadlessChrome|PhantomJS|[a-z]bot\/|\bbot\b|crawler|spider/i;

export async function POST(request: NextRequest) {
  // Each lookup scans the send log, so a single client can't hammer it.
  const limited = rateLimit(`email-visit:${clientIp(request.headers)}`, 20);
  if (!limited.ok) {
    return NextResponse.json({ ok: false }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
  }

  let trackId = '';
  try {
    trackId = normalizeTrackId((await request.json())?.t);
  } catch {
    /* not JSON */
  }
  if (!trackId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 200);
  if (AUTOMATED_AGENT.test(userAgent)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  if (!adminDb) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  try {
    // Only ids we actually sent: random ids must not fill the event log.
    const sends = await adminDb.collection('email_sends').where('track_id', '==', trackId).limit(1).get();
    const send = sends.docs[0]?.data() as { to?: unknown; bucket?: unknown; date?: unknown } | undefined;
    const email = String(send?.to || '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
    const now = new Date().toISOString();
    await adminDb.collection('email_events').doc(`visit-${trackId}`).set({
      kind: 'visit',
      track_id: trackId,
      email,
      bucket: String(send?.bucket || ''),
      send_date: String(send?.date || ''),
      user_agent: userAgent,
      at: now,
      date: now.slice(0, 10),
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('email visit error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
