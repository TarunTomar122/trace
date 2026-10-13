import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import {
  createTraceSession,
  TRACE_SESSION_COOKIE_NAME,
  TRACE_SESSION_MAX_AGE_MS,
  isTraceSessionProfileFresh,
  verifyTraceSession,
  type TraceSessionProfile,
} from '@/lib/server-session';
import { hasPaidSubscription } from '@/lib/subscription-access';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeHasAccess(profile: any): boolean {
  return hasPaidSubscription(profile);
}

async function ensureUserProfile(
  uid: string,
  identity: { email: string; displayName: string; photoURL: string | null },
): Promise<'created' | 'exists' | 'unavailable'> {
  if (!adminFirestore) return 'unavailable';
  try {
    const ref = adminFirestore.collection('user_profiles').doc(uid);
    const snap = await ref.get();
    const now = FieldValue.serverTimestamp();
    if (!snap.exists) {
      await ref.set({
        uid,
        email: identity.email,
        displayName: identity.displayName,
        photoURL: identity.photoURL,
        signupPlatform: 'web',
        onboarded: false,
        name: identity.displayName || '',
        role: '',
        company: '',
        location: '',
        experienceYears: null,
        currentWork: {},
        projects: [],
        goals: {},
        learningStyle: '',
        attentionConstraints: '',
        motivationTriggers: [],
        interests: [],
        hobbies: [],
        skills: [],
        dislikedTopics: [],
        sourcePreferences: { youtube: 8, articles: 8, papers: 1, repos: 1, tweets: 5, discussions: 5 },
        contentDepth: null,
        contentPreferences: { likes: [], dislikes: [] },
        favoriteSources: [],
        subscriptionStatus: 'none',
        createdAt: now,
        updatedAt: now,
      });
      return 'created';
    }
    // Existing profiles keep whatever onboarding state they have — the web
    // onboarding step flips it when the reader picks interests.
    return 'exists';
  } catch (error) {
    console.error('[api/auth/session] ensureUserProfile failed:', error);
    return 'unavailable';
  }
}

type SessionProfileResult =  | { status: 'found'; profile: TraceSessionProfile }
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
      email?: string;
      displayName?: string;
      photoURL?: string | null;
    } | null;
    const idToken = typeof body?.idToken === 'string' ? body.idToken : '';
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    // Create the profile on sign-in when identity details are provided
    // (replaces client-side getOrCreateUserProfile). Never fails sign-in.
    if (body && (typeof body.email === 'string' || typeof body.displayName === 'string')) {
      await ensureUserProfile(decodedToken.uid, {
        email: typeof body.email === 'string' ? body.email : (decodedToken.email || ''),
        displayName: typeof body.displayName === 'string' ? body.displayName : (decodedToken.name || ''),
        photoURL: body.photoURL === null || typeof body.photoURL === 'string'
          ? body.photoURL
          : ((decodedToken as { picture?: string }).picture || null),
      });
    }
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
