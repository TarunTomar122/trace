import { SITE_BASE_URL } from './seo.ts';

/**
 * URLs and metadata for Trace's OAuth 2.1 authorization server, which signs
 * agents into the MCP server (MCP authorization spec, 2025-06-18).
 *
 * The issuer is the site itself; the MCP endpoint is the only protected
 * resource, and every token is bound to it as its audience.
 */

export const MCP_PATH = '/api/mcp';
export const OAUTH_SCOPE = 'trace:read';
export const AUTHORIZE_PATH = '/oauth/authorize';
export const TOKEN_PATH = '/api/oauth/token';
export const REGISTER_PATH = '/api/oauth/register';
export const REVOKE_PATH = '/api/oauth/revoke';
export const PROTECTED_RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource';

/**
 * The origin every OAuth URL is built from. Production uses the canonical www
 * origin (or TRACE_OAUTH_ORIGIN on a self-hosted instance), never the Host
 * header, so a forged header can't move the issuer. Local dev uses the
 * request's own origin so a flow on localhost round-trips.
 */
export function oauthOrigin(requestOrigin?: string | null): string {
  const configured = process.env.TRACE_OAUTH_ORIGIN?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production' && requestOrigin) {
    return requestOrigin.replace(/\/+$/, '');
  }
  return SITE_BASE_URL;
}

export function mcpResource(origin: string): string {
  return `${origin}${MCP_PATH}`;
}

/** The URL readers paste into their MCP client. */
export const TRACE_MCP_URL = mcpResource(SITE_BASE_URL);

export function protectedResourceMetadataUrl(origin: string): string {
  return `${origin}${PROTECTED_RESOURCE_METADATA_PATH}${MCP_PATH}`;
}

/** RFC 8707 resource indicators: one trailing slash is the same resource. */
export function normalizeResource(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

/** RFC 9728 protected resource metadata for the MCP endpoint. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResource(origin),
    authorization_servers: [origin],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'Trace',
    resource_documentation: `${origin}/agents`,
  };
}

/** RFC 8414 authorization server metadata. */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}${AUTHORIZE_PATH}`,
    token_endpoint: `${origin}${TOKEN_PATH}`,
    registration_endpoint: `${origin}${REGISTER_PATH}`,
    revocation_endpoint: `${origin}${REVOKE_PATH}`,
    scopes_supported: [OAUTH_SCOPE],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    authorization_response_iss_parameter_supported: true,
    client_id_metadata_document_supported: true,
    service_documentation: `${origin}/agents`,
    op_policy_uri: `${origin}/privacy-policy`,
    op_tos_uri: `${origin}/terms`,
  };
}
