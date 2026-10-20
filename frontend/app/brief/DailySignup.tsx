'use client';

import { useState } from 'react';
import { trackNewsletterSignup } from '@/lib/posthog';
import { markNewsletterSubscribed } from '@/lib/newsletter-local';

type Status = 'idle' | 'loading' | 'ok' | 'error';
type Source = 'daily_page' | 'featured_page';

/** Email capture for the public /brief and /featured pages: the brief, every morning, free. */
export default function DailySignup({
  compact = false,
  source = 'daily_page',
  heading = 'Get this in your inbox every morning',
  blurb = 'The ten stories that mattered in tech and AI, summarised. Free, no account needed.',
}: {
  compact?: boolean;
  source?: Source;
  heading?: string;
  blurb?: string;
}) {
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
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' && data.error ? data.error : "Couldn't subscribe right now. Try again in a moment.");
      setStatus('ok');
      setMessage(data.message || "You're in! Check your inbox for a welcome email.");
      setEmail('');
      if (data.status !== 'already') trackNewsletterSignup(source);
      markNewsletterSubscribed();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong');
    }
  }

  return (
    // The homepage's look (lib/home-css.ts): a lavender box, a square-cornered field, a blue button.
    <div className={compact ? '' : 'rounded-[20px] bg-[#edeffd] p-6 text-[#0a0a0a] sm:p-8'}>
      {!compact && (
        <>
          <p className="text-[21px] font-semibold leading-snug tracking-[-0.01em]">{heading}</p>
          <p className="mt-1.5 text-[16px] leading-relaxed">{blurb}</p>
        </>
      )}
      <form onSubmit={handleSubmit} className={`${compact ? '' : 'mt-5 '}flex flex-col gap-2.5 sm:flex-row`}>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Your email"
          aria-label="Email address"
          className="h-11 min-w-0 flex-none rounded-[3px] border border-[#8f8f8f] bg-white px-3 text-[16px] text-[#0a0a0a] outline-none transition placeholder:text-[#767676] focus:border-[#1634cc] focus:ring-[3px] focus:ring-[#1634cc]/20 sm:flex-1"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="h-11 shrink-0 rounded-[3px] bg-[#1634cc] px-5 text-[16px] text-white transition-colors hover:bg-[#102798] disabled:opacity-60"
        >
          {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
        </button>
      </form>
      {message && (
        <p
          role="status"
          className={`mt-3 text-sm font-semibold ${status === 'ok' ? 'text-[#10601f]' : 'text-[#971111]'}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
