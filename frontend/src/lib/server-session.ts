import { createHmac, timingSafeEqual } from 'crypto';

export const TRACE_SESSION_COOKIE_NAME = 'trace_session';
export const TRACE_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type TraceSessionPayload = {
  uid: string;
  iat: number;
  exp: number;
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

export function createTraceSession(uid: string, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const exp = Math.floor((now + TRACE_SESSION_MAX_AGE_MS) / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({ uid, iat, exp } satisfies TraceSessionPayload));
  const body = `${header}.${payload}`;
  return `${body}.${sign(body)}`;
}

export function verifyTraceSession(token: string): TraceSessionPayload | null {
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
    return decoded as TraceSessionPayload;
  } catch {
    return null;
  }
}
