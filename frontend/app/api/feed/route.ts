import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import {
  isTraceSessionProfileFresh,
  TRACE_SESSION_COOKIE_NAME,
  verifyTraceSession,
} from '@/lib/server-session';
import { getBootstrapFeedForUid, getBootstrapFeedFromProfile } from '@/lib/feed-server';

export async function GET(request: NextRequest) {
  const requestStartedAt = performance.now();
  let authDoneAt = requestStartedAt;
  let readsDoneAt = requestStartedAt;
  let assembledDoneAt = requestStartedAt;
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    const sessionCookie = request.cookies.get(TRACE_SESSION_COOKIE_NAME)?.value;
    const forceFreshViewer = request.nextUrl.searchParams.get('freshViewer') === '1';

    let uid = '';
    let sessionProfile: ReturnType<typeof verifyTraceSession> = null;
    if (sessionCookie && !forceFreshViewer) {
      sessionProfile = verifyTraceSession(sessionCookie);
      if (sessionProfile) {
        uid = sessionProfile.uid;
      }
    }
    if (!uid && authHeader?.startsWith('Bearer ')) {
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
    const sessionAccessIsFresh = isTraceSessionProfileFresh(sessionProfile);
    const feed = sessionProfile?.profile && sessionAccessIsFresh
      ? await getBootstrapFeedFromProfile(sessionProfile.profile.role || roleFromQuery || 'developer', {
          role: sessionProfile.profile.role || 'developer',
          interests: sessionProfile.profile.interests || [],
          onboarded: sessionProfile.profile.onboarded ?? true,
          subscription_status: sessionProfile.profile.subscriptionStatus || 'none',
          app_subscription_status: sessionProfile.profile.appSubscriptionStatus || 'none',
          has_access: sessionProfile.profile.hasAccess ?? false,
        })
      : await getBootstrapFeedForUid(uid, roleFromQuery);
    readsDoneAt = performance.now();

    if (!feed) {
      return NextResponse.json(null);
    }
    assembledDoneAt = performance.now();

    const serverTiming = [
      `auth;dur=${(authDoneAt - requestStartedAt).toFixed(1)}`,
      `reads;dur=${(readsDoneAt - authDoneAt).toFixed(1)}`,
      `assemble;dur=${(assembledDoneAt - readsDoneAt).toFixed(1)}`,
      `total;dur=${(assembledDoneAt - requestStartedAt).toFixed(1)}`,
    ].join(', ');
    if (process.env.NODE_ENV !== 'production') {
      console.log('[api/feed]', {
        hasFeed: Boolean(feed),
        elapsedMs: Number((assembledDoneAt - requestStartedAt).toFixed(1)),
        serverTiming,
      });
    }

    return NextResponse.json(feed, {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'Server-Timing': serverTiming,
      },
    });
  } catch (error) {
    console.error('[api/feed] Error:', error);
    if (error instanceof Error && error.message?.includes('auth')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
