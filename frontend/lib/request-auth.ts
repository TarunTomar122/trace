import type { NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { TRACE_SESSION_COOKIE_NAME, verifyTraceSession } from '@/lib/server-session';
import { extensionBearerToken, getExtensionSessionUid } from '@/lib/extension-session';

export async function getSignedInUid(request: NextRequest): Promise<string> {
  const sessionCookie = request.cookies.get(TRACE_SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? verifyTraceSession(sessionCookie) : null;
  if (session?.uid) return session.uid;

  const authorization = request.headers.get('authorization');
  const extensionToken = extensionBearerToken(authorization);
  if (extensionToken) return getExtensionSessionUid(extensionToken);
  if (!authorization?.startsWith('Bearer ') || !adminAuth) return '';
  try {
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7).trim());
    return decoded.uid;
  } catch {
    return '';
  }
}
