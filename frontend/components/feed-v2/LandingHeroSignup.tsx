'use client';

import { useEffect, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import SignupCelebration from '@/components/feed-v2/SignupCelebration';
import { trackNewsletterSignup } from '@/lib/posthog';
import { markNewsletterSubscribed } from '@/lib/newsletter-local';

type Status = 'idle' | 'loading' | 'ok' | 'error';

/** Where the address came from: PostHog's source and the API's stored source. */
const SOURCES = {
  landing: 'landing_page',
  daily_page: 'daily_page',
  how_it_works: 'landing_page',
  agents: 'landing_page',
  compare: 'landing_page',
  newsletters: 'landing_page',
} as const;
export type SignupSource = keyof typeof SOURCES;

/**
 * The site's email form (homepage and the 1440-style pages). `strip` sits in
 * the bar under the header (its fine print is in the bar's copy); `box` closes
 * a page with its own fine print. `source` says which page it is on.
 */
export default function LandingHeroSignup({
  placement,
  inputId,
  source = 'landing',
}: {
  placement: 'strip' | 'box';
  inputId?: string;
  source?: SignupSource;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [celebrating, setCelebrating] = useState(false);

  // Arrived via another page's Subscribe link (/#subscribe, /brief#subscribe): the browser has
  // scrolled to the form, so put the cursor in it.
  useEffect(() => {
    if (inputId && window.location.hash === '#subscribe') document.getElementById(inputId)?.focus({ preventScroll: true });
  }, [inputId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/newsletter-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: SOURCES[source] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' && data.error ? data.error : "Couldn't subscribe right now. Try again in a moment.");
      setStatus('ok');
      setMessage(data.message || "You're in!");
      setEmail('');
      markNewsletterSubscribed();
      // Already on the list: the message says so; no "check your inbox" celebration.
      if (data.status !== 'already') {
        trackNewsletterSignup(source === 'daily_page' ? 'daily_page' : 'landing', { placement, page: source });
        setCelebrating(true);
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className={`hp-signup hp-signup-${placement}`}>
      <form className="hp-form" onSubmit={handleSubmit}>
        <input
          id={inputId}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          autoComplete="email"
          aria-label="Email address"
          className="hp-input"
        />
        {/* aria-disabled, not disabled: keeps keyboard focus on the button while it sends. */}
        <button type="submit" className="hp-submit" aria-disabled={status === 'loading'}>
          {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
        </button>
      </form>
      {/* Always in the DOM so screen readers announce the result when it lands. */}
      <p className={`hp-msg ${status === 'ok' ? 'is-ok' : 'is-error'}`} role="status">
        {message}
      </p>
      {placement === 'box' && (
        <p className="hp-fine">
          <CircleCheck size={14} strokeWidth={2.4} aria-hidden="true" />
          <span>100% free · Every morning · Unsubscribe anytime. <a href="/terms">Terms</a> &amp; <a href="/privacy-policy">Privacy</a>.</span>
        </p>
      )}
      {celebrating && <SignupCelebration onClose={() => setCelebrating(false)} />}
    </div>
  );
}
