import { authenticateAgentKey, bearerToken } from '@/lib/agent-access';
import { adminFirestore } from '@/lib/firebase-admin';
import { mcpResource, OAUTH_SCOPE, protectedResourceMetadataUrl } from '@/lib/oauth-config';
import { looksLikeAccessToken, verifyAccessToken, type OAuthDb } from '@/lib/oauth-tokens';

export type McpAccess =
  | { ok: true; uid: string; via: 'oauth' | 'agent_key' }
  | { ok: false; status: 401 | 402 | 503; error: string; wwwAuthenticate: string };

/**
 * RFC 6750 / RFC 9728 challenge. resource_metadata is how an MCP client
 * discovers that it should sign the reader in; error="invalid_token" tells it
 * to refresh (or sign in again) rather than give up.
 */
export function mcpWwwAuthenticate(origin: string, invalidToken?: string): string {
  const parts = [
    `resource_metadata="${protectedResourceMetadataUrl(origin)}"`,
    `scope="${OAUTH_SCOPE}"`,
  ];
  if (invalidToken) parts.push('error="invalid_token"', `error_description="${invalidToken.replace(/["\\]/g, '')}"`);
  return `Bearer ${parts.join(', ')}`;
}

/** The MCP endpoint takes an OAuth access token or a Trace Agent Key. */
export async function authenticateMcpRequest(authorization: string | null, origin: string): Promise<McpAccess> {
  const token = bearerToken(authorization);
  if (!token) {
    return { ok: false, status: 401, error: 'Sign in to Trace to use this MCP server', wwwAuthenticate: mcpWwwAuthenticate(origin) };
  }

  if (looksLikeAccessToken(token)) {
    if (!adminFirestore) {
      return { ok: false, status: 503, error: 'Agent access is temporarily unavailable', wwwAuthenticate: mcpWwwAuthenticate(origin) };
    }
    const result = await verifyAccessToken(adminFirestore as unknown as OAuthDb, token, mcpResource(origin));
    if (result.ok) return { ok: true, uid: result.uid, via: 'oauth' };
    const message = result.reason === 'expired' ? 'The access token expired' : 'The access token is invalid or revoked';
    return { ok: false, status: 401, error: message, wwwAuthenticate: mcpWwwAuthenticate(origin, message) };
  }

  const access = await authenticateAgentKey(token);
  if (access.ok) return { ok: true, uid: access.uid, via: 'agent_key' };
  return {
    ok: false,
    status: access.status,
    error: access.error,
    wwwAuthenticate: mcpWwwAuthenticate(origin, access.status === 401 ? access.error : undefined),
  };
}
