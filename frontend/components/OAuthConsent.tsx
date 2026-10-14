"use client";

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthorizationRequest, ConsentClient, NewsletterState } from '@/lib/oauth-authorize';

type ConsentInfo = { email: string | null; newsletter: NewsletterState; profileReady: boolean };

const NEWSLETTER_COPY: Record<NewsletterState, string> = {
  will_subscribe: "Connecting also sends you Trace's daily brief by email. Unsubscribe any time; your agent keeps access.",
  subscribed: "You already get Trace's daily brief by email. Unsubscribe any time; your agent keeps access.",
  unsubscribed: "You unsubscribed from Trace's daily email, so connecting won't sign you up again. Your agent gets access either way.",
};

function requestBody(request: AuthorizationRequest, decision: 'allow' | 'deny') {
  return JSON.stringify({
    decision,
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    response_type: 'code',
    code_challenge: request.codeChallenge,
    code_challenge_method: 'S256',
    state: request.state ?? undefined,
    scope: request.scope,
    resource: request.resource,
  });
}

export function OAuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="oa">
      <style>{css}</style>
      <div className="oa-card">
        <Link href="/" aria-label="Trace home" className="oa-logo">
          <Image src="/trace.webp" width={32} height={32} alt="" priority />
          <span>Trace</span>
        </Link>
        {children}
      </div>
    </main>
  );
}

export function OAuthProblem({ message }: { message: string }) {
  return (
    <OAuthShell>
      <p className="oa-kicker">Connect an agent</p>
      <h1 className="oa-title">This sign-in link doesn&apos;t work.</h1>
      <p className="oa-sub" role="alert">{message}</p>
      <p className="oa-fine">Remove Trace from your app and add <code>https://www.yourtrace.online/api/mcp</code> again. Setup steps for each app are on <Link href="/agents">yourtrace.online/agents</Link>.</p>
    </OAuthShell>
  );
}

export default function OAuthConsent({ request, client }: { request: AuthorizationRequest; client: ConsentClient }) {
  const { user, loading, profileResolved, profileRefreshFailed, signInWithGoogle, signOut } = useAuth();
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [busy, setBusy] = useState<'allow' | 'deny' | 'signin' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'allowed' | 'denied' | null>(null);

  useEffect(() => {
    if (!user) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    void user.getIdToken()
      .then((idToken) => fetch('/api/oauth/consent', {
        headers: { Authorization: `Bearer ${idToken}` },
        credentials: 'same-origin',
        cache: 'no-store',
      }))
      .then(async (response) => {
        if (!response.ok) throw new Error(`consent info ${response.status}`);
        const next = await response.json() as ConsentInfo;
        if (!cancelled) setInfo(next);
      })
      .catch(() => {
        // The default copy is still right; Allow re-checks on the server.
        if (!cancelled) setInfo({ email: user.email, newsletter: 'will_subscribe', profileReady: true });
      });
    return () => { cancelled = true; };
  }, [user, profileResolved]);

  const signIn = async () => {
    setBusy('signin');
    setError('');
    const result = await signInWithGoogle('read', { rememberIntent: false });
    if (result.status === 'error') setError("Google sign-in didn't finish. Try again.");
    setBusy(null);
  };

  const switchAccount = async () => {
    setError('');
    await signOut().catch(() => undefined);
    await signIn();
  };

  const decide = async (decision: 'allow' | 'deny') => {
    setBusy(decision);
    setError('');
    try {
      const idToken = user ? await user.getIdToken() : null;
      const response = await fetch('/api/oauth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        credentials: 'same-origin',
        body: requestBody(request, decision),
      });
      const body = await response.json().catch(() => ({})) as { redirect?: string; error?: string };
      if (!response.ok || !body.redirect) throw new Error(body.error || 'Could not finish connecting. Try again.');
      setDone(decision === 'allow' ? 'allowed' : 'denied');
      window.location.assign(body.redirect);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not finish connecting. Try again.');
      setBusy(null);
    }
  };

  if (done) {
    return (
      <OAuthShell>
        <p className="oa-kicker">{done === 'allowed' ? 'Connected' : 'Cancelled'}</p>
        <h1 className="oa-title">{done === 'allowed' ? `Sending you back to ${client.destination}…` : 'Nothing was shared.'}</h1>
        <p className="oa-sub">
          {done === 'allowed'
            ? `${client.name} can now read your Trace brief. Close this tab once your app says it's connected.`
            : `You told ${client.name} no. You can close this tab.`}
        </p>
      </OAuthShell>
    );
  }

  const ready = Boolean(user) && !loading && (profileResolved || profileRefreshFailed) && info !== null;
  const newsletter = info?.newsletter ?? 'will_subscribe';

  return (
    <OAuthShell>
      <p className="oa-kicker">Connect an agent</p>
      <h1 className="oa-title">{client.name} wants to read your Trace brief.</h1>
      <p className="oa-sub">
        {client.verifiedHost ? <>Verified app from <strong>{client.verifiedHost}</strong>. </> : null}
        After you choose, you go back to {client.destination}.
      </p>
      {client.local ? (
        <p className="oa-warn">Only allow this if you just asked an app on this computer to connect to Trace. Any program running here could open this page.</p>
      ) : null}

      <ul className="oa-perms">
        <li><span className="oa-yes" aria-hidden="true">✓</span>Read today&apos;s top tech stories, builds and conversations, with sources</li>
        <li><span className="oa-no" aria-hidden="true">✕</span>Change your account, post, or buy anything</li>
      </ul>

      <p className={`oa-email${newsletter === 'unsubscribed' ? ' muted' : ''}`}>{NEWSLETTER_COPY[newsletter]}</p>

      {error ? <p className="oa-error" role="alert">{error}</p> : null}

      {loading ? (
        <p className="oa-fine">Checking your sign-in…</p>
      ) : !user ? (
        <>
          <button type="button" className="oa-primary" onClick={() => void signIn()} disabled={busy !== null}>
            {busy === 'signin' ? 'Opening Google…' : 'Sign in with Google to continue'}
          </button>
          <button type="button" className="oa-secondary" onClick={() => void decide('deny')} disabled={busy !== null}>Cancel</button>
          <p className="oa-fine">New to Trace? Signing in creates your free account.</p>
        </>
      ) : (
        <>
          <p className="oa-account">
            Signed in as <strong>{info?.email || user.email || 'your Google account'}</strong>
            <button type="button" className="oa-link" onClick={() => void switchAccount()} disabled={busy !== null}>Use another account</button>
          </p>
          <button type="button" className="oa-primary" onClick={() => void decide('allow')} disabled={!ready || busy !== null}>
            {busy === 'allow' ? 'Connecting…' : ready ? 'Allow' : 'Finishing sign-in…'}
          </button>
          <button type="button" className="oa-secondary" onClick={() => void decide('deny')} disabled={busy !== null}>Cancel</button>
        </>
      )}

      <p className="oa-fine">Read-only. Disconnect any time by removing Trace from {client.name}. <Link href="/privacy-policy">Privacy</Link></p>
    </OAuthShell>
  );
}

const css = `
.oa {
  min-height: 100vh; background: #fff; color: #0f1419;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  display: flex; justify-content: center; padding: 48px 16px 64px;
}
.oa-card { width: 100%; max-width: 480px; }
.oa-logo { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 36px; color: #0f1419; text-decoration: none; font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }
.oa-logo img { height: 32px; width: 32px; }
.oa-kicker { margin: 0 0 10px; font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #1d9bf0; }
.oa-title { margin: 0 0 10px; font-size: clamp(1.7rem, 4vw, 2.2rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.12; overflow-wrap: anywhere; }
.oa-sub { margin: 0 0 24px; font-size: 15.5px; line-height: 1.6; color: #536471; overflow-wrap: anywhere; }
.oa-sub strong { color: #0f1419; }
.oa-warn { margin: -10px 0 22px; padding: 12px 14px; border-radius: 14px; background: #fff8e6; border: 1px solid #f5dfa0; font-size: 13.5px; line-height: 1.5; color: #5c4400; }
.oa-perms { list-style: none; margin: 0 0 18px; padding: 16px; border: 1px solid #eff3f4; border-radius: 16px; display: grid; gap: 10px; }
.oa-perms li { display: flex; gap: 10px; font-size: 14.5px; line-height: 1.45; color: #0f1419; }
.oa-yes, .oa-no { flex-shrink: 0; width: 20px; font-weight: 800; text-align: center; }
.oa-yes { color: #00ba7c; }
.oa-no { color: #71767b; }
.oa-email { margin: 0 0 22px; padding: 14px 16px; border-radius: 16px; border: 1px solid #cfe8fb; background: #f0f9ff; font-size: 14px; line-height: 1.5; color: #0f1419; }
.oa-email.muted { border-color: #eff3f4; background: #f7f9f9; color: #536471; }
.oa-account { margin: 0 0 14px; font-size: 14px; color: #536471; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; overflow-wrap: anywhere; }
.oa-account strong { color: #0f1419; }
.oa-link { border: none; background: none; padding: 0; color: #1d9bf0; font: inherit; font-weight: 600; cursor: pointer; }
.oa-link:hover { text-decoration: underline; }
.oa-primary {
  width: 100%; min-height: 50px; border: none; border-radius: 9999px;
  background: #1d9bf0; color: #fff; font-size: 16px; font-weight: 700; font-family: inherit; cursor: pointer;
}
.oa-primary:hover { background: #1a8cd8; }
.oa-primary:disabled { opacity: 0.6; cursor: default; }
.oa-secondary {
  width: 100%; margin-top: 10px; min-height: 46px; border: 1px solid #cfd9de; border-radius: 9999px;
  background: #fff; color: #0f1419; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer;
}
.oa-secondary:hover { background: #f7f9f9; }
.oa-secondary:disabled { opacity: 0.6; cursor: default; }
.oa-error { margin: 0 0 14px; font-size: 14px; font-weight: 600; color: #f4212e; }
.oa-fine { margin: 18px 0 0; font-size: 13px; line-height: 1.55; color: #71767b; overflow-wrap: anywhere; }
.oa-fine a { color: #536471; text-decoration: underline; }
.oa-fine code { font-size: 12px; background: #f7f9f9; padding: 2px 5px; border-radius: 6px; }
@media (max-width: 687px) {
  .oa { padding: 28px 16px calc(32px + env(safe-area-inset-bottom)); }
  .oa-logo { margin-bottom: 28px; }
}
`;
