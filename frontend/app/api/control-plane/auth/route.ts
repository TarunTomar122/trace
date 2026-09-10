import { NextRequest, NextResponse } from 'next/server';
import {
  CONTROL_PLANE_COOKIE,
  createControlPlaneToken,
  isControlPlaneConfigured,
  verifyControlPlanePassword,
} from '@/lib/control-plane-auth';

export async function POST(request: NextRequest) {
  if (!isControlPlaneConfigured()) {
    return NextResponse.json({ error: 'Control-plane password is not configured.' }, { status: 503 });
  }

  let body: { password?: string };
  try {
    body = await request.json() as { password?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (!verifyControlPlanePassword(body.password || '')) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CONTROL_PLANE_COOKIE, createControlPlaneToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CONTROL_PLANE_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return response;
}
