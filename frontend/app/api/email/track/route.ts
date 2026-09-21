import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Open and click tracking for the daily email.
 *
 *   /api/email/track?e=o&t=<trackId>            → 1x1 pixel (open)
 *   /api/email/track?e=c&t=<trackId>&u=<url>    → 302 to the app (click)
 *
 * `<trackId>` is a per-send UUID minted by v1/tools/email_sender.py. It is
 * unguessable rather than signed, which is enough for aggregate stats and
 * avoids putting a secret in every email.
 */

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function pixel() {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
    },
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const event = params.get('e') || 'o';
  const trackId = (params.get('t') || '').trim();

  if (event === 'c') {
    const target = params.get('u') || '';
    let destination = 'https://yourtrace.online/feed?from=email';
    try {
      const url = new URL(target);
      // Only ever redirect to our own surface: this endpoint must not become
      // an open redirect.
      if (url.hostname.endsWith('yourtrace.online')) destination = url.toString();
    } catch {
      /* keep the default */
    }
    void record(trackId, 'click', destination);
    return NextResponse.redirect(destination, 302);
  }

  void record(trackId, 'open');
  return pixel();
}

async function record(trackId: string, kind: 'open' | 'click', target = '') {
  if (!trackId || !adminDb) return;
  try {
    await adminDb.collection('email_events').add({
      track_id: trackId,
      kind,
      target,
      user_agent: '',
      at: new Date().toISOString(),
      date: new Date().toISOString().slice(0, 10),
    });
  } catch (error) {
    console.error('email track error:', error);
  }
}
