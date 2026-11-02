import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { SPONSOR_PLACEMENTS, sponsorHref, type SponsorPlacement } from '@/lib/sponsor-link';
import { captureServerEvent } from '@/lib/posthog-server';

// A sponsor link in the daily email: count the click in sponsor_clicks (like
// /api/tools/click does for the site's beacon), then send the reader to the
// sponsor with Trace's UTM tags. Email has no JavaScript, hence a redirect.
// `t` is the email send's id (email_sends.track_id): the PostHog event
// `sponsored_tool_clicked` (placement email) carries it, so a click can be
// tied to the reader it was sent to.
// Mail scanners that follow every link are only partly filtered (by user agent).

const BOT = /bot|crawl|spider|slurp|preview|fetch|curl|wget|python|headless|scanner|proofpoint|mimecast|barracuda/i;
const HOME = 'https://yourtrace.online/feed';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || '';
  const placement = (request.nextUrl.searchParams.get('p') || 'email') as SponsorPlacement;
  const rawTrack = request.nextUrl.searchParams.get('t') || '';
  const trackId = /^[a-f0-9]{32}$/.test(rawTrack) ? rawTrack : '';
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id) || !SPONSOR_PLACEMENTS.includes(placement) || !adminDb) {
    return NextResponse.redirect(HOME, 302);
  }
  try {
    const sponsor = await adminDb.collection('promoted_tools').doc(id).get();
    const data = sponsor.data() || {};
    const url = String(data.url || '');
    if (!sponsor.exists || !/^https?:\/\//.test(url)) return NextResponse.redirect(HOME, 302);
    // A sponsor whose month ended still gets the reader (old emails), but no count.
    // Nor do HEAD requests (link scanners; Next answers HEAD with this handler) or known bots.
    const expires = data.expires_at?.toDate?.() ?? (data.expires_at ? new Date(data.expires_at) : null);
    const live = data.status === 'active' && !(expires && expires.getTime() <= Date.now());
    if (live && request.method === 'GET' && !BOT.test(request.headers.get('user-agent') || '')) {
      const day = new Date().toISOString().slice(0, 10);
      await adminDb.collection('sponsor_clicks').doc(`${id}_${day}`).set(
        {
          sponsor_id: id,
          day,
          clicks: FieldValue.increment(1),
          [`clicks_${placement}`]: FieldValue.increment(1),
          updated_at: new Date(),
        },
        { merge: true },
      );
      await captureServerEvent(trackId ? `email:${trackId}` : `email-sponsor:${id}`, 'sponsored_tool_clicked', {
        sponsor_id: id,
        sponsor_title: String(data.title || ''),
        placement,
        email_track_id: trackId || null,
      });
    }
    return NextResponse.redirect(sponsorHref(url, placement), 302);
  } catch (err) {
    console.error('Sponsor redirect error:', err);
    return NextResponse.redirect(HOME, 302);
  }
}
