import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { TRACE_SESSION_COOKIE_NAME, verifyTraceSession } from '@/lib/server-session';
import { getPulseFeedForUid } from '@/lib/feed-server';

export async function GET(request: NextRequest) {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
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

    const roleFromQuery = request.nextUrl.searchParams.get('role') || '';
    const pulseFeed = await getPulseFeedForUid(uid, roleFromQuery);
    return NextResponse.json(pulseFeed, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=900',
      },
    });
  } catch (error) {
    console.error('[api/feed/pulse] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
