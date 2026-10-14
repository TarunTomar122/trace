import type { NextRequest } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import {
  clientIdFromRequest,
  clientIp,
  corsPreflight,
  oauthError,
  oauthJson,
  rateLimit,
  readOAuthParams,
  tooManyRequests,
} from '@/lib/oauth-http';
import {
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  type OAuthDb,
  type TokenResult,
} from '@/lib/oauth-tokens';

/**
 * POST /api/oauth/token — authorization_code (PKCE S256, single use) and
 * refresh_token (rotated on every use) grants for public clients.
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(`token:${clientIp(request.headers)}`, 120);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  if (!adminFirestore) return oauthError('temporarily_unavailable', 'Sign-in is temporarily unavailable', 503);

  const parsed = await readOAuthParams(request);
  if (!parsed.ok) return oauthError('invalid_request', parsed.description);
  const params = parsed.params;
  const client = clientIdFromRequest(request, params);
  if (!client.ok) return oauthError('invalid_client', 'client_id in the body and the Authorization header disagree', 401);

  const db = adminFirestore as unknown as OAuthDb;
  let result: TokenResult;
  try {
    if (params.grant_type === 'authorization_code') {
      result = await exchangeAuthorizationCode(db, {
        code: params.code,
        clientId: client.clientId,
        redirectUri: params.redirect_uri,
        codeVerifier: params.code_verifier,
        resource: params.resource,
      });
    } else if (params.grant_type === 'refresh_token') {
      result = await exchangeRefreshToken(db, {
        refreshToken: params.refresh_token,
        clientId: client.clientId,
        resource: params.resource,
      });
    } else if (!params.grant_type) {
      return oauthError('invalid_request', 'grant_type is required');
    } else {
      return oauthError('unsupported_grant_type', 'Use authorization_code or refresh_token');
    }
  } catch (error) {
    console.error('[api/oauth/token] failed:', error);
    return oauthError('server_error', 'Token request failed', 500);
  }

  if (!result.ok) return oauthError(result.error, result.description);
  return oauthJson(result.tokens);
}

export function OPTIONS() {
  return corsPreflight();
}
