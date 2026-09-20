'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
    let target = new Date(
      Date.UTC(
        berlinToday.getFullYear(),
        berlinToday.getMonth(),
        berlinToday.getDate(),
        SEND_HOUR_BERLIN,
        SEND_MINUTE_BERLIN
      )
    );
    target = new Date(target.getTime() - offsetHours(target) * 3_600_000);
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(target);
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
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
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
    <div className="celebrate-scrim" onClick={onClose} role="presentation">
      <div
        className="celebrate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebrate-title"
        onClick={stop}
      >
        <button ref={closeRef} className="celebrate-x" onClick={onClose} aria-label="Close">
          ×
        </button>

        <p className="celebrate-emoji" aria-hidden="true">🎉</p>
        <h2 className="celebrate-title" id="celebrate-title">You&rsquo;re in.</h2>
        <p className="celebrate-lede">
          Your first <strong>5 big things today</strong> lands tomorrow at{' '}
          <strong>{hint} your time</strong> (10:30 Berlin), and every morning after that.
        </p>

        <ul className="celebrate-list">
          <li>
            <span aria-hidden="true">🤖</span>
            The biggest AI releases and developments of the last 24 hours
          </li>
          <li>
            <span aria-hidden="true">📈</span>
            The market moves worth knowing, not every ticker
          </li>
          <li>
            <span aria-hidden="true">🎯</span>
            Picked for you once you pick your topics
          </li>
        </ul>

        <div className="celebrate-upsell">
          <p className="celebrate-upsell-title">Want 10 instead of 5?</p>
          <p className="celebrate-upsell-body">
            Pro sends all <strong>10 big things</strong> every morning, ranked deeper into your
            interests, plus full Pulse and the archive.
          </p>
          <div className="celebrate-actions">
            <a href="/subscribe?from=email" className="btn-primary celebrate-cta">
              Go Pro
            </a>
            <a href="/feed?from=email" className="celebrate-secondary">
              Personalize it free
            </a>
          </div>
        </div>

        <p className="celebrate-foot">
          One email a day. Unsubscribe any time from the footer.
        </p>
      </div>
    </div>
  );
}
