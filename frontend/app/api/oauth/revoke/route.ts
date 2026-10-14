import type { NextRequest } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import {
  clientIdFromRequest,
  clientIp,
  corsPreflight,
  OAUTH_CORS_HEADERS,
  oauthError,
  rateLimit,
  readOAuthParams,
  tooManyRequests,
} from '@/lib/oauth-http';
import { revokeToken, type OAuthDb } from '@/lib/oauth-tokens';

/**
 * POST /api/oauth/revoke — RFC 7009. Always 200 for a well-formed request,
 * whether or not the token existed, so it can't be used to test tokens.
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(`revoke:${clientIp(request.headers)}`, 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  if (!adminFirestore) return oauthError('temporarily_unavailable', 'Revocation is temporarily unavailable', 503);

  const parsed = await readOAuthParams(request);
  if (!parsed.ok) return oauthError('invalid_request', parsed.description);
  if (!parsed.params.token) return oauthError('invalid_request', 'token is required');
  const client = clientIdFromRequest(request, parsed.params);
  if (!client.ok) return oauthError('invalid_client', 'client_id in the body and the Authorization header disagree', 401);

  try {
    await revokeToken(adminFirestore as unknown as OAuthDb, parsed.params.token, client.clientId);
  } catch (error) {
    console.error('[api/oauth/revoke] failed:', error);
    return oauthError('server_error', 'Revocation failed', 500);
  }
  return new Response(null, { status: 200, headers: { ...OAUTH_CORS_HEADERS, 'Cache-Control': 'no-store' } });
}

export function OPTIONS() {
  return corsPreflight();
}
