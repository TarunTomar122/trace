'use client';

import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { displaySerif } from '@/lib/home-fonts';

export default function SignupCelebration({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (cancelled) return;
        const colors = ['#1634cc', '#ffef5f', '#f48cd9', '#5ce308', '#7edcf2'];
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`${displaySerif.variable} celebrate-scrim fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0a]/75 p-3 font-sans sm:p-5`}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="relative max-h-[92vh] w-full max-w-[460px] overflow-y-auto rounded-[16px] border-8 border-white bg-white p-6 text-center text-[#0a0a0a] shadow-[0_30px_80px_rgba(10,10,10,0.35)] sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebrate-title"
        onClick={stop}
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 h-8 w-8 rounded-[4px] border-none bg-[#f7f7f8] text-lg leading-none text-[#323232] transition-colors hover:bg-[#e5e5e5] hover:text-[#0a0a0a]"
        >
          ×
        </button>

        <p className="mb-1 text-4xl leading-none" aria-hidden="true">🎉</p>
        <h2 id="celebrate-title" className="mb-2 font-[family-name:var(--font-hp-serif)] text-[34px] font-medium leading-[1.05] sm:text-[40px]">
          You&rsquo;re in.
        </h2>
        <p className="mx-auto mb-4 max-w-[360px] text-[15.5px] leading-relaxed text-[#323232]">
          Check your inbox for a welcome email. Your brief arrives every morning around{' '}
          <strong className="text-[#0a0a0a]">9:30am UK time</strong>.
        </p>

        <ul className="mb-5 list-none rounded-[12px] bg-[#edeffd] px-4 py-4 text-left">
          <li className="flex gap-2.5 text-sm leading-snug text-[#0a0a0a]">
            <span aria-hidden="true">🤖</span>
            The biggest AI releases and developments of the last 24 hours
          </li>
          <li className="mt-2.5 flex gap-2.5 text-sm leading-snug text-[#0a0a0a]">
            <span aria-hidden="true">📈</span>
            The market moves worth knowing, not every ticker
          </li>
          <li className="mt-2.5 flex gap-2.5 text-sm leading-snug text-[#0a0a0a]">
            <span aria-hidden="true">🎯</span>
            Picked for you once you pick your topics
          </li>
        </ul>

        <div className="flex flex-wrap justify-center gap-2.5">
          <a
            href="/feed?utm_source=site&utm_medium=signup_celebration"
            className="inline-flex h-11 items-center justify-center rounded-[4px] bg-[#0a0a0a] px-6 text-[16px] text-white no-underline transition-colors hover:bg-[#323232]"
          >
            Open the feed
          </a>
        </div>

        <p className="mt-4 text-xs text-[#767676]">One email a day. Unsubscribe anytime from the footer.</p>
      </div>
    </div>,
    document.body
  );
}
