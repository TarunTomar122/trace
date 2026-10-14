import type { NextRequest } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import { registerClient, validateRegistration } from '@/lib/oauth-clients';
import { clientIp, corsPreflight, oauthError, oauthJson, rateLimit, tooManyRequests } from '@/lib/oauth-http';
import type { OAuthDb } from '@/lib/oauth-tokens';

const MAX_BODY_BYTES = 16 * 1024;

/**
 * POST /api/oauth/register — RFC 7591 Dynamic Client Registration for public
 * MCP clients (Cursor, Claude Code, Gemini CLI). No secret is ever issued.
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(`register:${clientIp(request.headers)}`, 20);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  if (!adminFirestore) return oauthError('temporarily_unavailable', 'Registration is temporarily unavailable', 503);

  const text = await request.text().catch(() => '');
  if (text.length > MAX_BODY_BYTES) return oauthError('invalid_client_metadata', 'Registration body is too large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return oauthError('invalid_client_metadata', 'Registration body must be JSON');
  }
  const result = validateRegistration(body);
  if (!result.ok) return oauthError(result.error, result.description);

  try {
    return oauthJson(await registerClient(adminFirestore as unknown as OAuthDb, result.metadata), 201);
  } catch (error) {
    console.error('[api/oauth/register] failed:', error);
    return oauthError('server_error', 'Registration failed', 500);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
