import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import {
  createTraceSession,
  TRACE_SESSION_COOKIE_NAME,
  TRACE_SESSION_MAX_AGE_MS,
  isTraceSessionProfileFresh,
  verifyTraceSession,
  type TraceSessionProfile,
} from '@/lib/server-session';
import { hasActiveSubscription } from '@/lib/subscription-access';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeHasAccess(profile: any): boolean {
  return hasActiveSubscription(profile);
}

type SessionProfileResult =
  | { status: 'found'; profile: TraceSessionProfile }
  | { status: 'missing' }
  | { status: 'unavailable' };

async function loadProfileForSession(uid: string): Promise<SessionProfileResult> {
  if (!adminFirestore) return { status: 'unavailable' };
  try {
    const snap = await adminFirestore.collection('user_profiles').doc(uid).get();
    if (!snap.exists) return { status: 'missing' };
    const data = snap.data() || {};
    const interests = Array.isArray(data.interests)
      ? data.interests.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
      : null;
    return {
      status: 'found',
      profile: {
        role: typeof data.role === 'string' ? data.role : null,
        interests,
        onboarded: data.onboarded === true,
        subscriptionStatus: typeof data.subscriptionStatus === 'string' ? data.subscriptionStatus : 'none',
        appSubscriptionStatus: typeof data.appSubscriptionStatus === 'string' ? data.appSubscriptionStatus : 'none',
        hasAccess: computeHasAccess(data),
      },
    };
  } catch (error) {
    console.error('[api/auth/session] loadProfileForSession failed:', error);
    return { status: 'unavailable' };
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!adminAuth) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json().catch(() => null) as {
      idToken?: string;
      forceProfileRefresh?: boolean;
    } | null;
    const idToken = typeof body?.idToken === 'string' ? body.idToken : '';
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const existingCookie = request.cookies.get(TRACE_SESSION_COOKIE_NAME)?.value;
    const existingSession = existingCookie ? verifyTraceSession(existingCookie) : null;
    const existingProfileIsFresh = Boolean(
      body?.forceProfileRefresh !== true
      &&
      existingSession?.uid === decodedToken.uid
      && isTraceSessionProfileFresh(existingSession)
    );

    // Reuse a just-issued signed profile during document navigation. Outside
    // that short window, refresh from Firestore so upgrades and revocations
    // converge without turning every /feed entry into a profile read.
    const response = NextResponse.json({ ok: true });
    if (existingProfileIsFresh) {
      return response;
    }

    const profileResult = await loadProfileForSession(decodedToken.uid);
    if (profileResult.status === 'unavailable') {
      if (existingSession?.uid === decodedToken.uid && existingSession.profile) {
        return response;
      }
      return NextResponse.json(
        { error: 'Profile service unavailable' },
        { status: 503 },
      );
    }

    const profile = profileResult.status === 'found' ? profileResult.profile : null;
    const sessionCookie = createTraceSession(decodedToken.uid, profile);
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
