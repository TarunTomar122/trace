import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import {
  createTraceSession,
  TRACE_SESSION_COOKIE_NAME,
  TRACE_SESSION_MAX_AGE_MS,
} from '@/lib/server-session';

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
    const sessionCookie = createTraceSession(decodedToken.uid);

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
