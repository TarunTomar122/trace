'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_INTERESTS, ROLE_LABELS } from '@/components/feed-v2/FeedApp';

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

function mapRole(r?: string | null): string {
  const s = (r || '').toLowerCase();
  if (s.includes('founder')) return 'founder';
  if (s.includes('design')) return 'designer';
  if (s.includes('product')) return 'pm';
  if (s.includes('invest')) return 'investor';
  if (s.includes('student') || s.includes('learn')) return 'student';
  return 'engineer';
}

export default function OnboardingPage() {
  const { user, profile, profileResolved, refreshProfile } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState('engineer');
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !profileResolved) return;
    if (profile) {
      setRole(mapRole(profile.role));
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
          role: ROLE_LABELS[role] || role,
          interests,
          onboarded: true,
          onboardedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
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
        <h1 className="ob-title">Two picks and your feed is yours.</h1>
        <p className="ob-sub">Your role and interests decide what floats to the top. You can change them anytime from Profile.</p>

        <section className="ob-section">
          <h2 className="ob-label">Your role</h2>
          <div className="ob-chips">
            {Object.entries(ROLE_LABELS).map(([id, label]) => (
              <button key={id} className={`ob-chip${role === id ? ' on' : ''}`} onClick={() => setRole(id)} aria-pressed={role === id}>
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="ob-section">
          <h2 className="ob-label">Interests <span className="ob-optional">pick any</span></h2>
          <div className="ob-chips">
            {ALL_INTERESTS.map((t) => (
              <button key={t} className={`ob-chip${interests.includes(t) ? ' on' : ''}`} onClick={() => toggle(t)} aria-pressed={interests.includes(t)}>
                {CAT_LABELS[t] || t}
              </button>
            ))}
          </div>
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
`;
