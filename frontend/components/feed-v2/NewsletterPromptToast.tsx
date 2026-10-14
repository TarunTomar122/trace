'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { trackNewsletterSignup } from '@/lib/posthog';
import { markNewsletterSubscribed } from '@/lib/newsletter-local';

const FALLBACK_ERROR = "Couldn't subscribe right now. Try again in a moment.";

/**
 * The daily-email ask for signed-out readers, as a small card in the corner (bottom-right on
 * desktop, just above the bottom nav on smaller screens). No scrim, no scroll lock and no
 * focus stealing, so reading carries on underneath. After a signup it shows the confirmation
 * and fades away on its own.
 */
export default function NewsletterPromptToast({
  onClose,
}: {
  onClose: (reason: 'dismissed' | 'subscribed') => void;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [leaving, setLeaving] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // FeedApp passes a new function every render; keep the latest without restarting timers.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closing = useRef(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const close = useCallback((reason: 'dismissed' | 'subscribed') => {
    if (closing.current) return;
    closing.current = true;
    setLeaving(true);
    closeTimer.current = window.setTimeout(() => onCloseRef.current(reason), 180);
  }, []);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (status !== 'done') return;
    const timer = window.setTimeout(() => close('subscribed'), 4000);
    return () => window.clearTimeout(timer);
  }, [status, close]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status === 'loading') return;
    // read this before the button disables: a disabled button drops focus to the page
    const hadFocus = !!rootRef.current?.contains(document.activeElement);
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/newsletter-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' && data.error ? data.error : FALLBACK_ERROR);
      if (data.status !== 'already') trackNewsletterSignup('feed_prompt');
      markNewsletterSubscribed();
      setMessage(data.message || "You're in! Check your inbox.");
      setStatus('done');
      // the form is gone: keep keyboard focus inside the card
      if (hadFocus) window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error && err.message && !/fetch|JSON|token/i.test(err.message) ? err.message : FALLBACK_ERROR);
      if (hadFocus) window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <aside
      ref={rootRef}
      className={`nl-toast${leaving ? ' leaving' : ''}`}
      aria-labelledby="nl-toast-title"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation(); // don't also close the story being read
        close('dismissed');
      }}
    >
      <div className="rounded-2xl border border-[#e6ecf0] bg-white p-4 shadow-[0_12px_40px_rgba(15,20,25,0.16)]">
        <div className="flex items-start justify-between gap-3">
          <p id="nl-toast-title" aria-live="polite" className="pt-1 text-[15px] font-bold leading-snug text-[#0f1419]">
            {status === 'done' ? message : 'Want this in your email daily?'}
          </p>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => close(status === 'done' ? 'subscribed' : 'dismissed')}
            aria-label="Close"
            className="-mr-2 -mt-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-none bg-transparent text-[20px] leading-none text-[#536471] transition-colors hover:bg-[#f7f9f9] hover:text-[#0f1419]"
          >
            ×
          </button>
        </div>
        {status !== 'done' && (
          <form onSubmit={submit} className="mt-2 flex gap-2">
            <input
              ref={inputRef}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              autoComplete="email"
              className="h-10 min-w-0 flex-1 rounded-full border border-[#cfd9de] px-4 text-[16px] outline-none focus:border-[#1d9bf0] focus:ring-2 focus:ring-[#1d9bf0]/20 sm:text-[14px]"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="h-10 flex-shrink-0 rounded-full border-none bg-[#1d9bf0] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#1a8cd8] disabled:opacity-70"
            >
              {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p role="alert" className="mt-2 text-[13px] font-semibold text-[#d6303a]">
            {message}
          </p>
        )}
      </div>
    </aside>
  );
}
