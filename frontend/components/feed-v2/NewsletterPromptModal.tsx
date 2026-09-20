'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SignupCelebration from '@/components/feed-v2/SignupCelebration';

/**
 * Email capture for signed-out readers exploring the feed.
 *
 * Shows the newsletter offer (5 big things free, 10 with Pro) and, on a
 * successful subscribe, hands off to the confetti celebration.
 */
export default function NewsletterPromptModal({
  onClose,
  onSignIn,
}: {
  onClose: () => void;
  onSignIn?: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/newsletter-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setCelebrating(true);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  const stop = useCallback((event: React.MouseEvent) => event.stopPropagation(), []);

  if (celebrating) return <SignupCelebration onClose={onClose} />;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[3px] sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-3xl bg-white p-6 shadow-[0_30px_80px_rgba(15,20,25,0.35)] sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nl-prompt-title"
        onClick={stop}
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 h-8 w-8 rounded-full border-none bg-[#f7f9f9] text-lg leading-none text-[#536471] transition-colors hover:bg-[#eef2f3] hover:text-[#0f1419]"
        >
          ×
        </button>

        <p className="mb-2 inline-block rounded-full bg-[#1d9bf0]/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#1477c0]">
          Free daily email
        </p>
        <h2
          id="nl-prompt-title"
          className="mb-2 text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-[#0f1419] sm:text-[30px]"
        >
          10 big things in tech and AI, every morning.
        </h2>
        <p className="mb-5 text-[15px] leading-relaxed text-[#536471]">
          The biggest AI releases and developments, the market moves worth knowing, and the few stories
          shaping the day. No feed to scroll, no 40-tab morning.
        </p>

        <ul className="mb-5 list-none space-y-2 rounded-2xl bg-[#f7f9f9] px-4 py-4 text-left">
          <li className="flex gap-2.5 text-sm leading-snug text-[#0f1419]">
            <span aria-hidden="true">✅</span> 5 big things free. Pro reads all 10
          </li>
          <li className="flex gap-2.5 text-sm leading-snug text-[#0f1419]">
            <span aria-hidden="true">📬</span> One email, 10:30 Berlin time, unsubscribe any time
          </li>
          <li className="flex gap-2.5 text-sm leading-snug text-[#0f1419]">
            <span aria-hidden="true">🎯</span> Personalises to your topics
          </li>
        </ul>

        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            className="h-12 flex-1 rounded-full border border-[#cfd9de] px-5 text-[15px] outline-none focus:border-[#1d9bf0] focus:ring-2 focus:ring-[#1d9bf0]/20"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="h-12 flex-shrink-0 rounded-full bg-[#1d9bf0] px-6 text-[15px] font-bold text-white transition-colors hover:bg-[#1a8cd8] disabled:opacity-70"
          >
            {status === 'loading' ? 'Signing up…' : 'Get the brief'}
          </button>
        </form>

        {error ? <p className="mt-2 text-sm font-semibold text-[#d6303a]">{error}</p> : null}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-[#536471]">
          <a href="/subscribe?from=email" className="font-bold text-[#0f1419] no-underline hover:underline">
            Go Pro for all 10
          </a>
          <span className="text-[#cfd9de]">·</span>
          <button
            type="button"
            onClick={() => (onSignIn ? onSignIn() : (window.location.href = '/feed'))}
            className="border-none bg-transparent p-0 text-[13px] font-semibold text-[#536471] underline-offset-2 hover:underline"
          >
            or sign in to the feed
          </button>
        </div>
      </div>
    </div>
  );
}
