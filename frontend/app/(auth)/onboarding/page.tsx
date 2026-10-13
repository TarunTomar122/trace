'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_INTERESTS } from '@/components/feed-v2/FeedApp';
import { trackDailyBriefPreferenceChanged, trackOnboardingCompleted } from '@/lib/posthog';

const CAT_LABELS: Record<string, string> = {
  ai: 'AI',
  markets: 'Markets',
  'ux-design': 'Design',
  engineering: 'Engineering',
  tech: 'Tech',
  startups: 'Startups',
  security: 'Security',
  'open-source': 'Open source',
  policy: 'Policy',
};

export default function OnboardingPage() {
  const { user, profile, profileResolved, refreshProfile } = useAuth();
  const router = useRouter();
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dailyBrief, setDailyBrief] = useState(true);

  useEffect(() => {
    if (hydrated || !profileResolved) return;
    if (profile) {
      setInterests(Array.isArray(profile.interests) ? (profile.interests as string[]).filter((i) => ALL_INTERESTS.includes(i)) : []);
    }
    setHydrated(true);
  }, [profile, profileResolved, hydrated]);

  function toggle(t: string) {
    setInterests((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  async function save() {
    if (busy || !user) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          interests,
          onboarded: true,
          onboardedAt: new Date().toISOString(),
          newsletterOptIn: dailyBrief,
          dailyNewsletterEnabled: dailyBrief,
        }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      trackOnboardingCompleted({
        interests_count: interests.length,
        hobbies_count: 0,
        daily_brief_enabled: dailyBrief,
      });
      if (dailyBrief) trackDailyBriefPreferenceChanged(true, 'onboarding');
      await refreshProfile().catch(() => null);
      router.replace('/feed');
    } catch {
      setError('Could not save your setup — try again.');
      setBusy(false);
    }
  }

  return (
    <main className="ob">
      <style>{css}</style>
      <div className="ob-card">
        <p className="ob-kicker">Welcome to Trace</p>
        <h1 className="ob-title">Pick a few topics and your feed is yours.</h1>
        <p className="ob-sub">Interests only order your For You feed — they don&apos;t hide stories. You can change them anytime from Profile.</p>

        <section className="ob-section">
          <h2 className="ob-label">Interests <span className="ob-optional">pick any</span></h2>
          <div className="ob-chips">
            {ALL_INTERESTS.map((t) => (
              <button key={t} className={`ob-chip${interests.includes(t) ? ' on' : ''}`} onClick={() => toggle(t)} aria-pressed={interests.includes(t)}>
                {CAT_LABELS[t] || t}
              </button>
            ))}
          </div>
          <p className="ob-hint">These only re-order your For You feed.</p>
        </section>

        <section className="ob-section ob-email">
          <button
            type="button"
            className={`ob-email-toggle${dailyBrief ? ' on' : ''}`}
            onClick={() => setDailyBrief((v) => !v)}
            aria-pressed={dailyBrief}
          >
            <span className="ob-email-copy">
              <strong>Get tomorrow&apos;s brief by email</strong>
              <span>Your top 10 stories every morning, around 9:30am UK time. One tap to turn off.</span>
            </span>
            <span className="ob-email-check" aria-hidden="true">{dailyBrief ? '✓' : ''}</span>
          </button>
        </section>

        {error ? <p className="ob-error" role="alert">{error}</p> : null}
        <button className="ob-save" onClick={save} disabled={busy || !user}>
          {busy ? 'Saving…' : 'Build my feed'}
        </button>
        <button
          className="ob-skip"
          onClick={() => {
            try { sessionStorage.setItem('trace_onboarding_skipped', '1'); } catch {}
            router.replace('/feed');
          }}
          disabled={busy}
        >
          Skip for now
        </button>
      </div>
    </main>
  );
}

const css = `
.ob {
  min-height: 100vh; background: #fff; color: #0f1419;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  display: flex; justify-content: center; padding: 40px 16px 64px;
}
.ob-card { width: 100%; max-width: 560px; }
.ob-kicker { margin: 0 0 10px; font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #1d9bf0; }
.ob-title { margin: 0 0 10px; font-size: clamp(1.8rem, 4vw, 2.4rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }
.ob-sub { margin: 0 0 28px; font-size: 16px; line-height: 1.6; color: #536471; }
.ob-section { margin-bottom: 24px; }
.ob-label { margin: 0 0 12px; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #536471; }
.ob-optional { font-weight: 500; letter-spacing: 0; text-transform: none; color: #71767b; margin-left: 6px; }
.ob-hint { margin: 12px 0 0; font-size: 13.5px; line-height: 1.5; color: #71767b; }
.ob-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.ob-chip {
  padding: 10px 16px; border-radius: 9999px; border: 1px solid #eff3f4;
  background: #fff; color: #0f1419; font-size: 14.5px; font-weight: 600;
  font-family: inherit; cursor: pointer; transition: background-color 0.15s ease;
}
.ob-chip:hover { background: #f7f9f9; }
.ob-chip.on { background: #eff3f4; border-color: #eff3f4; font-weight: 700; }
.ob-error { margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #f91880; }
.ob-save {
  width: 100%; height: 50px; border: none; border-radius: 9999px;
  background: #1d9bf0; color: #fff; font-size: 16px; font-weight: 700;
  font-family: inherit; cursor: pointer; margin-top: 8px;
}
.ob-save:hover { background: #1a8cd8; }
.ob-save:disabled { opacity: 0.7; cursor: wait; }
.ob-skip {
  width: 100%; margin-top: 10px; height: 44px; border: none; background: transparent;
  color: #536471; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer;
}
.ob-skip:hover { color: #0f1419; }
.ob-email-toggle {
  width: 100%; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 14px 16px; border-radius: 16px; border: 1px solid #cfe8fb; background: #f0f9ff;
  text-align: left; cursor: pointer; font-family: inherit;
}
.ob-email-toggle.on { border-color: #00ba7c; background: #f0fdf7; }
.ob-email-copy { display: flex; flex-direction: column; gap: 4px; }
.ob-email-copy strong { font-size: 15px; color: #0f1419; }
.ob-email-copy span { font-size: 13px; line-height: 1.45; color: #536471; }
.ob-email-check {
  width: 24px; height: 24px; border-radius: 9999px; border: 2px solid #1d9bf0;
  display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #1d9bf0; flex-shrink: 0;
}
.ob-email-toggle.on .ob-email-check { background: #00ba7c; border-color: #00ba7c; color: #fff; }
@media (max-width: 687px) {
  .ob { padding: 24px 14px calc(32px + env(safe-area-inset-bottom)); }
  .ob-title { font-size: 1.65rem; }
  .ob-email-toggle { padding: 12px 14px; }
  .ob-save, .ob-skip { min-height: 48px; }
}
`;
