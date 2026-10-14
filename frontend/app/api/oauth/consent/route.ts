import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import {
  agentNewsletterState,
  appendQuery,
  authorizationErrorRedirect,
  subscribeConnectingReader,
  validateAuthorizationRequest,
  type AuthorizeParams,
} from '@/lib/oauth-authorize';
import { oauthOrigin } from '@/lib/oauth-config';
import { clientIp, rateLimit } from '@/lib/oauth-http';
import { issueAuthorizationCode, type OAuthDb } from '@/lib/oauth-tokens';
import { captureServerEvent } from '@/lib/posthog-server';
import { getSignedInUid } from '@/lib/request-auth';

/**
 * The Allow / Cancel step of /oauth/authorize. Same-origin only (no CORS):
 * only Trace's own page may turn a signed-in reader into an auth code.
 *
 *   GET  → who is signed in and what Allow does to their daily email
 *   POST { decision: 'allow' | 'deny', ...authorization request } → { redirect }
 */

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const REQUEST_FIELDS = ['client_id', 'redirect_uri', 'response_type', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource'];

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return false;
  const site = request.headers.get('sec-fetch-site');
  return !site || site === 'same-origin';
}

export async function GET(request: NextRequest) {
  if (!adminFirestore) return NextResponse.json({ error: 'Server configuration error' }, { status: 503, headers: NO_STORE });
  const uid = await getSignedInUid(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try {
    const snapshot = await adminFirestore.collection('user_profiles').doc(uid).get();
    const profile = snapshot.exists ? (snapshot.data() as Record<string, unknown>) : null;
    return NextResponse.json({
      email: typeof profile?.email === 'string' ? profile.email : null,
      newsletter: profile ? agentNewsletterState(profile) : 'will_subscribe',
      profileReady: Boolean(profile),
    }, { headers: NO_STORE });
  } catch (error) {
    console.error('[api/oauth/consent] GET failed:', error);
    return NextResponse.json({ error: 'Could not load your account' }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  const limited = rateLimit(`consent:${clientIp(request.headers)}`, 30);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many attempts. Wait a minute and try again.' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limited.retryAfterSeconds) } });
  }
  if (!adminFirestore) return NextResponse.json({ error: 'Trace sign-in is temporarily unavailable' }, { status: 503, headers: NO_STORE });
  const db = adminFirestore as unknown as OAuthDb;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  const params: AuthorizeParams = {};
  for (const field of REQUEST_FIELDS) {
    if (typeof body[field] === 'string') params[field] = body[field] as string;
  }

  try {
    const issuer = oauthOrigin(request.nextUrl.origin);
    const validation = await validateAuthorizationRequest(db, params, issuer);
    if (validation.status === 'invalid') return NextResponse.json({ error: validation.message }, { status: 400, headers: NO_STORE });
    if (validation.status === 'redirect') return NextResponse.json({ redirect: validation.redirectTo }, { headers: NO_STORE });
    const { request: authorization, display } = validation;

    if (body.decision === 'deny') {
      return NextResponse.json({
        redirect: authorizationErrorRedirect(authorization.redirectUri, issuer, authorization.state, 'access_denied', 'The reader declined access'),
      }, { headers: NO_STORE });
    }
    if (body.decision !== 'allow') return NextResponse.json({ error: 'Invalid decision' }, { status: 400, headers: NO_STORE });

    const uid = await getSignedInUid(request);
    if (!uid) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401, headers: NO_STORE });

    // The consent page's "also send me the daily brief" box (ticked by default).
    const newsletter = await subscribeConnectingReader(db, uid, body.newsletter !== false);
    if (newsletter === 'no_profile') {
      return NextResponse.json({ error: 'Your Trace account is still being set up. Try Allow again in a moment.' }, { status: 409, headers: NO_STORE });
    }
    const code = await issueAuthorizationCode(db, {
      clientId: authorization.clientId,
      clientName: display.name,
      redirectUri: authorization.redirectUri,
      codeChallenge: authorization.codeChallenge,
      uid,
      resource: authorization.resource,
      scope: authorization.scope,
    });
    await captureServerEvent(uid, 'agent_connected', {
      client_name: display.name,
      client_type: validation.client.kind,
      client_host: display.verifiedHost,
      newsletter,
    });
    return NextResponse.json({
      redirect: appendQuery(authorization.redirectUri, { code, state: authorization.state, iss: issuer }),
      newsletter,
    }, { headers: NO_STORE });
  } catch (error) {
    console.error('[api/oauth/consent] POST failed:', error);
    return NextResponse.json({ error: 'Could not finish connecting. Try again.' }, { status: 500, headers: NO_STORE });
  }
}
