'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { proTrialCtaLabel } from '@/lib/pro-trial';
import { SUBSCRIPTION_PRICE_DEFAULT } from '@/lib/subscription-pricing';

const SEND_HOUR_BERLIN = 10;
const SEND_MINUTE_BERLIN = 30;

/** "10:30 Berlin" expressed in the reader's own clock, DST-safe. */
function localSendTime(): string {
  try {
    const offsetHours = (date: Date) => {
      const berlin = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
      const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      return Math.round((berlin.getTime() - utc.getTime()) / 3_600_000);
    };
    const now = new Date();
    const berlinToday = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const utcTarget = new Date(
      Date.UTC(
        berlinToday.getFullYear(),
        berlinToday.getMonth(),
        berlinToday.getDate(),
        SEND_HOUR_BERLIN,
        SEND_MINUTE_BERLIN
      )
    );
    const local = new Date(utcTarget.getTime() - offsetHours(utcTarget) * 3_600_000);
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(local);
  } catch {
    return '10:30';
  }
}

export default function SignupCelebration({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [hint, setHint] = useState('10:30');

  useEffect(() => {
    setHint(localSendTime());
  }, []);

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

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (cancelled) return;
        const colors = ['#1d9bf0', '#0f1419', '#f5a623', '#17bf63', '#ffffff'];
        confetti({
          particleCount: 90,
          spread: 70,
          startVelocity: 42,
          origin: { y: 0.35 },
          colors,
          disableForReducedMotion: true,
        });
        window.setTimeout(() => {
          if (cancelled) return;
          confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.5 }, colors });
          confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.5 }, colors });
        }, 220);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const stop = useCallback((event: React.MouseEvent) => event.stopPropagation(), []);

  return (
    <div
      className="celebrate-scrim fixed inset-0 z-[9999] flex items-center justify-center bg-[#0f1419]/80 p-3 sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-[460px] overflow-y-auto rounded-3xl bg-white p-6 text-center shadow-[0_30px_80px_rgba(15,20,25,0.35)] sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebrate-title"
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

        <p className="mb-1 text-4xl leading-none" aria-hidden="true">🎉</p>
        <h2 id="celebrate-title" className="mb-2 text-2xl font-extrabold tracking-[-0.03em] sm:text-[26px]">
          You&rsquo;re in.
        </h2>
        <p className="mx-auto mb-4 max-w-[360px] text-[15.5px] leading-relaxed text-[#536471]">
          Your first email lands tomorrow at <strong className="text-[#0f1419]">{hint} your time</strong>{' '}
          (10:30 Berlin), and every morning after.
        </p>

        <ul className="mb-5 list-none rounded-2xl bg-[#f7f9f9] px-4 py-4 text-left">
          <li className="flex gap-2.5 text-sm leading-snug text-[#0f1419]">
            <span aria-hidden="true">🤖</span>
            The biggest AI releases and developments of the last 24 hours
          </li>
          <li className="mt-2.5 flex gap-2.5 text-sm leading-snug text-[#0f1419]">
            <span aria-hidden="true">📈</span>
            The market moves worth knowing, not every ticker
          </li>
          <li className="mt-2.5 flex gap-2.5 text-sm leading-snug text-[#0f1419]">
            <span aria-hidden="true">🎯</span>
            Picked for you once you pick your topics
          </li>
        </ul>

        <div className="flex flex-wrap justify-center gap-2.5">
          <a
            href="/feed?from=email"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#1d9bf0] px-6 text-sm font-bold text-white no-underline transition-colors hover:bg-[#1a8cd8]"
          >
            Open the feed
          </a>
          <a
            href="/subscribe?from=email"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-[#536471] no-underline transition-colors hover:bg-black/5 hover:text-[#0f1419]"
          >
            {proTrialCtaLabel(SUBSCRIPTION_PRICE_DEFAULT)}
          </a>
        </div>

        <p className="mt-4 text-xs text-[#71767b]">One email a day. Unsubscribe any time from the footer.</p>
      </div>
    </div>
  );
}
