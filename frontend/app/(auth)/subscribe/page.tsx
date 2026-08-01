"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPostAuthDestination, useAuth } from '@/contexts/AuthContext';

export default function SubscribePage() {
  const router = useRouter();
  const { user, profile, loading, profileResolved, signInWithGoogle } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && profileResolved) {
      router.replace(getPostAuthDestination(profile, 'checkout'));
    }
  }, [profile, profileResolved, router, user]);

  const continueToCheckout = async () => {
    setError('');
    const result = await signInWithGoogle('checkout');
    if (result.status === 'success') {
      router.replace(getPostAuthDestination(result.profile, result.intent));
    } else if (result.status === 'error') {
      setError('Sign-in failed. Please try again.');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f5] px-5 text-[#1b1a17]">
      <div className="w-full max-w-[420px] border border-[#e4e1d8] p-7 text-center sm:p-9">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2557d6]">
          Trace Pro
        </p>
        <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">
          Try the complete builder feed free for 3 days
        </h1>
        <p className="mt-3 text-[14px] leading-[1.7] text-[#75705f]">
          Continue with Google to start your trial. No charge for 3 days.
        </p>
        <button
          type="button"
          disabled={loading || Boolean(user)}
          onClick={() => void continueToCheckout()}
          className="mt-7 w-full bg-[#1b1a17] px-5 py-3.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {loading || user ? 'Loading checkout…' : 'Start free trial with Google'}
        </button>
        {error && <p className="mt-3 text-[12px] text-red-700" role="alert">{error}</p>}
      </div>
    </main>
  );
}
