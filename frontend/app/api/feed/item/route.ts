import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { TRACE_SESSION_COOKIE_NAME, verifyTraceSession } from '@/lib/server-session';
import { getFeedItemDetailForUid } from '@/lib/feed-server';

export async function GET(request: NextRequest) {
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

    const roleFromQuery = request.nextUrl.searchParams.get('role') || '';
    const detail = await getFeedItemDetailForUid(uid, itemId, roleFromQuery);
    if (!detail) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(detail, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=900',
      },
    });
  } catch (error) {
    console.error('[api/feed/item] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
