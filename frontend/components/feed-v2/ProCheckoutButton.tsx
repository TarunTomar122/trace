'use client';

import { useEffect, useRef, useState } from 'react';
import { consumePendingPostAuthIntent, useAuth } from '@/contexts/AuthContext';
import { trackCheckoutClicked } from '@/lib/posthog';

function friendlyCheckoutError(status: number, error?: string): string {
  const msg = error || '';
  if (status === 429 || /wait a moment/i.test(msg)) {
    return 'Just a moment — please try again in a few seconds.';
  }
  if (/already has an active subscription/i.test(msg)) {
    return 'You’re already on Pro — manage your plan in Profile.';
  }
  if (/already exists/i.test(msg) || /being processed/i.test(msg) || /being set up/i.test(msg)) {
    return 'Your subscription is already being set up — refresh in a minute.';
  }
  if (/not configured|unavailable/i.test(msg)) {
    return 'Checkout is temporarily unavailable. Please try again later.';
  }
  return 'Could not open checkout — please try again.';
}

/**
 * Takes the reader straight to the Dodo Payments gateway:
 * creates a per-user checkout session server-side, then redirects.
 * Signed-out readers sign in first, then checkout continues automatically —
 * including after the popup-blocked redirect flow.
 */
export default function ProCheckoutButton({
  className,
  label = 'Go Pro',
  busyLabel = 'Opening checkout…',
  source = 'pro_checkout',
  returnPath,
}: {
  className?: string;
  label?: string;
  busyLabel?: string;
  source?: string;
  /** App-relative path to return to after payment (defaults to current page). */
  returnPath?: string;
}) {
  const { user, loading, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ensures the click path and the redirect-resume path never both start a checkout.
  const started = useRef(false);

  async function startCheckout(u: { getIdToken: () => Promise<string> }) {
    started.current = true;
    setBusy(true);
    setError(null);
    try {
      const token = await u.getIdToken();
      const fallbackPath = typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '/feed';
      const res = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_path: returnPath || fallbackPath }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(friendlyCheckoutError(res.status, data.error));
      if (!data.checkoutUrl) throw new Error('Could not open checkout — please try again.');
      window.location.href = data.checkoutUrl;
    } catch (err) {
      started.current = false;
      setError(err instanceof Error ? err.message : 'Could not open checkout — please try again.');
      setBusy(false);
    }
  }

  // Resume after a redirect-based sign-in (popup blocked, page remounted).
  useEffect(() => {
    if (loading || !user || started.current) return;
    if (consumePendingPostAuthIntent() === 'checkout') {
      void startCheckout(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function onClick() {
    if (busy || loading) return;
    trackCheckoutClicked(source);
    if (!user) {
      setBusy(true);
      setError(null);
      const result = await signInWithGoogle('checkout');
      if (result.status === 'success') {
        consumePendingPostAuthIntent();
        if (!started.current) await startCheckout(result.user);
        return;
      }
      setBusy(false);
      if (result.status === 'error') {
        setError('Couldn’t sign you in — please try again.');
      }
      // cancelled: the user closed the popup on purpose; stay quiet.
      return;
    }
    await startCheckout(user);
  }

  return (
    <>
      <button type="button" className={className} onClick={onClick} disabled={busy || loading}>
        {busy ? busyLabel : label}
      </button>
      {error ? (
        <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: '#f91880' }}>{error}</p>
      ) : null}
    </>
  );
}
