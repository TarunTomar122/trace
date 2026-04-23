import { createHmac, timingSafeEqual } from 'crypto';

export const TRACE_SESSION_COOKIE_NAME = 'trace_session';
export const TRACE_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Optional viewer profile fields embedded in the session cookie so the feed
// page SSR can skip a Firestore user-profile read. These are signed (HMAC),
// so the client can't forge values like `hasAccess`.
export type TraceSessionProfile = {
  role?: string | null;
  interests?: string[] | null;
  onboarded?: boolean | null;
  subscriptionStatus?: string | null;
  appSubscriptionStatus?: string | null;
  hasAccess?: boolean | null;
};

type TraceSessionPayload = {
  uid: string;
  iat: number;
  exp: number;
  // Short-keyed to keep the cookie small.
  r?: string;        // role
  i?: string[];      // interests
  ob?: boolean;      // onboarded
  ss?: string;       // subscriptionStatus
  as?: string;       // appSubscriptionStatus
  ha?: boolean;      // hasAccess
};

export type VerifiedTraceSession = {
  uid: string;
  iat: number;
  exp: number;
  profile: TraceSessionProfile | null;
};

function getSessionSecret() {
  const secret = process.env.TRACE_SESSION_SECRET || process.env.INSTAGRAM_RENDER_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'trace-dev-session-secret-change-me';
  }

  throw new Error('TRACE_SESSION_SECRET is not configured');
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(input: string) {
  return createHmac('sha256', getSessionSecret()).update(input).digest('base64url');
}

export function createTraceSession(
  uid: string,
  profile?: TraceSessionProfile | null,
  now = Date.now(),
) {
  const iat = Math.floor(now / 1000);
  const exp = Math.floor((now + TRACE_SESSION_MAX_AGE_MS) / 1000);
  const base: TraceSessionPayload = { uid, iat, exp };
  if (profile) {
    if (typeof profile.role === 'string' && profile.role.trim().length > 0) base.r = profile.role;
    if (Array.isArray(profile.interests) && profile.interests.length > 0) {
      // Cap interests in the cookie to avoid blowing past the 4KB cookie limit.
      base.i = profile.interests.filter((x): x is string => typeof x === 'string').slice(0, 24);
    }
    if (typeof profile.onboarded === 'boolean') base.ob = profile.onboarded;
    if (typeof profile.subscriptionStatus === 'string') base.ss = profile.subscriptionStatus;
    if (typeof profile.appSubscriptionStatus === 'string') base.as = profile.appSubscriptionStatus;
    if (typeof profile.hasAccess === 'boolean') base.ha = profile.hasAccess;
  }
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify(base));
  const body = `${header}.${payload}`;
  return `${body}.${sign(body)}`;
}

export function verifyTraceSession(token: string): VerifiedTraceSession | null {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    const body = `${header}.${payload}`;
    const expected = sign(body);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);
    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      return null;
    }

    const decoded = JSON.parse(base64UrlDecode(payload)) as Partial<TraceSessionPayload>;
    if (typeof decoded.uid !== 'string' || typeof decoded.exp !== 'number' || typeof decoded.iat !== 'number') {
      return null;
    }
    if (decoded.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    const hasAnyProfileField = (
      typeof decoded.r === 'string'
      || Array.isArray(decoded.i)
      || typeof decoded.ob === 'boolean'
      || typeof decoded.ss === 'string'
      || typeof decoded.as === 'string'
      || typeof decoded.ha === 'boolean'
    );
    const profile: TraceSessionProfile | null = hasAnyProfileField
      ? {
          role: typeof decoded.r === 'string' ? decoded.r : null,
          interests: Array.isArray(decoded.i) ? decoded.i.filter((x): x is string => typeof x === 'string') : null,
          onboarded: typeof decoded.ob === 'boolean' ? decoded.ob : null,
          subscriptionStatus: typeof decoded.ss === 'string' ? decoded.ss : null,
          appSubscriptionStatus: typeof decoded.as === 'string' ? decoded.as : null,
          hasAccess: typeof decoded.ha === 'boolean' ? decoded.ha : null,
        }
      : null;

    return {
      uid: decoded.uid,
      iat: decoded.iat,
      exp: decoded.exp,
      profile,
    };
  } catch {
    return null;
  }
}
