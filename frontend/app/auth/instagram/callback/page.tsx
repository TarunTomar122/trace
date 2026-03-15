'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

type ConnectState = 'idle' | 'processing' | 'success' | 'error';

export default function InstagramCallbackPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [queryParams, setQueryParams] = useState<{
    code: string;
    error: string;
    errorReason: string;
    errorDescription: string;
  }>({
    code: '',
    error: '',
    errorReason: '',
    errorDescription: '',
  });
  const [state, setState] = useState<ConnectState>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQueryParams({
      code: params.get('code') || '',
      error: params.get('error') || '',
      errorReason: params.get('error_reason') || '',
      errorDescription: params.get('error_description') || '',
    });
  }, []);

  const { code, error, errorReason, errorDescription } = queryParams;

  const authError = useMemo(() => {
    if (!error) return '';
    return [errorReason, errorDescription, error].filter(Boolean).join(' - ');
  }, [error, errorReason, errorDescription]);

  useEffect(() => {
    const run = async () => {
      if (loading || !user) return;
      if (!code) return;
      if (authError) {
        setState('error');
        setMessage(authError);
        return;
      }

      try {
        setState('processing');
        setMessage('Finishing Instagram connection...');
        const idToken = await user.getIdToken();
        const response = await fetch('/api/instagram/oauth/exchange', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ code }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Could not connect Instagram');
        }
        setState('success');
        setMessage(
          data?.instagramUsername
            ? `Connected @${data.instagramUsername} successfully.`
            : 'Connected successfully, but no Instagram Business account was detected on linked pages.'
        );
      } catch (err) {
        setState('error');
        setMessage(err instanceof Error ? err.message : 'Connection failed');
      }
    };
    run();
  }, [loading, user, code, authError]);

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-20">
        <h1 className="text-3xl font-bold">Instagram Connection</h1>
        {!loading && !user ? (
          <div className="rounded-lg border border-neutral-200 p-4">
            <p className="mb-4 text-sm text-neutral-700">
              Sign in to Trace first so we can save Instagram access for your account.
            </p>
            <button
              onClick={() => signInWithGoogle('read')}
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
            >
              Sign in with Google
            </button>
          </div>
        ) : null}

        {!code && !authError ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Missing authorization code in callback URL. Restart Instagram Business Login from settings.
          </p>
        ) : null}

        {state === 'processing' ? (
          <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">{message}</p>
        ) : null}

        {state === 'success' ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>
        ) : null}

        {state === 'error' ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{message}</p>
        ) : null}

        <div className="pt-4">
          <Link href="/feed" className="text-sm font-medium underline">
            Back to feed
          </Link>
        </div>
      </div>
    </main>
  );
}
