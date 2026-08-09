"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Chrome, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type Status = 'idle' | 'connecting' | 'connected' | 'error';

export default function ExtensionConnectClient({
  extensionId,
  checkout,
}: {
  extensionId: string;
  checkout: boolean;
}) {
  const { user, loading, signInWithGoogle } = useAuth();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  const connect = useCallback(async () => {
    if (!user || !/^[a-p]{32}$/.test(extensionId) || started.current) return;
    started.current = true;
    setStatus('connecting');
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/extension/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error('Could not create an extension session');
      const session = await response.json() as { token: string; expiresAt: string };
      const runtime = (window as typeof window & {
        chrome?: { runtime?: { sendMessage?: (...args: unknown[]) => void; lastError?: { message?: string } } };
      }).chrome?.runtime;
      if (!runtime?.sendMessage) throw new Error('Open this page from the Trace extension');
      await new Promise<void>((resolve, reject) => {
        runtime.sendMessage?.(extensionId, {
          type: 'TRACE_EXTENSION_SESSION',
          token: session.token,
          expiresAt: session.expiresAt,
        }, (result: { ok?: boolean } | undefined) => {
          const error = runtime.lastError?.message;
          if (error || !result?.ok) reject(new Error(error || 'Trace extension did not respond'));
          else resolve();
        });
      });
      setStatus('connected');
      if (checkout) window.location.assign('/profile?tab=subscription&intent=checkout');
    } catch (error) {
      started.current = false;
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Could not connect Trace');
    }
  }, [checkout, extensionId, user]);

  useEffect(() => {
    if (!loading && user) void connect();
  }, [connect, loading, user]);

  const signIn = async () => {
    setMessage('');
    const result = await signInWithGoogle(checkout ? 'checkout' : 'read', { rememberIntent: false });
    if (result.status === 'error') {
      setStatus('error');
      setMessage(result.message);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f1efe8] px-5 text-[#181815]">
      <section className="w-full max-w-[460px] text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#181815] text-white">
          {status === 'connected' ? <Check size={20} /> : <Chrome size={20} />}
        </span>
        <h1 className="mt-7 text-[36px] font-semibold tracking-[-0.045em]">
          {status === 'connected' ? 'Trace is connected.' : 'Connect Trace to Chrome.'}
        </h1>
        <p className="mx-auto mt-3 max-w-[380px] text-[15px] leading-7 text-[#6d6b62]">
          One Google account keeps your saved stories and Trace Pro access in sync with the web feed.
        </p>
        {!user && !loading && (
          <button type="button" onClick={() => void signIn()} className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#181815] px-6 py-3.5 text-[14px] font-semibold text-white active:scale-[0.96] transition-transform">
            Continue with Google
          </button>
        )}
        {(loading || status === 'connecting') && (
          <p className="mt-7 inline-flex items-center gap-2 text-[14px] font-medium"><Loader2 size={16} className="animate-spin" /> Connecting...</p>
        )}
        {status === 'error' && (
          <div className="mt-7">
            <p className="text-[13px] text-red-700">{message}</p>
            {user && <button type="button" onClick={() => void connect()} className="mt-4 rounded-full bg-[#181815] px-5 py-3 text-[13px] font-semibold text-white">Try again</button>}
          </div>
        )}
        {status === 'connected' && !checkout && <p className="mt-7 text-[14px] text-[#6d6b62]">You can close this tab.</p>}
      </section>
    </main>
  );
}
