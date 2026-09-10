'use client';

import { FormEvent, useEffect, useState } from 'react';
import styles from './control-plane.module.css';

type FunnelRow = { key: string; label: string; value: number; rate: number | null };
type Summary = {
  generatedAt: string;
  periodDays: number;
  configured: { posthog: boolean; localdb: boolean };
  warnings: string[];
  northStar: { name: string; value: number; unit: string };
  funnel: FunnelRow[];
  daily: Array<{ date: string; visitors: number; pageviews: number }>;
  experiments: Array<{ id: string; name?: string; hypothesis?: string; status?: string; metric?: string; variants?: Array<{ name: string; allocation?: number }> }>;
  retention: { d1: number | null; d7: number | null; d21: number | null; note: string };
};

const numberFormat = new Intl.NumberFormat('en-US');

export default function ControlPlanePage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  async function loadSummary() {
    setLoading(true);
    setLoadError('');
    const response = await fetch('/api/control-plane/summary?days=28', { cache: 'no-store' });
    if (response.status === 401) {
      setAuthenticated(false);
      setSummary(null);
      setLoading(false);
      return;
    }
    if (!response.ok) {
      setLoadError('The control plane could not load its data.');
      setLoading(false);
      return;
    }
    setSummary(await response.json() as Summary);
    setAuthenticated(true);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSummary(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const interval = window.setInterval(() => { void loadSummary(); }, 15 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [authenticated]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    const response = await fetch('/api/control-plane/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      setLoginError(body.error || 'Could not sign in.');
      return;
    }
    setPassword('');
    setAuthenticated(true);
    await loadSummary();
  }

  async function logout() {
    await fetch('/api/control-plane/auth', { method: 'DELETE' });
    setAuthenticated(false);
    setSummary(null);
  }

  if (!authenticated) {
    return (
      <main className={styles.loginShell}>
        <div className={styles.loginCard}>
          <div className={styles.eyebrow}>TRACE / CONTROL PLANE</div>
          <h1>What is working?</h1>
          <p>Private operating notes for the product loop: sign up, read, return, subscribe.</p>
          <form onSubmit={login} className={styles.loginForm}>
            <label htmlFor="control-plane-password">Password</label>
            <input id="control-plane-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus />
            <button type="submit">Open the room</button>
          </form>
          {loginError && <p className={styles.error}>{loginError}</p>}
        </div>
      </main>
    );
  }

  if (loading && !summary) return <main className={styles.shell}><div className={styles.loading}>Reading the instrument panel…</div></main>;
  if (!summary) return <main className={styles.shell}><div className={styles.error}>{loadError || 'No data yet.'}</div></main>;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div><div className={styles.eyebrow}>TRACE / CONTROL PLANE</div><h1>The product loop</h1><p>Is Trace earning a place in someone’s day?</p></div>
        <div className={styles.headerActions}><span>Updated {new Date(summary.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><button onClick={() => void loadSummary()} className={styles.refresh}>Refresh</button><button onClick={() => void logout()} className={styles.logout}>Lock</button></div>
      </header>

      {summary.warnings.length > 0 && <section className={styles.notice}><strong>Needs wiring</strong><span>{summary.warnings.join(' ')}</span></section>}

      <section className={styles.heroMetric}>
        <div><div className={styles.label}>NORTH STAR</div><h2>{summary.northStar.name}</h2><p>Unique users in the last {summary.periodDays} days</p></div>
        <div className={styles.bigNumber}>{numberFormat.format(summary.northStar.value)}</div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}><div><div className={styles.label}>FUNNEL</div><h2>Where the loop loses people</h2></div><span>Last {summary.periodDays} days</span></div>
        <div className={styles.funnel}>
          {summary.funnel.map((step, index) => <div className={styles.funnelRow} key={step.key}><div className={styles.funnelIndex}>0{index + 1}</div><div className={styles.funnelName}>{step.label}</div><div className={styles.funnelValue}>{numberFormat.format(step.value)}</div><div className={styles.funnelRate}>{step.rate === null ? '—' : `${step.rate}% from previous`}</div></div>)}
        </div>
      </section>

      <section className={styles.twoColumn}>
        <div className={styles.section}><div className={styles.sectionHeading}><div><div className={styles.label}>RETURNING</div><h2>Habit signal</h2></div></div><div className={styles.retentionGrid}>{[['D1', summary.retention.d1], ['D7', summary.retention.d7], ['D21', summary.retention.d21]].map(([label, value]) => <div className={styles.retentionCard} key={String(label)}><span>{label}</span><strong>{value === null ? '—' : `${value}%`}</strong></div>)}</div><p className={styles.muted}>{summary.retention.note}</p></div>
        <div className={styles.section}><div className={styles.sectionHeading}><div><div className={styles.label}>EXPERIMENTS</div><h2>What is being tried</h2></div></div>{summary.experiments.length === 0 ? <div className={styles.empty}>No experiment records yet. The first experiment will appear here with its hypothesis, cohort, baseline, and decision.</div> : <div className={styles.experimentList}>{summary.experiments.map((experiment) => <article key={experiment.id} className={styles.experiment}><div className={styles.experimentTop}><strong>{experiment.name || experiment.id}</strong><span>{experiment.status || 'draft'}</span></div><p>{experiment.hypothesis || 'No hypothesis recorded.'}</p><small>{experiment.metric || 'Metric not defined'}</small></article>)}</div>}</div>
      </section>

      <footer className={styles.footer}>The control plane reports what the instrumentation can prove. Interpretation comes after the baseline is trustworthy.</footer>
    </main>
  );
}
