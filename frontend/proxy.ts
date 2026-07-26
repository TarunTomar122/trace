import type { NextRequest } from 'next/server.js';
import { NextResponse } from 'next/server.js';
import { TRACE_SESSION_COOKIE_NAME, verifyTraceSession } from './lib/server-session.ts';

export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get(TRACE_SESSION_COOKIE_NAME)?.value;
  if (sessionCookie && verifyTraceSession(sessionCookie)) {
    return NextResponse.redirect(new URL('/feed', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/',
};
