/**
 * HTTP plumbing shared by the OAuth endpoints and the MCP route: CORS for
 * browser-based MCP clients, no-store JSON, RFC 6749 error bodies, request
 * parsing and a best-effort rate limit.
 */

// Open CORS without credentials: these endpoints take bearer tokens or
// public-client parameters, never cookies.
export const OAUTH_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id, MCP-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}

export function oauthJson(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: { ...OAUTH_CORS_HEADERS, 'Cache-Control': 'no-store', Pragma: 'no-cache', ...headers },
  });
}

export function oauthError(error: string, description: string, status = 400, headers: Record<string, string> = {}): Response {
  return oauthJson({ error, error_description: description }, status, headers);
}

export function publicMetadataJson(body: unknown): Response {
  return Response.json(body, {
    headers: { ...OAUTH_CORS_HEADERS, 'Cache-Control': 'public, max-age=3600' },
  });
}

export type ParsedParams =
  | { ok: true; params: Record<string, string> }
  | { ok: false; description: string };

/**
 * Token and revocation requests are application/x-www-form-urlencoded
 * (RFC 6749); a JSON body is accepted too because some clients send one.
 * A parameter may appear once.
 */
export async function readOAuthParams(request: Request, maxBytes = 8 * 1024): Promise<ParsedParams> {
  const text = await request.text().catch(() => null);
  if (text === null) return { ok: false, description: 'Request body could not be read' };
  if (text.length > maxBytes) return { ok: false, description: 'Request body is too large' };
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return { ok: false, description: 'Request body is not valid JSON' };
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, description: 'Request body must be an object' };
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') params[key] = value;
      else if (typeof value === 'number') params[key] = String(value);
    }
    return { ok: true, params };
  }
  const search = new URLSearchParams(text);
  const params: Record<string, string> = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    if (values.length > 1) return { ok: false, description: `${key} must not be repeated` };
    params[key] = values[0];
  }
  return { ok: true, params };
}

/**
 * A public client sends client_id in the body; some send HTTP Basic with an
 * empty secret instead. Both must agree when both are present.
 */
export function clientIdFromRequest(request: Request, params: Record<string, string>): { ok: true; clientId: string } | { ok: false } {
  const bodyClientId = params.client_id || '';
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('basic ')) return { ok: true, clientId: bodyClientId };
  let basicClientId = '';
  try {
    const decoded = Buffer.from(authorization.slice(6).trim(), 'base64').toString('utf8');
    basicClientId = decodeURIComponent(decoded.split(':')[0] || '');
  } catch {
    return { ok: false };
  }
  if (bodyClientId && basicClientId && bodyClientId !== basicClientId) return { ok: false };
  return { ok: true, clientId: bodyClientId || basicClientId };
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}

// Fixed windows per serverless instance. Best effort: it slows a single
// abuser down without a database write on every request.
const windows = new Map<string, { count: number; resetAt: number }>();
const MAX_TRACKED_KEYS = 5000;

export function rateLimit(key: string, limit: number, windowMs = 60_000, now = Date.now()): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) {
      for (const [storedKey, value] of windows) {
        if (value.resetAt <= now) windows.delete(storedKey);
      }
      if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  current.count += 1;
  if (current.count > limit) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  return { ok: true };
}

export function resetRateLimits() {
  windows.clear();
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return oauthError('temporarily_unavailable', 'Too many requests. Try again in a minute.', 429, { 'Retry-After': String(retryAfterSeconds) });
}
