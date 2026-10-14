import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryFirestore } from './test-support/memory-firestore.mjs';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  CODE_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  issueAuthorizationCode,
  pkceChallenge,
  revokeToken,
  verifyAccessToken,
  verifyPkce,
} from './oauth-tokens.ts';
import {
  clearClientMetadataCache,
  clientFromMetadataDocument,
  parseClientIdUrl,
  redirectUriMatches,
  registerClient,
  resolveClient,
  validateRedirectUri,
  validateRegistration,
} from './oauth-clients.ts';
import {
  agentNewsletterState,
  subscribeConnectingReader,
  validateAuthorizationRequest,
} from './oauth-authorize.ts';
import { authorizationServerMetadata, protectedResourceMetadata } from './oauth-config.ts';

const ISSUER = 'https://www.yourtrace.online';
const RESOURCE = `${ISSUER}/api/mcp`;
// RFC 7636 Appendix B.
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const CLAUDE_ID = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const CLAUDE_DOC = {
  client_id: CLAUDE_ID,
  client_name: 'Claude',
  client_uri: 'https://claude.ai',
  redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
  grant_types: ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:jwt-bearer'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
};

function jsonFetch(body, init = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetchImpl, calls };
}

async function codeFor(db, overrides = {}, now = Date.now()) {
  return issueAuthorizationCode(db, {
    clientId: 'trace_client_aaaaaaaaaaaaaaaaaaaaaa',
    clientName: 'Cursor',
    redirectUri: 'cursor://anysphere.cursor-mcp/oauth/callback',
    codeChallenge: CHALLENGE,
    uid: 'reader-1',
    resource: RESOURCE,
    scope: 'trace:read',
    ...overrides,
  }, now);
}

function exchange(db, code, overrides = {}, now) {
  return exchangeAuthorizationCode(db, {
    code,
    clientId: 'trace_client_aaaaaaaaaaaaaaaaaaaaaa',
    redirectUri: 'cursor://anysphere.cursor-mcp/oauth/callback',
    codeVerifier: VERIFIER,
    resource: RESOURCE,
    ...overrides,
  }, now);
}

test('PKCE accepts only the S256 transform of the verifier', () => {
  assert.equal(pkceChallenge(VERIFIER), CHALLENGE);
  assert.equal(verifyPkce(VERIFIER, CHALLENGE), true);
  assert.equal(verifyPkce(`${VERIFIER.slice(0, -1)}A`, CHALLENGE), false);
  // "plain" (challenge = verifier) never passes.
  assert.equal(verifyPkce(VERIFIER, VERIFIER), false);
  assert.equal(verifyPkce('too-short', pkceChallenge('too-short')), false);
  assert.equal(verifyPkce(undefined, CHALLENGE), false);
  assert.equal(verifyPkce(VERIFIER, `${CHALLENGE}=`), false);
});

test('redirect URIs: https, loopback http and private-use schemes only', () => {
  for (const uri of [
    'https://claude.ai/api/mcp/auth_callback',
    'https://chatgpt.com/connector_platform_oauth_redirect',
    'http://127.0.0.1:33418/callback',
    'http://localhost:7777/oauth/callback',
    'http://[::1]:8080/cb',
    'cursor://anysphere.cursor-mcp/oauth/callback',
    'com.example.app:/oauth2redirect',
  ]) {
    assert.equal(validateRedirectUri(uri).ok, true, uri);
  }
  for (const uri of [
    'http://example.com/callback',
    'http://127.0.0.1.evil.com/cb',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,hi',
    'file:///etc/passwd',
    'vbscript:msgbox',
    'https://claude.ai/cb#fragment',
    'https://user:pass@claude.ai/cb',
    'https://claude.ai/a b',
    '/relative/callback',
    '',
    42,
  ]) {
    assert.equal(validateRedirectUri(uri).ok, false, String(uri));
  }
});

test('redirect URIs match exactly, except a loopback port (RFC 8252)', () => {
  assert.equal(redirectUriMatches('https://claude.ai/api/mcp/auth_callback', 'https://claude.ai/api/mcp/auth_callback'), true);
  assert.equal(redirectUriMatches('http://127.0.0.1:3000/callback', 'http://127.0.0.1:51234/callback'), true);
  assert.equal(redirectUriMatches('http://localhost/callback', 'http://localhost:7777/callback'), true);
  assert.equal(redirectUriMatches('http://127.0.0.1:3000/callback', 'http://127.0.0.1:3000/other'), false);
  assert.equal(redirectUriMatches('http://127.0.0.1:3000/callback', 'http://localhost:3000/callback'), false);
  assert.equal(redirectUriMatches('http://127.0.0.1:3000/callback?a=1', 'http://127.0.0.1:3000/callback?a=2'), false);
  assert.equal(redirectUriMatches('https://claude.ai/cb', 'https://claude.ai:8443/cb'), false);
  assert.equal(redirectUriMatches('https://claude.ai/cb', 'https://claude.ai/cb/'), false);
  assert.equal(redirectUriMatches('https://claude.ai/cb', 'https://evil.example/cb'), false);
  assert.equal(redirectUriMatches('cursor://anysphere.cursor-mcp/oauth/callback', 'cursor://anysphere.cursor-mcp/oauth/callback'), true);
});

test('dynamic client registration registers public clients only', async () => {
  assert.equal(validateRegistration({}).ok, false);
  assert.deepEqual(validateRegistration({ redirect_uris: ['javascript:alert(1)'] }).ok, false);
  assert.equal(validateRegistration({ redirect_uris: ['https://x.example/cb'], response_types: ['token'] }).ok, false);
  assert.equal(validateRegistration({ redirect_uris: Array.from({ length: 11 }, (_, i) => `https://x.example/${i}`) }).ok, false);

  const result = validateRegistration({
    client_name: '  Cursor‮  ',
    redirect_uris: ['cursor://anysphere.cursor-mcp/oauth/callback'],
    token_endpoint_auth_method: 'client_secret_basic',
    grant_types: ['authorization_code', 'refresh_token'],
  });
  assert.equal(result.ok, true);
  assert.equal(result.metadata.clientName, 'Cursor');

  const db = new MemoryFirestore();
  const registered = await registerClient(db, result.metadata);
  assert.match(registered.client_id, /^trace_client_[A-Za-z0-9_-]{22}$/);
  assert.equal(registered.token_endpoint_auth_method, 'none');
  assert.equal('client_secret' in registered, false);

  const resolved = await resolveClient(db, registered.client_id);
  assert.equal(resolved.ok, true);
  assert.deepEqual(resolved.client.redirectUris, ['cursor://anysphere.cursor-mcp/oauth/callback']);
  assert.equal((await resolveClient(db, 'trace_client_bbbbbbbbbbbbbbbbbbbbbb')).ok, false);
  assert.equal((await resolveClient(db, 'oauth_codes/../x')).ok, false);
});

test('client ID metadata document URLs must be public, normal https URLs', () => {
  assert.ok(parseClientIdUrl(CLAUDE_ID));
  for (const id of [
    'http://claude.ai/oauth/metadata',
    'https://claude.ai',
    'https://claude.ai/',
    'https://claude.ai/a/../metadata',
    'https://claude.ai/metadata#x',
    'https://user@claude.ai/metadata',
    'https://127.0.0.1/metadata',
    'https://[::1]/metadata',
    'https://localhost/metadata',
    'https://printer.local/metadata',
    'https://intranet/metadata',
    'https://CLAUDE.ai/metadata',
  ]) {
    assert.equal(parseClientIdUrl(id), null, id);
  }
});

test('client ID metadata documents are validated against their URL', () => {
  const ok = clientFromMetadataDocument(CLAUDE_DOC, CLAUDE_ID);
  assert.equal(ok.ok, true);
  assert.equal(ok.client.clientName, 'Claude');
  assert.equal(clientFromMetadataDocument({ ...CLAUDE_DOC, client_id: 'https://evil.example/metadata' }, CLAUDE_ID).ok, false);
  assert.equal(clientFromMetadataDocument({ ...CLAUDE_DOC, client_secret: 'x' }, CLAUDE_ID).ok, false);
  assert.equal(clientFromMetadataDocument({ ...CLAUDE_DOC, token_endpoint_auth_method: 'private_key_jwt' }, CLAUDE_ID).ok, false);
  assert.equal(clientFromMetadataDocument({ ...CLAUDE_DOC, redirect_uris: ['http://evil.example/cb'] }, CLAUDE_ID).ok, false);
  assert.equal(clientFromMetadataDocument([], CLAUDE_ID).ok, false);
});

test('client ID metadata documents are fetched once, without redirects, size-capped', async () => {
  clearClientMetadataCache();
  const db = new MemoryFirestore();
  const { fetchImpl, calls } = jsonFetch(CLAUDE_DOC);
  const first = await resolveClient(db, CLAUDE_ID, { fetchImpl });
  assert.equal(first.ok, true);
  assert.equal(first.client.kind, 'metadata_document');
  assert.equal(calls[0].options.redirect, 'error');
  assert.ok(calls[0].options.signal);
  await resolveClient(db, CLAUDE_ID, { fetchImpl });
  assert.equal(calls.length, 1, 'second lookup is served from the cache');

  clearClientMetadataCache();
  const huge = jsonFetch({ ...CLAUDE_DOC, client_name: 'x'.repeat(20_000) });
  assert.equal((await resolveClient(db, CLAUDE_ID, { fetchImpl: huge.fetchImpl })).ok, false);
  const missing = jsonFetch({ error: 'nope' }, { status: 404 });
  assert.equal((await resolveClient(db, CLAUDE_ID, { fetchImpl: missing.fetchImpl })).ok, false);
  const broken = jsonFetch('not json');
  assert.equal((await resolveClient(db, CLAUDE_ID, { fetchImpl: broken.fetchImpl })).ok, false);
  const failing = async () => { throw new TypeError('redirect mode is set to error'); };
  assert.equal((await resolveClient(db, CLAUDE_ID, { fetchImpl: failing })).ok, false);
  clearClientMetadataCache();
});

test('authorization requests: bad client or redirect URI never redirects', async () => {
  clearClientMetadataCache();
  const db = new MemoryFirestore();
  const { fetchImpl } = jsonFetch(CLAUDE_DOC);
  const base = {
    client_id: CLAUDE_ID,
    redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    response_type: 'code',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    state: 'xyz',
    resource: RESOURCE,
  };

  assert.equal((await validateAuthorizationRequest(db, { ...base, client_id: undefined }, ISSUER, { fetchImpl })).status, 'invalid');
  assert.equal((await validateAuthorizationRequest(db, { ...base, client_id: 'trace_client_unknownunknownunknow' }, ISSUER, { fetchImpl })).status, 'invalid');
  assert.equal((await validateAuthorizationRequest(db, { ...base, redirect_uri: 'https://evil.example/cb' }, ISSUER, { fetchImpl })).status, 'invalid');
  assert.equal((await validateAuthorizationRequest(db, { ...base, redirect_uri: [base.redirect_uri, 'https://evil.example/cb'] }, ISSUER, { fetchImpl })).status, 'invalid');

  const errorFor = async (params) => {
    const result = await validateAuthorizationRequest(db, { ...base, ...params }, ISSUER, { fetchImpl });
    assert.equal(result.status, 'redirect');
    const url = new URL(result.redirectTo);
    assert.equal(url.origin + url.pathname, 'https://claude.ai/api/mcp/auth_callback');
    assert.equal(url.searchParams.get('iss'), ISSUER);
    return url.searchParams;
  };
  let error = await errorFor({ code_challenge: undefined });
  assert.equal(error.get('error'), 'invalid_request');
  assert.equal(error.get('state'), 'xyz');
  assert.equal((await errorFor({ code_challenge_method: 'plain' })).get('error'), 'invalid_request');
  assert.equal((await errorFor({ code_challenge_method: undefined })).get('error'), 'invalid_request');
  assert.equal((await errorFor({ code_challenge: 'short' })).get('error'), 'invalid_request');
  assert.equal((await errorFor({ response_type: 'token' })).get('error'), 'unsupported_response_type');
  assert.equal((await errorFor({ resource: 'https://evil.example/api/mcp' })).get('error'), 'invalid_target');
  assert.equal((await errorFor({ scope: 'bad"scope' })).get('error'), 'invalid_scope');
  error = await errorFor({ state: ['a', 'b'] });
  assert.equal(error.get('error'), 'invalid_request');

  const ok = await validateAuthorizationRequest(db, { ...base, scope: 'openid offline_access', resource: `${RESOURCE}/` }, ISSUER, { fetchImpl });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.request.scope, 'trace:read');
  assert.equal(ok.request.resource, RESOURCE);
  assert.equal(ok.display.name, 'Claude');
  assert.equal(ok.display.verifiedHost, 'claude.ai');
  assert.equal(ok.display.destination, 'claude.ai');
  // No resource parameter at all is fine: the grant is still bound to /api/mcp.
  const noResource = await validateAuthorizationRequest(db, { ...base, resource: undefined }, ISSUER, { fetchImpl });
  assert.equal(noResource.status, 'ok');
  assert.equal(noResource.request.resource, RESOURCE);
  clearClientMetadataCache();
});

test('an authorization code is exchanged once for audience-bound tokens', async () => {
  const db = new MemoryFirestore();
  const now = Date.parse('2026-10-14T12:00:00Z');
  const code = await codeFor(db, {}, now);
  const result = await exchange(db, code, {}, now + 1000);
  assert.equal(result.ok, true);
  assert.equal(result.tokens.token_type, 'Bearer');
  assert.equal(result.tokens.expires_in, ACCESS_TOKEN_TTL_SECONDS);
  assert.equal(result.tokens.scope, 'trace:read');
  assert.match(result.tokens.access_token, /^trace_at_/);
  assert.match(result.tokens.refresh_token, /^trace_rt_/);

  // Only hashes are stored.
  const stored = JSON.stringify([...db.docs]);
  for (const secret of [code, result.tokens.access_token, result.tokens.refresh_token]) {
    assert.equal(stored.includes(secret), false);
  }

  const access = await verifyAccessToken(db, result.tokens.access_token, RESOURCE, now + 2000);
  assert.equal(access.ok, true);
  assert.equal(access.uid, 'reader-1');
});

test('a replayed code fails and revokes the tokens it already issued', async () => {
  const db = new MemoryFirestore();
  const code = await codeFor(db);
  const first = await exchange(db, code);
  assert.equal(first.ok, true);
  const replay = await exchange(db, code);
  assert.deepEqual({ ok: replay.ok, error: replay.error }, { ok: false, error: 'invalid_grant' });
  assert.deepEqual(await verifyAccessToken(db, first.tokens.access_token, RESOURCE), { ok: false, reason: 'revoked' });
  const refreshed = await exchangeRefreshToken(db, { refreshToken: first.tokens.refresh_token, clientId: 'trace_client_aaaaaaaaaaaaaaaaaaaaaa' });
  assert.equal(refreshed.ok, false);
});

test('two simultaneous exchanges of one code: one wins, then both lose', async () => {
  const db = new MemoryFirestore();
  const code = await codeFor(db);
  const results = await Promise.all([exchange(db, code), exchange(db, code)]);
  const winners = results.filter((result) => result.ok);
  assert.equal(winners.length, 1);
  assert.equal((await verifyAccessToken(db, winners[0].tokens.access_token, RESOURCE)).ok, false);
});

test('a code is bound to its client, redirect URI, PKCE verifier, resource and lifetime', async () => {
  const db = new MemoryFirestore();
  const now = Date.now();
  const code = await codeFor(db, {}, now);
  assert.equal((await exchange(db, code, { clientId: 'trace_client_bbbbbbbbbbbbbbbbbbbbbb' })).error, 'invalid_grant');
  assert.equal((await exchange(db, code, { redirectUri: 'cursor://anysphere.cursor-mcp/other' })).error, 'invalid_grant');
  assert.equal((await exchange(db, code, { codeVerifier: 'x'.repeat(43) })).error, 'invalid_grant');
  assert.equal((await exchange(db, code, { codeVerifier: undefined })).error, 'invalid_request');
  assert.equal((await exchange(db, code, { resource: 'https://evil.example/api/mcp' })).error, 'invalid_target');
  // Failed attempts don't burn the code: the real client still gets tokens.
  assert.equal((await exchange(db, code)).ok, true);

  const late = await codeFor(db, {}, now);
  assert.equal((await exchange(db, late, {}, now + CODE_TTL_MS + 1)).error, 'invalid_grant');
  assert.equal((await exchange(db, 'trace_code_forged')).error, 'invalid_grant');
});

test('refresh tokens rotate, and reusing an old one revokes the family', async () => {
  const db = new MemoryFirestore();
  const clientId = 'trace_client_aaaaaaaaaaaaaaaaaaaaaa';
  const first = await exchange(db, await codeFor(db));
  const second = await exchangeRefreshToken(db, { refreshToken: first.tokens.refresh_token, clientId, resource: RESOURCE });
  assert.equal(second.ok, true);
  assert.notEqual(second.tokens.refresh_token, first.tokens.refresh_token);
  assert.equal((await verifyAccessToken(db, second.tokens.access_token, RESOURCE)).ok, true);

  assert.equal((await exchangeRefreshToken(db, { refreshToken: second.tokens.refresh_token, clientId: 'trace_client_bbbbbbbbbbbbbbbbbbbbbb' })).error, 'invalid_grant');
  assert.equal((await exchangeRefreshToken(db, { refreshToken: second.tokens.refresh_token, clientId, resource: 'https://evil.example/api/mcp' })).error, 'invalid_target');

  const reuse = await exchangeRefreshToken(db, { refreshToken: first.tokens.refresh_token, clientId });
  assert.equal(reuse.error, 'invalid_grant');
  assert.deepEqual(await verifyAccessToken(db, second.tokens.access_token, RESOURCE), { ok: false, reason: 'revoked' });
  assert.equal((await exchangeRefreshToken(db, { refreshToken: second.tokens.refresh_token, clientId })).ok, false);
});

test('refresh tokens expire', async () => {
  const db = new MemoryFirestore();
  const now = Date.now();
  const first = await exchange(db, await codeFor(db, {}, now), {}, now);
  const late = await exchangeRefreshToken(db, { refreshToken: first.tokens.refresh_token, clientId: 'trace_client_aaaaaaaaaaaaaaaaaaaaaa' }, now + REFRESH_TOKEN_TTL_MS + 1);
  assert.equal(late.error, 'invalid_grant');
});

test('access tokens check audience, expiry and revocation', async () => {
  const db = new MemoryFirestore();
  const now = Date.now();
  const tokens = (await exchange(db, await codeFor(db, {}, now), {}, now)).tokens;
  assert.deepEqual(await verifyAccessToken(db, tokens.access_token, 'https://other.example/api/mcp', now), { ok: false, reason: 'wrong_audience' });
  assert.deepEqual(await verifyAccessToken(db, tokens.access_token, RESOURCE, now + ACCESS_TOKEN_TTL_SECONDS * 1000 + 1), { ok: false, reason: 'expired' });
  assert.deepEqual(await verifyAccessToken(db, 'trace_at_short', RESOURCE, now), { ok: false, reason: 'malformed' });
  assert.deepEqual(await verifyAccessToken(db, tokens.refresh_token, RESOURCE, now), { ok: false, reason: 'malformed' });
  assert.deepEqual(await verifyAccessToken(db, `trace_at_${'A'.repeat(43)}`, RESOURCE, now), { ok: false, reason: 'unknown' });

  // Another client can't revoke it; the owner can.
  await revokeToken(db, tokens.access_token, 'trace_client_bbbbbbbbbbbbbbbbbbbbbb');
  assert.equal((await verifyAccessToken(db, tokens.access_token, RESOURCE)).ok, true);
  await revokeToken(db, tokens.access_token, 'trace_client_aaaaaaaaaaaaaaaaaaaaaa');
  assert.deepEqual(await verifyAccessToken(db, tokens.access_token, RESOURCE), { ok: false, reason: 'revoked' });
});

test('revoking a refresh token ends the whole grant', async () => {
  const db = new MemoryFirestore();
  const tokens = (await exchange(db, await codeFor(db))).tokens;
  await revokeToken(db, tokens.refresh_token, undefined);
  assert.equal((await verifyAccessToken(db, tokens.access_token, RESOURCE)).ok, false);
  assert.equal((await exchangeRefreshToken(db, { refreshToken: tokens.refresh_token, clientId: 'trace_client_aaaaaaaaaaaaaaaaaaaaaa' })).ok, false);
  await revokeToken(db, 'not-a-token', undefined); // silent no-op
});

test('connecting subscribes to the daily brief unless the reader unsubscribed', async () => {
  assert.equal(agentNewsletterState({}), 'will_subscribe');
  assert.equal(agentNewsletterState({ dailyNewsletterEnabled: false, newsletterOptIn: false }), 'will_subscribe');
  assert.equal(agentNewsletterState({ dailyNewsletterEnabled: true }), 'subscribed');
  assert.equal(agentNewsletterState({ onboarded: true }), 'subscribed');
  assert.equal(agentNewsletterState({ onboarded: true, dailyNewsletterEnabled: false }), 'will_subscribe');
  assert.equal(agentNewsletterState({ dailyNewsletterEnabled: false, newsletterOptIn: false, newsletterUnsubscribedAt: '2026-10-01T00:00:00Z' }), 'unsubscribed');
  // Turned back on after an unsubscribe: they get it again.
  assert.equal(agentNewsletterState({ dailyNewsletterEnabled: true, newsletterUnsubscribedAt: '2026-10-01T00:00:00Z' }), 'subscribed');

  const db = new MemoryFirestore();
  assert.equal(await subscribeConnectingReader(db, 'nobody'), 'no_profile');

  await db.collection('user_profiles').doc('fresh').set({ uid: 'fresh', email: 'fresh@example.com', onboarded: false });
  assert.equal(await subscribeConnectingReader(db, 'fresh'), 'will_subscribe');
  const fresh = (await db.collection('user_profiles').doc('fresh').get()).data();
  assert.equal(fresh.dailyNewsletterEnabled, true);
  assert.equal(fresh.newsletterOptIn, true);
  assert.equal(fresh.email, 'fresh@example.com');

  const unsubscribed = { uid: 'gone', email: 'gone@example.com', dailyNewsletterEnabled: false, newsletterOptIn: false, newsletterUnsubscribedAt: '2026-10-01T00:00:00Z' };
  await db.collection('user_profiles').doc('gone').set(unsubscribed);
  assert.equal(await subscribeConnectingReader(db, 'gone'), 'unsubscribed');
  assert.deepEqual((await db.collection('user_profiles').doc('gone').get()).data(), unsubscribed);
});

test('metadata advertises S256-only PKCE, public clients and the MCP resource', () => {
  const resource = protectedResourceMetadata(ISSUER);
  assert.equal(resource.resource, RESOURCE);
  assert.deepEqual(resource.authorization_servers, [ISSUER]);
  const server = authorizationServerMetadata(ISSUER);
  assert.equal(server.issuer, ISSUER);
  assert.deepEqual(server.code_challenge_methods_supported, ['S256']);
  assert.deepEqual(server.token_endpoint_auth_methods_supported, ['none']);
  assert.equal(server.client_id_metadata_document_supported, true);
  assert.equal(server.authorization_endpoint, `${ISSUER}/oauth/authorize`);
});
