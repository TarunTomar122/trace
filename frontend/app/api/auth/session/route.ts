import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import {
  createTraceSession,
  TRACE_SESSION_COOKIE_NAME,
  TRACE_SESSION_MAX_AGE_MS,
  type TraceSessionProfile,
} from '@/lib/server-session';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDateMaybe(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  if (typeof value?.toDate === 'function') {
    try {
      const parsed = value.toDate();
      return parsed instanceof Date ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

// Mirrors computeFeedAccess in feed-server.ts — kept inline here so we don't
// drag firebase-admin's feed-server module into this route's critical path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeHasAccess(profile: any): boolean {
  const webSub = String(profile?.subscriptionStatus || 'none');
  const appSub = String(profile?.appSubscriptionStatus || 'none');
  let hasAccess = ['trial', 'active'].includes(webSub) || ['trial', 'active'].includes(appSub);
  if (hasAccess && profile?.cancelledAt) {
    const cancelDate = toDateMaybe(profile.willCancelAt) || toDateMaybe(profile.nextBillingDate);
    if (cancelDate && new Date() >= cancelDate) {
      hasAccess = false;
    }
  }
  return hasAccess;
}

async function loadProfileForSession(uid: string): Promise<TraceSessionProfile | null> {
  if (!adminFirestore) return null;
  try {
    const snap = await adminFirestore.collection('user_profiles').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const interests = Array.isArray(data.interests)
      ? data.interests.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
      : null;
    return {
      role: typeof data.role === 'string' ? data.role : null,
      interests,
      onboarded: data.onboarded === true,
      subscriptionStatus: typeof data.subscriptionStatus === 'string' ? data.subscriptionStatus : 'none',
      appSubscriptionStatus: typeof data.appSubscriptionStatus === 'string' ? data.appSubscriptionStatus : 'none',
      hasAccess: computeHasAccess(data),
    };
  } catch (error) {
    console.error('[api/auth/session] loadProfileForSession failed:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!adminAuth) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json().catch(() => null) as { idToken?: string } | null;
    const idToken = typeof body?.idToken === 'string' ? body.idToken : '';
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    // Enrich session cookie with profile so /feed SSR can skip getViewerContext.
    // Runs on every id-token refresh (~hourly), so the cookie stays reasonably
    // in sync with profile changes.
    const profile = await loadProfileForSession(decodedToken.uid);
    const sessionCookie = createTraceSession(decodedToken.uid, profile);

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: TRACE_SESSION_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(TRACE_SESSION_MAX_AGE_MS / 1000),
    });
    return response;
  } catch (error) {
    console.error('[api/auth/session] Failed to create session cookie:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: TRACE_SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
