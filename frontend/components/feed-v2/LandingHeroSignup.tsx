'use client';

import { useState } from 'react';
import SignupCelebration from '@/components/feed-v2/SignupCelebration';
import { trackNewsletterSignup } from '@/lib/posthog';

type Status = 'idle' | 'loading' | 'ok' | 'error';

export default function LandingHeroSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [celebrating, setCelebrating] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/newsletter-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setStatus('ok');
      setMessage(data.message || "You're in!");
      setEmail('');
      trackNewsletterSignup('landing');
      setCelebrating(true);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="hero-signup">
      <form className="signup-pill" onSubmit={handleSubmit}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email..."
          aria-label="Email address"
          className="signup-input"
        />
        <button type="submit" className="signup-btn" disabled={status === 'loading'}>
          {status === 'loading' ? 'Signing up…' : 'Get the daily brief'}
          <span className="signup-arrow" aria-hidden="true">→</span>
        </button>
      </form>
      {message && (
        <p className={`signup-msg ${status === 'ok' ? 'is-ok' : 'is-error'}`} role="status">
          {message}
        </p>
      )}
      <p className="signup-note">
        One email every morning, unsubscribe anytime. Or just{' '}
        <a href="/feed">open the feed</a>.
      </p>
      {celebrating && <SignupCelebration onClose={() => setCelebrating(false)} />}
    </div>
  );
}
