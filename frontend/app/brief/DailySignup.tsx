'use client';

import { useState } from 'react';
import { trackNewsletterSignup } from '@/lib/posthog';

type Status = 'idle' | 'loading' | 'ok' | 'error';

/** Email capture for the public /brief pages: the brief, every morning, free. */
export default function DailySignup({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/newsletter-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'daily_page' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setStatus('ok');
      setMessage(data.message || "You're in! First brief lands tomorrow morning.");
      setEmail('');
      trackNewsletterSignup('daily_page');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong');
    }
  }

  return (
    <div className={compact ? '' : 'rounded-2xl border border-border bg-surface p-6 sm:p-8'}>
      {!compact && (
        <>
          <p className="text-lg font-semibold tracking-[-0.02em] text-foreground">
            Get this in your inbox every morning
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-secondary">
            The ten stories that mattered in tech and AI, summarised. Free, no account needed.
          </p>
        </>
      )}
      <form onSubmit={handleSubmit} className={`${compact ? '' : 'mt-5 '}flex flex-col gap-2.5 sm:flex-row`}>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="h-12 min-w-0 flex-none rounded-full border border-[#cfd9de] bg-white sm:flex-1 px-5 text-[15px] text-foreground outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="h-12 shrink-0 rounded-full bg-[#1d9bf0] px-6 text-[15px] font-bold text-white transition hover:bg-[#1a8cd8] disabled:opacity-60"
        >
          {status === 'loading' ? 'Subscribing…' : 'Subscribe free'}
        </button>
      </form>
      {message && (
        <p
          role="status"
          className={`mt-3 text-sm ${status === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
