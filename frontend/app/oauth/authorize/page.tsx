import type { Metadata } from 'next';
import { headers } from 'next/headers';
import OAuthConsent, { OAuthProblem } from '@/components/OAuthConsent';
import { AuthProvider } from '@/contexts/AuthContext';
import { adminFirestore } from '@/lib/firebase-admin';
import { validateAuthorizationRequest, type AuthorizeParams } from '@/lib/oauth-authorize';
import { redirectDestination } from '@/lib/oauth-clients';
import { oauthOrigin } from '@/lib/oauth-config';
import { clientIp, rateLimit } from '@/lib/oauth-http';
import type { OAuthDb } from '@/lib/oauth-tokens';

export const metadata: Metadata = {
  title: 'Connect your agent | Trace',
  description: 'Let your AI agent read your Trace brief.',
  robots: { index: false, follow: false },
};

/**
 * OAuth authorization endpoint for the MCP server. The request is checked
 * here before anything renders; Allow and Cancel post back to
 * /api/oauth/consent, which checks it again.
 */
export default async function AuthorizePage({ searchParams }: { searchParams: Promise<AuthorizeParams> }) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const limited = rateLimit(`authorize:${clientIp(requestHeaders)}`, 60);
  if (!limited.ok) return <OAuthProblem message="Too many sign-in attempts from this network. Wait a minute and try again." />;
  if (!adminFirestore) return <OAuthProblem message="Trace sign-in is temporarily unavailable. Try again in a few minutes." />;

  const host = requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') || 'http';
  const issuer = oauthOrigin(host ? `${protocol}://${host}` : null);
  let validation: Awaited<ReturnType<typeof validateAuthorizationRequest>>;
  try {
    validation = await validateAuthorizationRequest(adminFirestore as unknown as OAuthDb, params, issuer);
  } catch (error) {
    console.error('[oauth/authorize] validation failed:', error);
    return <OAuthProblem message="Trace couldn't check this sign-in link just now. Try again in a minute." />;
  }
  // Registration is open, so a redirect URI being registered doesn't make it trustworthy: never
  // bounce a visitor there without a click. The app still gets its error once they press the link.
  if (validation.status === 'redirect') {
    let detail = '';
    try {
      detail = new URL(validation.redirectTo).searchParams.get('error_description') || '';
    } catch {
      /* not parseable: the generic message is enough */
    }
    return (
      <OAuthProblem
        message={`The app's sign-in request was incomplete${detail ? ` (${detail})` : ''}, so Trace stopped here.`}
        returnTo={{ href: validation.redirectTo, destination: redirectDestination(validation.redirectTo) }}
      />
    );
  }
  if (validation.status === 'invalid') return <OAuthProblem message={validation.message} />;

  return (
    <AuthProvider>
      <OAuthConsent request={validation.request} client={validation.display} />
    </AuthProvider>
  );
}
