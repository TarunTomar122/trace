"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, KeyRound, Loader2, RotateCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasActiveSubscription } from '@/lib/subscription-access';

type KeyStatus = {
  configured: boolean;
  tokenPrefix?: string | null;
  createdAt?: string | null;
};

export default function AgentAccessManager() {
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'key' | 'prompt' | null>(null);
  const isPro = hasActiveSubscription(profile);

  const setupPrompt = useMemo(() => token ? `Connect this agent to Trace as a read-only MCP server.

Server URL: https://www.yourtrace.online/api/mcp
Authorization header: Bearer ${token}

Store the key securely as TRACE_AGENT_KEY. Never commit or print it. After setup, call get_daily_tech_brief and show me today's top tech news, builds, and conversations. Tell me once the connection is verified.` : '', [token]);

  useEffect(() => {
    if (!user) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    void user.getIdToken().then((idToken) => fetch('/api/agents/key', {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    })).then(async (response) => {
      if (!response.ok) throw new Error('Could not load Agent Key status');
      const next = await response.json() as KeyStatus;
      if (!cancelled) setStatus(next);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load Agent Key status');
    });
    return () => { cancelled = true; };
  }, [user]);

  const createKey = async () => {
    if (!user) return;
    if (status?.configured && !window.confirm('Rotate your Agent Key? Your existing agent connection will stop working immediately.')) return;
    setBusy(true);
    setError('');
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/agents/key', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const body = await response.json() as { token?: string; error?: string };
      if (!response.ok || !body.token) throw new Error(body.error || 'Could not create Agent Key');
      setToken(body.token);
      setStatus({ configured: true, tokenPrefix: body.token.slice(0, 18), createdAt: new Date().toISOString() });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create Agent Key');
    } finally {
      setBusy(false);
    }
  };

  const revokeKey = async () => {
    if (!user || !window.confirm('Revoke Agent Access? Connected agents will stop working immediately.')) return;
    setBusy(true);
    setError('');
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/agents/key', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error('Could not revoke Agent Access');
      setToken('');
      setStatus({ configured: false });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not revoke Agent Access');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string, kind: 'key' | 'prompt') => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  };

  if (loading) {
    return (
      <div className="border border-[#d9dded] bg-white p-6 sm:p-8">
        <p className="text-[14px] text-[#6d7280]">Checking your sign-in…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="border border-[#d9dded] bg-white p-6 sm:p-8">
        <KeyRound size={20} className="text-[#2557d6]" />
        <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.02em]">Sign in to create your Agent Key</h3>
        <p className="mt-2 max-w-xl text-[14px] leading-[1.7] text-[#6d7280]">The key is read-only and belongs to your Trace account. Agent Access is included with Pro.</p>
        <button type="button" onClick={() => void signInWithGoogle('read')} className="mt-5 bg-[#2557d6] px-5 py-3 text-[14px] font-semibold text-white hover:bg-[#1d48b4]">Sign in with Google</button>
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="border border-[#d9dded] bg-white p-6 sm:p-8">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2557d6]">Pro feature</p>
        <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">Start your 3-day Pro trial to connect an agent</h3>
        <p className="mt-2 max-w-xl text-[14px] leading-[1.7] text-[#6d7280]">No charge for 3 days. Your key keeps working only while Pro or the trial is active.</p>
        <Link href="/profile?tab=subscription&intent=checkout" className="mt-5 inline-flex bg-[#2557d6] px-5 py-3 text-[14px] font-semibold text-white hover:bg-[#1d48b4]">Try Pro free for 3 days</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-[#d9dded] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2557d6]">Agent Key · read only</p>
            <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">{status?.configured ? 'Agent Access is ready' : 'Create your Agent Key'}</h3>
            <p className="mt-2 max-w-xl text-[14px] leading-[1.7] text-[#6d7280]">One active key per account. Rotating it immediately invalidates the old key.</p>
          </div>
          {status?.configured && <span className="bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">Active</span>}
        </div>

        {token && (
          <div className="mt-6 border border-amber-200 bg-amber-50 p-4">
            <p className="text-[12px] font-semibold text-amber-900">Copy this key now. Trace will not show it again.</p>
            <div className="mt-3 flex gap-2">
              <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap bg-white px-3 py-2.5 font-mono text-[12px] text-[#202532]">{token}</code>
              <button type="button" onClick={() => copy(token, 'key')} className="inline-flex items-center gap-2 bg-[#202532] px-4 py-2 text-[12px] font-semibold text-white">
                {copied === 'key' ? <Check size={13} /> : <Copy size={13} />}{copied === 'key' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {token && (
          <div className="mt-4 border border-[#d9dded] bg-[#f7f8fc] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-semibold text-[#202532]">Fastest setup: paste this into your agent</p>
              <button type="button" onClick={() => copy(setupPrompt, 'prompt')} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2557d6]">
                {copied === 'prompt' ? <Check size={13} /> : <Copy size={13} />}{copied === 'prompt' ? 'Copied' : 'Copy prompt'}
              </button>
            </div>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-[1.7] text-[#596071]">{setupPrompt}</pre>
          </div>
        )}

        {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={createKey} disabled={busy} className="inline-flex items-center gap-2 bg-[#2557d6] px-5 py-3 text-[13px] font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : status?.configured ? <RotateCw size={14} /> : <KeyRound size={14} />}
            {status?.configured ? 'Rotate key' : 'Create Agent Key'}
          </button>
          {status?.configured && (
            <button type="button" onClick={revokeKey} disabled={busy} className="inline-flex items-center gap-2 border border-red-200 px-5 py-3 text-[13px] font-semibold text-red-600 disabled:opacity-50"><Trash2 size={14} />Revoke access</button>
          )}
        </div>
      </div>
    </div>
  );
}
