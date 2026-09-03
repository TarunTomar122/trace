'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Takes the reader straight to the Dodo Payments gateway:
 * creates a per-user checkout session server-side, then redirects.
 * Signed-out readers sign in first, then checkout continues automatically.
 */
export default function ProCheckoutButton({
  className,
  label = 'Go Pro — $3/mo',
  busyLabel = 'Opening checkout…',
}: {
  className?: string;
  label?: string;
  busyLabel?: string;
}) {
  const { user, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function startCheckout(u: { getIdToken: () => Promise<string> }) {
    setBusy(true);
    setError(null);
    try {
      const token = await u.getIdToken();
      const res = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open checkout');
      if (!data.checkoutUrl) throw new Error('Could not open checkout');
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  // continue to checkout right after sign-in (single-click for new users)
  useEffect(() => {
    if (user && pending.current) {
      pending.current = false;
      startCheckout(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function onClick() {
    if (busy) return;
    if (!user) {
      pending.current = true;
      try {
        await signInWithGoogle();
      } catch {
        pending.current = false;
      }
      return;
    }
    startCheckout(user);
  }

  return (
    <>
      <button type="button" className={className} onClick={onClick} disabled={busy}>
        {busy ? busyLabel : label}
      </button>
      {error ? (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: '#f91880' }}>{error}</p>
      ) : null}
    </>
  );
}
