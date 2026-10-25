import type { NextRequest } from 'next/server.js';
import { NextResponse } from 'next/server.js';
import {
  looksSignedIn,
  TRACE_SESSION_COOKIE_NAME,
  TRACE_SIGNED_IN_COOKIE_NAME,
} from './lib/server-session.ts';

export function proxy(request: NextRequest) {
  if (looksSignedIn(
    request.cookies.get(TRACE_SESSION_COOKIE_NAME)?.value,
    request.cookies.get(TRACE_SIGNED_IN_COOKIE_NAME)?.value,
  )) {
    return NextResponse.redirect(new URL('/feed', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/',
};
