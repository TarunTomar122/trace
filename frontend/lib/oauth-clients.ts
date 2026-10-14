import { randomBytes } from 'node:crypto';
import { OAUTH_SCOPE } from './oauth-config.ts';
import { OAUTH_COLLECTIONS, type OAuthDb } from './oauth-tokens.ts';

/**
 * Who may ask for Trace access, and where the answer may be sent.
 *
 * Two kinds of public client (no secrets anywhere):
 * - Client ID Metadata Documents: the client_id is an https URL whose JSON
 *   lists the redirect URIs (Claude, ChatGPT, Codex, VS Code).
 * - Dynamic Client Registration, RFC 7591 (Cursor, Claude Code, Gemini CLI).
 */

export type OAuthClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  clientUri: string | null;
  kind: 'metadata_document' | 'registered';
};

const DCR_CLIENT_PREFIX = 'trace_client_';
const DCR_CLIENT_ID = /^trace_client_[A-Za-z0-9_-]{22}$/;
const MAX_REDIRECT_URIS = 10;
const MAX_REDIRECT_URI_LENGTH = 2000;
const MAX_CLIENT_NAME_LENGTH = 80;

const METADATA_FETCH_TIMEOUT_MS = 4000;
const METADATA_MAX_BYTES = 16 * 1024;
const METADATA_CACHE_TTL_MS = 5 * 60 * 1000;
const METADATA_CACHE_MAX = 200;

// Schemes a browser must never be sent to with an authorization code.
const BLOCKED_SCHEMES = new Set([
  'about', 'blob', 'data', 'file', 'filesystem', 'ftp', 'javascript', 'mailto',
  'sms', 'tel', 'vbscript', 'view-source', 'ws', 'wss',
]);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isLoopbackHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === '[::1]' || hostname === 'localhost';
}

/**
 * RFC 8252 + OAuth 2.1 rules: https anywhere, http only on loopback (any
 * port), or a private-use scheme such as cursor:// for native apps. Never a
 * fragment, credentials, or a scheme that runs code or reads files.
 */
export function validateRedirectUri(value: unknown): { ok: true; uri: string } | { ok: false; reason: string } {
  if (typeof value !== 'string' || !value) return { ok: false, reason: 'redirect URI must be a non-empty string' };
  if (value.length > MAX_REDIRECT_URI_LENGTH) return { ok: false, reason: 'redirect URI is too long' };
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return { ok: false, reason: 'redirect URI contains whitespace or control characters' };
  const url = parseUrl(value);
  if (!url) return { ok: false, reason: `${value} is not an absolute URI` };
  if (value.includes('#')) return { ok: false, reason: 'redirect URI must not contain a fragment' };
  if (url.username || url.password) return { ok: false, reason: 'redirect URI must not contain credentials' };
  const scheme = url.protocol.slice(0, -1).toLowerCase();
  // "https:evil.com/cb" parses, but a browser resolves it relative to Trace: require the //.
  if ((scheme === 'https' || scheme === 'http') && !/^https?:\/\//i.test(value)) {
    return { ok: false, reason: `${scheme} redirect URI must start with ${scheme}://` };
  }
  if (scheme === 'https') {
    return url.hostname ? { ok: true, uri: value } : { ok: false, reason: 'https redirect URI needs a host' };
  }
  if (scheme === 'http') {
    return isLoopbackHost(url.hostname)
      ? { ok: true, uri: value }
      : { ok: false, reason: 'http redirect URIs must use 127.0.0.1, [::1] or localhost' };
  }
  if (BLOCKED_SCHEMES.has(scheme)) return { ok: false, reason: `${scheme}: redirect URIs are not allowed` };
  return { ok: true, uri: value };
}

/**
 * Exact string match against a registered URI. The one exception is RFC 8252
 * §7.3: a loopback redirect may use any port, as native apps pick a free one.
 */
export function redirectUriMatches(registered: string, requested: string): boolean {
  if (registered === requested) return true;
  const a = parseUrl(registered);
  const b = parseUrl(requested);
  if (!a || !b || a.protocol !== 'http:' || b.protocol !== 'http:') return false;
  if (!isLoopbackHost(a.hostname) || a.hostname !== b.hostname) return false;
  if (b.username || b.password || requested.includes('#')) return false;
  return a.pathname === b.pathname && a.search === b.search;
}

/** Where the browser goes after Allow, in words the reader recognises. */
export function redirectDestination(redirectUri: string): string {
  const url = parseUrl(redirectUri);
  if (!url) return 'the app';
  const scheme = url.protocol.slice(0, -1);
  if (scheme === 'https') return url.hostname;
  if (scheme === 'http') return 'an app on this computer';
  return `the ${scheme} app`;
}

function cleanClientName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const name = value.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  return name.length > MAX_CLIENT_NAME_LENGTH ? `${name.slice(0, MAX_CLIENT_NAME_LENGTH - 1)}…` : name;
}

function cleanHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  const url = parseUrl(value);
  return url && url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
}

function validateRedirectUriList(value: unknown, max: number): { ok: true; uris: string[] } | { ok: false; reason: string } {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, reason: 'redirect_uris must be a non-empty array' };
  if (value.length > max) return { ok: false, reason: `at most ${max} redirect_uris are allowed` };
  const uris: string[] = [];
  for (const item of value) {
    const result = validateRedirectUri(item);
    if (!result.ok) return result;
    if (!uris.includes(result.uri)) uris.push(result.uri);
  }
  return { ok: true, uris };
}

export type RegistrationResult =
  | { ok: true; metadata: { clientName: string; clientUri: string | null; redirectUris: string[] } }
  | { ok: false; error: 'invalid_redirect_uri' | 'invalid_client_metadata'; description: string };

/**
 * RFC 7591 request validation. Every client is registered as public
 * ('none'): a requested client_secret_* method is replaced, which the
 * response reports, rather than refused.
 */
export function validateRegistration(body: unknown): RegistrationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_client_metadata', description: 'Registration body must be a JSON object' };
  }
  const input = body as Record<string, unknown>;
  const redirects = validateRedirectUriList(input.redirect_uris, MAX_REDIRECT_URIS);
  if (!redirects.ok) return { ok: false, error: 'invalid_redirect_uri', description: redirects.reason };
  if (input.response_types !== undefined
    && !(Array.isArray(input.response_types) && input.response_types.includes('code'))) {
    return { ok: false, error: 'invalid_client_metadata', description: 'response_types must include code' };
  }
  if (input.grant_types !== undefined
    && !(Array.isArray(input.grant_types) && input.grant_types.includes('authorization_code'))) {
    return { ok: false, error: 'invalid_client_metadata', description: 'grant_types must include authorization_code' };
  }
  return {
    ok: true,
    metadata: {
      clientName: cleanClientName(input.client_name),
      clientUri: cleanHttpsUrl(input.client_uri),
      redirectUris: redirects.uris,
    },
  };
}

export async function registerClient(
  db: OAuthDb,
  metadata: { clientName: string; clientUri: string | null; redirectUris: string[] },
  now = Date.now(),
) {
  const clientId = `${DCR_CLIENT_PREFIX}${randomBytes(16).toString('base64url')}`;
  const issuedAt = Math.floor(now / 1000);
  await db.collection(OAUTH_COLLECTIONS.clients).doc(clientId).set({
    clientId,
    clientName: metadata.clientName,
    clientUri: metadata.clientUri,
    redirectUris: metadata.redirectUris,
    tokenEndpointAuthMethod: 'none',
    createdAt: new Date(now),
  });
  return {
    client_id: clientId,
    client_id_issued_at: issuedAt,
    ...(metadata.clientName ? { client_name: metadata.clientName } : {}),
    ...(metadata.clientUri ? { client_uri: metadata.clientUri } : {}),
    redirect_uris: metadata.redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: OAUTH_SCOPE,
  };
}

type LookupImpl = (host: string) => Promise<string[]>;

async function defaultLookup(host: string): Promise<string[]> {
  const { lookup } = await import('node:dns/promises');
  return (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);
}

/** Public unicast only: no loopback, private, link-local, CGNAT, multicast or IPv4 hidden in IPv6. */
export function isPublicAddress(address: string): boolean {
  let value = address.toLowerCase().split('%')[0];
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/) || value.match(/^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) value = mapped[1];
  const v4 = value.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)));
  }
  if (!value.includes(':')) return false;
  if (value === '::' || value === '::1' || /^::(ffff:)?[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(value)) return false;
  // fc00::/7 unique local, fe80::/10 link-local, ff00::/8 multicast, 64:ff9b::/96 NAT64 (hex form)
  return !/^(f[cd]|fe[89ab]|ff)/.test(value) && !value.startsWith('64:ff9b:');
}

/**
 * A client_id that is a metadata document URL: https, a real path, already
 * in normal form (no dot segments, default port, fragment or credentials) and
 * a public DNS name, never an IP literal or an internal host.
 */
export function parseClientIdUrl(clientId: string): URL | null {
  if (clientId.length > 512) return null;
  const url = parseUrl(clientId);
  if (!url || url.href !== clientId || url.protocol !== 'https:') return null;
  if (url.username || url.password || url.hash || url.pathname === '/') return null;
  const host = url.hostname;
  if (url.port || host.endsWith('.')) return null; // default port only; "localhost." is localhost
  if (host.startsWith('[') || /^[\d.]+$/.test(host) || !host.includes('.')) return null;
  if (/(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/.test(host)) return null;
  return url;
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new Error('metadata document is too large');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error('metadata document is too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function clientFromMetadataDocument(document: unknown, clientId: string): { ok: true; client: OAuthClient } | { ok: false; reason: string } {
  const url = parseClientIdUrl(clientId);
  if (!url) return { ok: false, reason: 'client_id is not a valid metadata document URL' };
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return { ok: false, reason: 'client metadata document must be a JSON object' };
  }
  const data = document as Record<string, unknown>;
  if (data.client_id !== clientId) return { ok: false, reason: 'client metadata document client_id does not match its URL' };
  if ('client_secret' in data || 'client_secret_expires_at' in data) {
    return { ok: false, reason: 'client metadata documents must not contain a client secret' };
  }
  if (data.token_endpoint_auth_method !== undefined && data.token_endpoint_auth_method !== 'none') {
    return { ok: false, reason: 'only public clients (token_endpoint_auth_method "none") are supported' };
  }
  const redirects = validateRedirectUriList(data.redirect_uris, 20);
  if (!redirects.ok) return { ok: false, reason: redirects.reason };
  return {
    ok: true,
    client: {
      clientId,
      clientName: cleanClientName(data.client_name) || url.hostname,
      redirectUris: redirects.uris,
      clientUri: cleanHttpsUrl(data.client_uri),
      kind: 'metadata_document',
    },
  };
}

const metadataCache = new Map<string, { client: OAuthClient; expiresAt: number }>();

export function clearClientMetadataCache() {
  metadataCache.clear();
}

async function fetchMetadataClient(
  clientId: string,
  fetchImpl: typeof fetch,
  now: number,
  lookupImpl: LookupImpl | null,
): Promise<{ ok: true; client: OAuthClient } | { ok: false; reason: string }> {
  const cached = metadataCache.get(clientId);
  if (cached && cached.expiresAt > now) return { ok: true, client: cached.client };

  // The name must resolve only to public addresses (127.0.0.1.nip.io and friends are refused).
  // This checks before connecting; it is a guard, not a pin against DNS rebinding.
  if (lookupImpl) {
    try {
      const addresses = await lookupImpl(new URL(clientId).hostname);
      if (!addresses.length || !addresses.every(isPublicAddress)) {
        return { ok: false, reason: 'client metadata document could not be fetched' };
      }
    } catch {
      return { ok: false, reason: 'client metadata document could not be fetched' };
    }
  }

  let document: unknown;
  try {
    const response = await fetchImpl(clientId, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
    });
    // No upstream status on the page: it would let anyone probe hosts through Trace.
    if (!response.ok) return { ok: false, reason: 'client metadata document could not be fetched' };
    document = JSON.parse(await readLimited(response, METADATA_MAX_BYTES));
  } catch (error) {
    const reason = error instanceof Error && error.message.includes('too large')
      ? error.message
      : 'client metadata document could not be fetched or parsed';
    return { ok: false, reason };
  }

  const result = clientFromMetadataDocument(document, clientId);
  if (result.ok) {
    if (metadataCache.size >= METADATA_CACHE_MAX) {
      const oldest = metadataCache.keys().next().value;
      if (oldest) metadataCache.delete(oldest);
    }
    metadataCache.set(clientId, { client: result.client, expiresAt: now + METADATA_CACHE_TTL_MS });
  }
  return result;
}

export async function resolveClient(
  db: OAuthDb,
  clientId: unknown,
  options: { fetchImpl?: typeof fetch; now?: number; lookupImpl?: LookupImpl | null } = {},
): Promise<{ ok: true; client: OAuthClient } | { ok: false; reason: string }> {
  if (typeof clientId !== 'string' || !clientId) return { ok: false, reason: 'client_id is required' };
  if (clientId.startsWith('https://')) {
    if (!parseClientIdUrl(clientId)) return { ok: false, reason: 'client_id is not a valid metadata document URL' };
    // Real DNS checks unless a test injects its own fetch (and no lookup).
    const lookupImpl = options.lookupImpl !== undefined ? options.lookupImpl : options.fetchImpl ? null : defaultLookup;
    return fetchMetadataClient(clientId, options.fetchImpl ?? fetch, options.now ?? Date.now(), lookupImpl);
  }
  if (!DCR_CLIENT_ID.test(clientId)) return { ok: false, reason: 'Unknown client_id' };
  const snapshot = await db.collection(OAUTH_COLLECTIONS.clients).doc(clientId).get();
  const data = snapshot.exists ? snapshot.data() || {} : null;
  if (!data || !Array.isArray(data.redirectUris)) return { ok: false, reason: 'Unknown client_id' };
  return {
    ok: true,
    client: {
      clientId,
      clientName: cleanClientName(data.clientName),
      redirectUris: data.redirectUris.filter((uri): uri is string => typeof uri === 'string'),
      clientUri: typeof data.clientUri === 'string' ? data.clientUri : null,
      kind: 'registered',
    },
  };
}
