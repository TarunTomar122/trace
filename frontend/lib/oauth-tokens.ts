import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { normalizeResource } from './oauth-config.ts';
import { toDateMaybe } from './subscription-access.ts';

/**
 * Authorization codes, access and refresh tokens for the MCP OAuth server.
 *
 * Every secret is opaque random and only its SHA-256 lives in the database,
 * as the document id. One Allow creates one grant; every code and token it
 * leads to carries the grant id, so revoking the grant (a replayed code, a
 * reused refresh token, a revoke call) cuts off the whole family at once.
 */

export const OAUTH_COLLECTIONS = {
  clients: 'oauth_clients',
  codes: 'oauth_codes',
  tokens: 'oauth_tokens',
  grants: 'oauth_grants',
} as const;

export const CODE_TTL_MS = 5 * 60 * 1000;
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** A rotated refresh token shown again this soon is a retry or two calls racing, not a leak. */
export const REFRESH_REUSE_GRACE_MS = 60 * 1000;

const CODE_PREFIX = 'trace_code_';
export const ACCESS_TOKEN_PREFIX = 'trace_at_';
const REFRESH_TOKEN_PREFIX = 'trace_rt_';
// prefix + 32 random bytes in base64url (43 characters)
const SECRET_LENGTH = 43;

// The Firestore surface used here; both the admin SDK and LocalDB provide it.
export type OAuthDocSnapshot = { exists: boolean; data(): Record<string, unknown> | undefined };
export type OAuthDocRef = {
  get(): Promise<OAuthDocSnapshot>;
  set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
};
export type OAuthTransaction = {
  get(ref: OAuthDocRef): Promise<OAuthDocSnapshot>;
  set(ref: OAuthDocRef, data: Record<string, unknown>, options?: { merge?: boolean }): unknown;
};
export type OAuthDb = {
  collection(path: string): { doc(id: string): OAuthDocRef };
  runTransaction<T>(callback: (transaction: OAuthTransaction) => Promise<T>): Promise<T>;
};

export type TokenSet = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export type TokenError = 'invalid_request' | 'invalid_grant' | 'invalid_target';
export type TokenResult =
  | { ok: true; tokens: TokenSet }
  | { ok: false; error: TokenError; description: string };

export type AccessTokenResult =
  | { ok: true; uid: string; clientId: string; grantId: string; scope: string }
  | { ok: false; reason: 'malformed' | 'unknown' | 'expired' | 'revoked' | 'wrong_audience' };

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function newSecret(prefix: string): string {
  return `${prefix}${randomBytes(32).toString('base64url')}`;
}

function hasSecretShape(value: unknown, prefix: string): value is string {
  return typeof value === 'string'
    && value.length === prefix.length + SECRET_LENGTH
    && value.startsWith(prefix)
    && /^[A-Za-z0-9_-]+$/.test(value.slice(prefix.length));
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// RFC 7636: verifier is 43-128 unreserved characters; an S256 challenge is
// the base64url SHA-256 of it, always 43 characters.
export function isValidCodeVerifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9\-._~]{43,128}$/.test(value);
}

export function isValidCodeChallenge(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function verifyPkce(verifier: unknown, challenge: unknown): boolean {
  if (!isValidCodeVerifier(verifier) || !isValidCodeChallenge(challenge)) return false;
  return constantTimeEqual(pkceChallenge(verifier), challenge);
}

function expired(value: unknown, now: number): boolean {
  const date = toDateMaybe(value);
  return !date || date.getTime() <= now;
}

function fail(error: TokenError, description: string): TokenResult {
  return { ok: false, error, description };
}

function refs(db: OAuthDb) {
  return {
    code: (code: string) => db.collection(OAUTH_COLLECTIONS.codes).doc(sha256Hex(code)),
    token: (token: string) => db.collection(OAUTH_COLLECTIONS.tokens).doc(sha256Hex(token)),
    grant: (grantId: string) => db.collection(OAUTH_COLLECTIONS.grants).doc(grantId),
  };
}

type GrantFields = { grantId: string; uid: string; clientId: string; resource: string; scope: string };

function mintTokens(db: OAuthDb, transaction: OAuthTransaction, grant: GrantFields, now: number): TokenSet {
  const accessToken = newSecret(ACCESS_TOKEN_PREFIX);
  const refreshToken = newSecret(REFRESH_TOKEN_PREFIX);
  const shared = {
    grantId: grant.grantId,
    uid: grant.uid,
    clientId: grant.clientId,
    resource: grant.resource,
    scope: grant.scope,
    createdAt: new Date(now),
    revokedAt: null,
  };
  transaction.set(refs(db).token(accessToken), {
    ...shared,
    kind: 'access',
    expiresAt: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000),
  });
  transaction.set(refs(db).token(refreshToken), {
    ...shared,
    kind: 'refresh',
    expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
    usedAt: null,
  });
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: grant.scope,
  };
}

function revokeGrant(db: OAuthDb, transaction: OAuthTransaction, grantId: unknown, reason: string, now: number) {
  if (typeof grantId !== 'string' || !grantId) return;
  transaction.set(refs(db).grant(grantId), { revokedAt: new Date(now), revokedReason: reason }, { merge: true });
}

export type CodeRequest = {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  uid: string;
  resource: string;
  scope: string;
};

/** A single-use code, bound to the client, redirect URI, PKCE challenge, reader and resource. */
export async function issueAuthorizationCode(db: OAuthDb, request: CodeRequest, now = Date.now()): Promise<string> {
  const code = newSecret(CODE_PREFIX);
  await refs(db).code(code).set({
    clientId: request.clientId,
    clientName: request.clientName,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    codeChallengeMethod: 'S256',
    uid: request.uid,
    resource: request.resource,
    scope: request.scope,
    grantId: randomBytes(16).toString('hex'),
    createdAt: new Date(now),
    expiresAt: new Date(now + CODE_TTL_MS),
    usedAt: null,
  });
  return code;
}

export type CodeExchange = {
  code: unknown;
  clientId: unknown;
  redirectUri: unknown;
  codeVerifier: unknown;
  resource?: unknown;
};

/**
 * authorization_code grant. A code works once: presenting it again fails and
 * revokes every token the first exchange issued (RFC 6749 §4.1.2).
 */
export async function exchangeAuthorizationCode(db: OAuthDb, input: CodeExchange, now = Date.now()): Promise<TokenResult> {
  if (typeof input.clientId !== 'string' || !input.clientId) return fail('invalid_request', 'client_id is required');
  if (typeof input.redirectUri !== 'string' || !input.redirectUri) return fail('invalid_request', 'redirect_uri is required');
  if (!isValidCodeVerifier(input.codeVerifier)) return fail('invalid_request', 'code_verifier is missing or malformed');
  if (input.resource !== undefined && typeof input.resource !== 'string') return fail('invalid_target', 'resource is malformed');
  if (!hasSecretShape(input.code, CODE_PREFIX)) return fail('invalid_grant', 'Unknown or expired authorization code');

  const clientId = input.clientId;
  const redirectUri = input.redirectUri;
  const codeVerifier = input.codeVerifier;
  const resource = typeof input.resource === 'string' ? input.resource : '';
  const codeRef = refs(db).code(input.code);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(codeRef);
    const data = snapshot.exists ? snapshot.data() || {} : null;
    if (!data) return fail('invalid_grant', 'Unknown or expired authorization code');
    if (data.usedAt) {
      revokeGrant(db, transaction, data.grantId, 'code_reuse', now);
      return fail('invalid_grant', 'This authorization code was already used');
    }
    if (expired(data.expiresAt, now)) return fail('invalid_grant', 'Unknown or expired authorization code');
    if (data.clientId !== clientId) return fail('invalid_grant', 'This code was issued to another client');
    if (data.redirectUri !== redirectUri) return fail('invalid_grant', 'redirect_uri does not match the authorization request');
    if (resource && normalizeResource(resource) !== data.resource) {
      return fail('invalid_target', 'resource does not match the authorization request');
    }
    if (!verifyPkce(codeVerifier, data.codeChallenge)) return fail('invalid_grant', 'PKCE verification failed');
    if (typeof data.uid !== 'string' || typeof data.grantId !== 'string' || typeof data.resource !== 'string') {
      return fail('invalid_grant', 'Unknown or expired authorization code');
    }

    const grant: GrantFields = {
      grantId: data.grantId,
      uid: data.uid,
      clientId,
      resource: data.resource,
      scope: typeof data.scope === 'string' ? data.scope : '',
    };
    transaction.set(codeRef, { usedAt: new Date(now) }, { merge: true });
    transaction.set(refs(db).grant(grant.grantId), {
      uid: grant.uid,
      clientId,
      clientName: typeof data.clientName === 'string' ? data.clientName : '',
      resource: grant.resource,
      scope: grant.scope,
      createdAt: new Date(now),
      revokedAt: null,
    });
    return { ok: true, tokens: mintTokens(db, transaction, grant, now) };
  });
}

export type RefreshExchange = { refreshToken: unknown; clientId: unknown; resource?: unknown };

/**
 * refresh_token grant with rotation: each refresh token works once. Using a
 * rotated one again means it leaked, so the whole grant is revoked — unless it
 * comes within REFRESH_REUSE_GRACE_MS, which is a client retrying or two calls
 * racing: that one is refused and the connection stays up.
 */
export async function exchangeRefreshToken(db: OAuthDb, input: RefreshExchange, now = Date.now()): Promise<TokenResult> {
  if (typeof input.clientId !== 'string' || !input.clientId) return fail('invalid_request', 'client_id is required');
  if (input.resource !== undefined && typeof input.resource !== 'string') return fail('invalid_target', 'resource is malformed');
  if (!hasSecretShape(input.refreshToken, REFRESH_TOKEN_PREFIX)) return fail('invalid_grant', 'Unknown or expired refresh token');

  const clientId = input.clientId;
  const resource = typeof input.resource === 'string' ? input.resource : '';
  const tokenRef = refs(db).token(input.refreshToken);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(tokenRef);
    const data = snapshot.exists ? snapshot.data() || {} : null;
    if (!data || data.kind !== 'refresh' || typeof data.grantId !== 'string') {
      return fail('invalid_grant', 'Unknown or expired refresh token');
    }
    const grantRef = refs(db).grant(data.grantId);
    const grantSnapshot = await transaction.get(grantRef);
    if (data.clientId !== clientId) return fail('invalid_grant', 'This refresh token was issued to another client');
    if (data.usedAt) {
      const usedAt = toDateMaybe(data.usedAt);
      if (usedAt && now - usedAt.getTime() <= REFRESH_REUSE_GRACE_MS) {
        return fail('invalid_grant', 'This refresh token was just used; use the newest one');
      }
      revokeGrant(db, transaction, data.grantId, 'refresh_token_reuse', now);
      return fail('invalid_grant', 'This refresh token was already used');
    }
    if (data.revokedAt || !grantSnapshot.exists || grantSnapshot.data()?.revokedAt) {
      return fail('invalid_grant', 'This connection was revoked; connect Trace again');
    }
    if (expired(data.expiresAt, now)) return fail('invalid_grant', 'Unknown or expired refresh token');
    if (resource && normalizeResource(resource) !== data.resource) {
      return fail('invalid_target', 'resource does not match this grant');
    }
    if (typeof data.uid !== 'string' || typeof data.resource !== 'string') {
      return fail('invalid_grant', 'Unknown or expired refresh token');
    }

    transaction.set(tokenRef, { usedAt: new Date(now) }, { merge: true });
    return {
      ok: true,
      tokens: mintTokens(db, transaction, {
        grantId: data.grantId,
        uid: data.uid,
        clientId,
        resource: data.resource,
        scope: typeof data.scope === 'string' ? data.scope : '',
      }, now),
    };
  });
}

export function looksLikeAccessToken(token: string): boolean {
  return token.startsWith(ACCESS_TOKEN_PREFIX);
}

/** An access token is good for one audience (the MCP endpoint) until it expires or its grant is revoked. */
export async function verifyAccessToken(
  db: OAuthDb,
  token: string,
  expectedResource: string,
  now = Date.now(),
): Promise<AccessTokenResult> {
  if (!hasSecretShape(token, ACCESS_TOKEN_PREFIX)) return { ok: false, reason: 'malformed' };
  const snapshot = await refs(db).token(token).get();
  const data = snapshot.exists ? snapshot.data() || {} : null;
  if (!data || data.kind !== 'access' || typeof data.uid !== 'string' || typeof data.grantId !== 'string') {
    return { ok: false, reason: 'unknown' };
  }
  if (data.revokedAt) return { ok: false, reason: 'revoked' };
  if (expired(data.expiresAt, now)) return { ok: false, reason: 'expired' };
  if (data.resource !== expectedResource) return { ok: false, reason: 'wrong_audience' };
  const grant = await refs(db).grant(data.grantId).get();
  if (!grant.exists || grant.data()?.revokedAt) return { ok: false, reason: 'revoked' };
  return {
    ok: true,
    uid: data.uid,
    clientId: typeof data.clientId === 'string' ? data.clientId : '',
    grantId: data.grantId,
    scope: typeof data.scope === 'string' ? data.scope : '',
  };
}

/**
 * RFC 7009. Revoking a refresh token ends the whole grant; revoking an access
 * token ends just that token. Unknown tokens, or tokens another client owns,
 * are a silent no-op so the endpoint can't be used to probe tokens.
 */
export async function revokeToken(db: OAuthDb, token: unknown, clientId: unknown, now = Date.now()): Promise<void> {
  const kind = hasSecretShape(token, ACCESS_TOKEN_PREFIX) ? 'access'
    : hasSecretShape(token, REFRESH_TOKEN_PREFIX) ? 'refresh'
      : null;
  if (!kind) return;
  const tokenRef = refs(db).token(token as string);
  const snapshot = await tokenRef.get();
  const data = snapshot.exists ? snapshot.data() || {} : null;
  if (!data || data.kind !== kind) return;
  if (typeof clientId === 'string' && clientId && clientId !== data.clientId) return;
  if (kind === 'refresh' && typeof data.grantId === 'string') {
    await refs(db).grant(data.grantId).set({ revokedAt: new Date(now), revokedReason: 'revoked_by_client' }, { merge: true });
    return;
  }
  await tokenRef.set({ revokedAt: new Date(now) }, { merge: true });
}
