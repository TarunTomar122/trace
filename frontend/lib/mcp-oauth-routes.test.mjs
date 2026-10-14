// End-to-end through the real route handlers, against the in-memory store
// that next-route-hooks.mjs swaps in for lib/firebase-admin.ts.
import './test-support/next-route-hooks.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test, { beforeEach } from 'node:test';

delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

const { NextRequest } = await import('next/server');
const { adminFirestore: db, TEST_ID_TOKEN_PREFIX } = await import('./test-support/firebase-admin-stub.mjs');
const { createTraceSession, TRACE_SESSION_COOKIE_NAME } = await import('./server-session.ts');
const { resetRateLimits } = await import('./oauth-http.ts');
const { issueAuthorizationCode, exchangeAuthorizationCode } = await import('./oauth-tokens.ts');
const mcp = await import('../app/api/mcp/route.ts');
const register = await import('../app/api/oauth/register/route.ts');
const token = await import('../app/api/oauth/token/route.ts');
const revoke = await import('../app/api/oauth/revoke/route.ts');
const consent = await import('../app/api/oauth/consent/route.ts');
const protectedResource = await import('../app/.well-known/oauth-protected-resource/api/mcp/route.ts');
const protectedResourceRoot = await import('../app/.well-known/oauth-protected-resource/route.ts');
const authorizationServer = await import('../app/.well-known/oauth-authorization-server/route.ts');

const ORIGIN = 'https://www.yourtrace.online';
const RESOURCE = `${ORIGIN}/api/mcp`;
const METADATA_URL = `${ORIGIN}/.well-known/oauth-protected-resource/api/mcp`;
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const REDIRECT = 'http://127.0.0.1:33418/callback';

beforeEach(() => {
  db.reset();
  resetRateLimits();
});

function mcpCall(authorization, method = 'initialize') {
  return mcp.POST(new NextRequest(`${ORIGIN}/api/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} }),
  }));
}

function formPost(handler, path, fields, headers = {}) {
  return handler.POST(new NextRequest(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(fields).toString(),
  }));
}

function consentPost(body, { uid, origin = ORIGIN } = {}) {
  const headers = { 'content-type': 'application/json', origin };
  if (uid) headers.cookie = `${TRACE_SESSION_COOKIE_NAME}=${createTraceSession(uid)}`;
  return consent.POST(new NextRequest(`${ORIGIN}/api/oauth/consent`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }));
}

async function registerCursorLikeClient() {
  const response = await register.POST(new NextRequest(`${ORIGIN}/api/oauth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Claude Code',
      redirect_uris: ['http://127.0.0.1/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  return response.json();
}

async function seedProfile(uid, fields = {}) {
  await db.collection('user_profiles').doc(uid).set({ uid, email: `${uid}@example.com`, onboarded: false, ...fields });
}

function authorizeBody(clientId, overrides = {}) {
  return {
    decision: 'allow',
    client_id: clientId,
    redirect_uri: REDIRECT.replace('127.0.0.1:33418', '127.0.0.1:41234'),
    response_type: 'code',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    state: 'state-123',
    resource: RESOURCE,
    newsletter: true, // the consent page always sends the box's value
    ...overrides,
  };
}

test('unauthenticated MCP requests get a 401 that points at the OAuth metadata', async () => {
  const response = await mcpCall(null);
  assert.equal(response.status, 401);
  const challenge = response.headers.get('www-authenticate');
  assert.match(challenge, /^Bearer /);
  assert.ok(challenge.includes(`resource_metadata="${METADATA_URL}"`));
  assert.ok(!challenge.includes('error='), 'no error code when no token was sent');
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.ok(response.headers.get('access-control-expose-headers').includes('WWW-Authenticate'));

  const bad = await mcpCall(`Bearer trace_at_${'A'.repeat(43)}`);
  assert.equal(bad.status, 401);
  assert.ok(bad.headers.get('www-authenticate').includes('error="invalid_token"'));
});

test('Trace Agent Keys keep working unchanged', async () => {
  const key = `trace_agent_${'k'.repeat(43)}`;
  await db.collection('agent_access_keys').doc('reader-key').set({
    uid: 'reader-key',
    tokenHash: createHash('sha256').update(key).digest('hex'),
    tokenPrefix: key.slice(0, 18),
    scope: 'trace:read',
    revokedAt: null,
  });
  const response = await mcpCall(`Bearer ${key}`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.serverInfo.name, 'Trace');
  const tools = await (await mcpCall(`Bearer ${key}`, 'tools/list')).json();
  assert.equal(tools.result.tools.length, 4);

  const wrong = await mcpCall(`Bearer trace_agent_${'x'.repeat(43)}`);
  assert.equal(wrong.status, 401);
  assert.deepEqual(await wrong.json(), { error: 'Invalid or rotated Trace Agent Key' });

  await db.collection('agent_access_keys').doc('reader-key').set({ revokedAt: new Date() }, { merge: true });
  assert.equal((await mcpCall(`Bearer ${key}`)).status, 401);
});

test('full OAuth flow: register, Allow, code, tokens, MCP, refresh, reuse', async () => {
  const client = await registerCursorLikeClient();
  await seedProfile('reader-1');

  const allow = await consentPost(authorizeBody(client.client_id), { uid: 'reader-1' });
  assert.equal(allow.status, 200);
  const allowed = await allow.json();
  assert.equal(allowed.newsletter, 'will_subscribe');
  const callback = new URL(allowed.redirect);
  assert.equal(callback.origin + callback.pathname, 'http://127.0.0.1:41234/callback');
  assert.equal(callback.searchParams.get('state'), 'state-123');
  assert.equal(callback.searchParams.get('iss'), ORIGIN);
  const code = callback.searchParams.get('code');
  assert.match(code, /^trace_code_/);

  const profile = (await db.collection('user_profiles').doc('reader-1').get()).data();
  assert.equal(profile.dailyNewsletterEnabled, true);
  assert.equal(profile.newsletterOptIn, true);

  const tokenResponse = await formPost(token, '/api/oauth/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: 'http://127.0.0.1:41234/callback',
    client_id: client.client_id,
    code_verifier: VERIFIER,
    resource: RESOURCE,
  });
  assert.equal(tokenResponse.status, 200);
  assert.equal(tokenResponse.headers.get('cache-control'), 'no-store');
  const tokens = await tokenResponse.json();
  assert.equal(tokens.token_type, 'Bearer');
  assert.equal(tokens.expires_in, 3600);

  const initialized = await mcpCall(`Bearer ${tokens.access_token}`);
  assert.equal(initialized.status, 200);

  const replay = await formPost(token, '/api/oauth/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: 'http://127.0.0.1:41234/callback',
    client_id: client.client_id,
    code_verifier: VERIFIER,
  });
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).error, 'invalid_grant');
  assert.equal((await mcpCall(`Bearer ${tokens.access_token}`)).status, 401, 'replay revoked the first tokens');
});

test('refresh rotation and reuse detection through the token endpoint', async () => {
  const client = await registerCursorLikeClient();
  await seedProfile('reader-2');
  const allowed = await (await consentPost(authorizeBody(client.client_id), { uid: 'reader-2' })).json();
  const code = new URL(allowed.redirect).searchParams.get('code');
  const first = await (await formPost(token, '/api/oauth/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: 'http://127.0.0.1:41234/callback',
    client_id: client.client_id,
    code_verifier: VERIFIER,
  })).json();

  const refreshed = await formPost(token, '/api/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: first.refresh_token,
    client_id: client.client_id,
  });
  assert.equal(refreshed.status, 200);
  const second = await refreshed.json();
  assert.equal((await mcpCall(`Bearer ${second.access_token}`)).status, 200);

  const reused = await formPost(token, '/api/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: first.refresh_token,
    client_id: client.client_id,
  });
  assert.equal(reused.status, 400);
  // Straight away this is a retry, not a leak: refused, but the connection stays up.
  // (Reuse after the grace window revoking the grant is covered in oauth.test.mjs.)
  assert.equal((await mcpCall(`Bearer ${second.access_token}`)).status, 200, 'a quick retry keeps the connection');

  // JSON bodies and HTTP Basic client ids are accepted; disagreeing ids are not.
  const mismatch = await formPost(token, '/api/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: second.refresh_token,
    client_id: client.client_id,
  }, { authorization: `Basic ${Buffer.from('someone-else:').toString('base64')}` });
  assert.equal(mismatch.status, 401);
  assert.equal((await formPost(token, '/api/oauth/token', { grant_type: 'password' })).status, 400);
  const repeated = await token.POST(new NextRequest(`${ORIGIN}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=refresh_token&grant_type=authorization_code',
  }));
  assert.equal((await repeated.json()).error, 'invalid_request');
});

test('tokens for another audience are refused by the MCP endpoint', async () => {
  const code = await issueAuthorizationCode(db, {
    clientId: 'trace_client_aaaaaaaaaaaaaaaaaaaaaa',
    clientName: 'Elsewhere',
    redirectUri: REDIRECT,
    codeChallenge: CHALLENGE,
    uid: 'reader-3',
    resource: 'https://other.example/api/mcp',
    scope: 'trace:read',
  });
  const result = await exchangeAuthorizationCode(db, {
    code,
    clientId: 'trace_client_aaaaaaaaaaaaaaaaaaaaaa',
    redirectUri: REDIRECT,
    codeVerifier: VERIFIER,
  });
  assert.equal(result.ok, true);
  assert.equal((await mcpCall(`Bearer ${result.tokens.access_token}`)).status, 401);
});

test('revocation endpoint ends a grant and answers 200 either way', async () => {
  const client = await registerCursorLikeClient();
  await seedProfile('reader-4');
  const allowed = await (await consentPost(authorizeBody(client.client_id), { uid: 'reader-4' })).json();
  const tokens = await (await formPost(token, '/api/oauth/token', {
    grant_type: 'authorization_code',
    code: new URL(allowed.redirect).searchParams.get('code'),
    redirect_uri: 'http://127.0.0.1:41234/callback',
    client_id: client.client_id,
    code_verifier: VERIFIER,
  })).json();
  const response = await formPost(revoke, '/api/oauth/revoke', { token: tokens.refresh_token, client_id: client.client_id });
  assert.equal(response.status, 200);
  assert.equal((await mcpCall(`Bearer ${tokens.access_token}`)).status, 401);
  assert.equal((await formPost(revoke, '/api/oauth/revoke', { token: 'whatever' })).status, 200);
  assert.equal((await formPost(revoke, '/api/oauth/revoke', {})).status, 400);
});

test('consent: Cancel, cross-site posts, sign-in, unsubscribes and new accounts', async () => {
  const client = await registerCursorLikeClient();

  const denied = await (await consentPost({ ...authorizeBody(client.client_id), decision: 'deny' })).json();
  const deniedUrl = new URL(denied.redirect);
  assert.equal(deniedUrl.searchParams.get('error'), 'access_denied');
  assert.equal(deniedUrl.searchParams.get('state'), 'state-123');
  assert.equal(deniedUrl.searchParams.get('code'), null);

  assert.equal((await consentPost(authorizeBody(client.client_id), { uid: 'reader-5', origin: 'https://evil.example' })).status, 403);
  assert.equal((await consentPost(authorizeBody(client.client_id))).status, 401, 'Allow needs a signed-in reader');
  assert.equal((await consentPost(authorizeBody(client.client_id), { uid: 'reader-5' })).status, 409, 'profile not created yet');

  const unsubscribed = { dailyNewsletterEnabled: false, newsletterOptIn: false, newsletterUnsubscribedAt: '2026-10-01T00:00:00.000Z' };
  await seedProfile('reader-5', unsubscribed);
  const allowed = await (await consentPost(authorizeBody(client.client_id), { uid: 'reader-5' })).json();
  assert.equal(allowed.newsletter, 'unsubscribed');
  assert.ok(new URL(allowed.redirect).searchParams.get('code'));
  const profile = (await db.collection('user_profiles').doc('reader-5').get()).data();
  assert.equal(profile.dailyNewsletterEnabled, false);
  assert.equal(profile.newsletterOptIn, false);

  // Errors after the redirect URI is verified go back to the client...
  const pkceless = await (await consentPost(authorizeBody(client.client_id, { code_challenge: undefined }), { uid: 'reader-5' })).json();
  assert.equal(new URL(pkceless.redirect).searchParams.get('error'), 'invalid_request');
  // ...but an unregistered redirect URI is never used.
  const foreign = await consentPost(authorizeBody(client.client_id, { redirect_uri: 'https://evil.example/cb' }), { uid: 'reader-5' });
  assert.equal(foreign.status, 400);
  assert.equal((await foreign.json()).redirect, undefined);

  const info = await consent.GET(new NextRequest(`${ORIGIN}/api/oauth/consent`, {
    headers: { authorization: `Bearer ${TEST_ID_TOKEN_PREFIX}reader-5` },
  }));
  assert.deepEqual(await info.json(), { email: 'reader-5@example.com', newsletter: 'unsubscribed', profileReady: true });
});

test('metadata, CORS preflight and the SSE probe', async () => {
  const resource = await (await protectedResource.GET(new NextRequest(METADATA_URL))).json();
  assert.equal(resource.resource, RESOURCE);
  assert.deepEqual(resource.authorization_servers, [ORIGIN]);
  const root = await (await protectedResourceRoot.GET(new NextRequest(`${ORIGIN}/.well-known/oauth-protected-resource`))).json();
  assert.equal(root.resource, RESOURCE);
  const serverResponse = await authorizationServer.GET(new NextRequest(`${ORIGIN}/.well-known/oauth-authorization-server`));
  assert.equal(serverResponse.headers.get('access-control-allow-origin'), '*');
  const server = await serverResponse.json();
  assert.equal(server.token_endpoint, `${ORIGIN}/api/oauth/token`);
  assert.equal(server.registration_endpoint, `${ORIGIN}/api/oauth/register`);

  const preflight = token.OPTIONS();
  assert.equal(preflight.status, 204);
  assert.ok(preflight.headers.get('access-control-allow-headers').includes('Authorization'));
  assert.equal(mcp.OPTIONS().status, 204);

  const sse = await mcp.GET(new NextRequest(`${ORIGIN}/api/mcp`, { headers: { accept: 'text/event-stream' } }));
  assert.equal(sse.status, 405);
  const info = await (await mcp.GET(new NextRequest(`${ORIGIN}/api/mcp`))).json();
  assert.equal(info.resource_metadata, METADATA_URL);
});

test('registration is rate limited per address', async () => {
  let last;
  for (let i = 0; i < 21; i += 1) {
    last = await register.POST(new NextRequest(`${ORIGIN}/api/oauth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
      body: JSON.stringify({ redirect_uris: ['http://127.0.0.1/callback'] }),
    }));
  }
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get('retry-after')) > 0);
});

test('unticking the email box on the consent page connects without subscribing', async () => {
  const client = await registerCursorLikeClient();
  await seedProfile('reader-quiet');
  const before = (await db.collection('user_profiles').doc('reader-quiet').get()).data();

  const allow = await consentPost(authorizeBody(client.client_id, { newsletter: false }), { uid: 'reader-quiet' });
  assert.equal(allow.status, 200);
  const allowed = await allow.json();
  assert.equal(allowed.newsletter, 'declined');
  assert.match(new URL(allowed.redirect).searchParams.get('code'), /^trace_code_/);
  assert.deepEqual((await db.collection('user_profiles').doc('reader-quiet').get()).data(), before);
});
