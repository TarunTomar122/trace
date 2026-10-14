import { mcpResource, normalizeResource, OAUTH_SCOPE } from './oauth-config.ts';
import {
  parseClientIdUrl,
  redirectDestination,
  redirectUriMatches,
  resolveClient,
  type OAuthClient,
} from './oauth-clients.ts';
import { isValidCodeChallenge, type OAuthDb } from './oauth-tokens.ts';
import { emailEnabled, profilePatchFromInput } from './newsletter-prefs.ts';

/**
 * The authorization request behind /oauth/authorize, validated the same way
 * when the page renders and again when the reader clicks Allow.
 *
 * Until client_id and redirect_uri check out, errors are shown on the page:
 * redirecting to an unverified URI would make Trace an open redirect. After
 * that, errors go back to the client as RFC 6749 §4.1.2.1 redirects.
 */

export type AuthorizeParams = Record<string, string | string[] | undefined>;

export type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scope: string;
  resource: string;
};

export type ConsentClient = {
  name: string;
  // Host the client's metadata document was fetched from (verified), if any.
  verifiedHost: string | null;
  destination: string;
};

export type AuthorizeValidation =
  | { status: 'ok'; request: AuthorizationRequest; client: OAuthClient; display: ConsentClient }
  | { status: 'redirect'; redirectTo: string }
  | { status: 'invalid'; message: string };

// RFC 6749 §3.3 scope-token characters, space separated.
const SCOPE_SYNTAX = /^[\x21\x23-\x5B\x5D-\x7E]+(?: [\x21\x23-\x5B\x5D-\x7E]+)*$/;
const MAX_STATE_LENGTH = 2048;
const MAX_SCOPE_LENGTH = 512;
const SINGLE_VALUED = ['client_id', 'redirect_uri', 'response_type', 'code_challenge', 'code_challenge_method', 'state', 'scope'];

/** Append parameters to a redirect URI without re-serialising the URI itself. */
export function appendQuery(uri: string, params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) query.set(key, value);
  }
  return `${uri}${uri.includes('?') ? '&' : '?'}${query.toString()}`;
}

export function authorizationErrorRedirect(
  redirectUri: string,
  issuer: string,
  state: string | null,
  error: string,
  description?: string,
): string {
  return appendQuery(redirectUri, { error, error_description: description, state, iss: issuer });
}

function values(params: AuthorizeParams, name: string): string[] {
  const value = params[name];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' ? [value] : [];
}

export async function validateAuthorizationRequest(
  db: OAuthDb,
  params: AuthorizeParams,
  issuer: string,
  options: { fetchImpl?: typeof fetch; now?: number } = {},
): Promise<AuthorizeValidation> {
  const repeated = SINGLE_VALUED.filter((name) => values(params, name).length > 1);
  if (repeated.includes('client_id') || repeated.includes('redirect_uri')) {
    return { status: 'invalid', message: 'This sign-in link repeats client_id or redirect_uri. Start the connection again from your app.' };
  }
  const clientId = values(params, 'client_id')[0] || '';
  if (!clientId) {
    return { status: 'invalid', message: 'This sign-in link has no client_id. Start the connection again from your app.' };
  }
  const resolved = await resolveClient(db, clientId, options);
  if (!resolved.ok) {
    return { status: 'invalid', message: `Trace couldn't verify the app asking for access (${resolved.reason}).` };
  }
  const client = resolved.client;
  const redirectUri = values(params, 'redirect_uri')[0] || '';
  if (!redirectUri) {
    return { status: 'invalid', message: 'This sign-in link has no redirect_uri. Start the connection again from your app.' };
  }
  if (!client.redirectUris.some((registered) => redirectUriMatches(registered, redirectUri))) {
    return { status: 'invalid', message: "The address this link would send you back to isn't one the app registered, so Trace won't use it." };
  }

  // From here on the redirect URI is trusted: errors go back to the client.
  const rawState = values(params, 'state')[0] ?? null;
  const state = rawState !== null && rawState.length <= MAX_STATE_LENGTH ? rawState : null;
  const fail = (error: string, description: string): AuthorizeValidation => ({
    status: 'redirect',
    redirectTo: authorizationErrorRedirect(redirectUri, issuer, state, error, description),
  });

  if (rawState !== null && rawState.length > MAX_STATE_LENGTH) return fail('invalid_request', 'state is too long');
  if (repeated.length) return fail('invalid_request', `${repeated[0]} must not be repeated`);
  const responseType = values(params, 'response_type')[0] || '';
  if (responseType !== 'code') return fail('unsupported_response_type', 'Only response_type=code is supported');
  const codeChallenge = values(params, 'code_challenge')[0] || '';
  if (!codeChallenge) return fail('invalid_request', 'PKCE is required: send code_challenge with code_challenge_method=S256');
  if (values(params, 'code_challenge_method')[0] !== 'S256') {
    return fail('invalid_request', 'code_challenge_method must be S256');
  }
  if (!isValidCodeChallenge(codeChallenge)) return fail('invalid_request', 'code_challenge is malformed');

  const resource = mcpResource(issuer);
  // RFC 8707 allows several resource parameters; Trace protects exactly one.
  if (values(params, 'resource').some((value) => normalizeResource(value) !== resource)) {
    return fail('invalid_target', `resource must be ${resource}`);
  }
  const scope = values(params, 'scope')[0];
  if (scope !== undefined && scope !== '' && (scope.length > MAX_SCOPE_LENGTH || !SCOPE_SYNTAX.test(scope))) {
    return fail('invalid_scope', 'scope is malformed');
  }

  return {
    status: 'ok',
    // Whatever was asked for, the grant is read-only Trace access.
    request: { clientId, redirectUri, state, codeChallenge, scope: OAUTH_SCOPE, resource },
    client,
    display: {
      name: client.clientName || 'An MCP client',
      verifiedHost: client.kind === 'metadata_document' ? parseClientIdUrl(client.clientId)?.hostname ?? null : null,
      destination: redirectDestination(redirectUri),
    },
  };
}

export type NewsletterState = 'will_subscribe' | 'subscribed' | 'unsubscribed';

/**
 * What Allow does to the daily email, by the sender's own rule
 * (`_email_enabled` in send_audience_newsletter.py): readers who already get
 * it keep it, readers who unsubscribed from an email stay unsubscribed, and
 * everyone else is subscribed with the app's usual opt-in.
 */
export function agentNewsletterState(profile: Record<string, unknown>): NewsletterState {
  if (emailEnabled(profile) && (profile.dailyNewsletterEnabled === true || profile.onboarded === true)) return 'subscribed';
  if (profile.newsletterUnsubscribedAt) return 'unsubscribed';
  return 'will_subscribe';
}

export async function subscribeConnectingReader(
  db: OAuthDb,
  uid: string,
  now = Date.now(),
): Promise<NewsletterState | 'no_profile'> {
  const ref = db.collection('user_profiles').doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) return 'no_profile';
  const state = agentNewsletterState(snapshot.data() || {});
  if (state === 'will_subscribe') {
    const result = profilePatchFromInput({ enabled: true });
    if ('patch' in result) {
      await ref.set({ ...result.patch, newsletterOptInSource: 'agent_connect', updatedAt: new Date(now) }, { merge: true });
    }
  }
  return state;
}
