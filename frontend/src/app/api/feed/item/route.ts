import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { TRACE_SESSION_COOKIE_NAME, verifyTraceSession } from '@/lib/server-session';
import { getFeedItemDetailForUid } from '@/lib/feed-server';

export async function GET(request: NextRequest) {
  const requestStartedAt = performance.now();
  let authDoneAt = requestStartedAt;
  let lookupDoneAt = requestStartedAt;
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const itemId = request.nextUrl.searchParams.get('id') || '';
    if (!itemId) {
      return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    const sessionCookie = request.cookies.get(TRACE_SESSION_COOKIE_NAME)?.value;

    let uid = '';
    if (sessionCookie) {
      const decodedSession = verifyTraceSession(sessionCookie);
      if (decodedSession) uid = decodedSession.uid;
    } else if (authHeader?.startsWith('Bearer ')) {
      if (!adminAuth) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await adminAuth.verifyIdToken(token);
      uid = decodedToken.uid;
    }

    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    authDoneAt = performance.now();

    const roleFromQuery = request.nextUrl.searchParams.get('role') || '';
    const detail = await getFeedItemDetailForUid(uid, itemId, roleFromQuery);
    lookupDoneAt = performance.now();
    const serverTiming = [
      `auth;dur=${(authDoneAt - requestStartedAt).toFixed(1)}`,
      `lookup;dur=${(lookupDoneAt - authDoneAt).toFixed(1)}`,
      `total;dur=${(lookupDoneAt - requestStartedAt).toFixed(1)}`,
    ].join(', ');
    if (process.env.NODE_ENV !== 'production') {
      console.log('[api/feed/item]', {
        itemId,
        found: Boolean(detail),
        elapsedMs: Number((lookupDoneAt - requestStartedAt).toFixed(1)),
      });
    }
    if (!detail) {
      return NextResponse.json({ error: 'Not found' }, {
        status: 404,
        headers: { 'Server-Timing': serverTiming },
      });
    }

    return NextResponse.json(detail, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=900',
        'Server-Timing': serverTiming,
      },
    });
  } catch (error) {
    console.error('[api/feed/item] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
