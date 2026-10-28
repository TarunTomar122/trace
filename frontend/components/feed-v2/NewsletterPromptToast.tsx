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
        body: JSON.stringify({ email, source: 'feed_prompt' }),
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
      <div className="relative overflow-hidden rounded-[14px] border border-[#e5e5e5] bg-white px-5 pb-4 pt-[18px] shadow-[0_18px_50px_rgba(10,10,10,0.16),0_2px_6px_rgba(10,10,10,0.05)]">
        {/* the site's lavender, as a thin band: ties the card to the brief without filling it */}
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[5px] bg-[#c9cff7]" />
        <button
          ref={closeBtnRef}
          type="button"
          onClick={() => close(status === 'done' ? 'subscribed' : 'dismissed')}
          aria-label="Close"
          className="absolute right-2 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border-none bg-transparent text-[18px] leading-none text-[#767676] transition-colors hover:bg-[#f2f2f2] hover:text-[#0a0a0a]"
        >
          ×
        </button>
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1634cc]">The daily brief</p>
        <p
          id="nl-toast-title"
          aria-live="polite"
          className="m-0 mt-1.5 pr-8 text-[25px] font-medium leading-[1.08] tracking-[-0.01em] text-[#0a0a0a]"
          style={{ fontFamily: 'var(--font-hp-serif), Georgia, "Times New Roman", serif' }}
        >
          {status === 'done' ? 'You’re in.' : 'Tech and AI news, every morning'}
        </p>
        <p className="m-0 mt-2 text-[14px] leading-[1.45] text-[#4a4a4a]">
          {status === 'done' ? message : 'The stories that matter, summed up in one short email. Free.'}
        </p>
        {status !== 'done' && (
          <form
            onSubmit={submit}
            className="mt-3.5 flex h-11 overflow-hidden rounded-[8px] border border-[#c7c7c7] bg-white transition-shadow focus-within:border-[#1634cc] focus-within:ring-[3px] focus-within:ring-[#1634cc]/15"
          >
            <input
              ref={inputRef}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              autoComplete="email"
              className="min-w-0 flex-1 border-none bg-transparent px-3.5 text-[16px] text-[#0a0a0a] outline-none placeholder:text-[#9a9a9a] sm:text-[14.5px]"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="m-1 flex-shrink-0 rounded-[6px] border-none bg-[#1634cc] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#102798] disabled:opacity-70"
            >
              {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </button>
          </form>
        )}
        {status === 'error' ? (
          <p role="alert" className="m-0 mt-2 text-[13px] font-semibold text-[#971111]">
            {message}
          </p>
        ) : status !== 'done' ? (
          <p className="m-0 mt-2 text-[12px] text-[#767676]">No spam. Unsubscribe anytime.</p>
        ) : null}
      </div>
    </aside>
  );
}
