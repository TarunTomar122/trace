import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Copy, Check, Podcast, Mail } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { BRAND } from '../lib/brand';
import { Waveform } from '../components/Waveform';
import { ROLES, GOALS } from '../lib/types';

export default function Welcome() {
  const { profile, user } = useAuth();
  const [copied, setCopied] = useState(false);
  const feedUrl = `https://${BRAND.domain}/feed/${(user?.email || 'you').split('@')[0]}.xml`;
  const roleLabel = ROLES.find((r) => r.id === profile.role)?.label;
  const goalLabel = GOALS.find((g) => g.id === profile.goal)?.label?.toLowerCase();

  const copy = () => {
    navigator.clipboard?.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="dawn grid min-h-[calc(100vh-4rem)] place-items-center px-5 py-14">
      <div className="w-full max-w-lg text-center">
        <Waveform bars={20} className="mx-auto mb-6 h-9" />
        <h1 className="h-display text-3xl leading-tight sm:text-4xl">You’re in{profile.name ? `, ${profile.name}` : ''}.</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-muted">
          {roleLabel && goalLabel ? (
            <>Your briefs are now tuned for a <span className="font-medium text-ink">{roleLabel.toLowerCase()}</span> who wants to <span className="font-medium text-ink">{goalLabel}</span>. The first one lands tomorrow morning — but today’s is ready now.</>
          ) : (
            <>Your first brief is ready now, and a fresh one lands every morning.</>
          )}
        </p>

        <Link to="/today" className="btn-primary btn-lg mx-auto mt-7">
          Hear today’s brief <ArrowRight size={18} />
        </Link>

        <div className="card mt-8 text-left">
          <p className="text-[13px] font-semibold text-ink">Get it where you already listen</p>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-bg p-3">
            <Podcast size={18} className="shrink-0 text-accent" />
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{feedUrl}</code>
            <button className="btn-secondary shrink-0 px-3 py-1.5 text-xs" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
            <Mail size={15} /> We’ll also email tomorrow’s brief to {user?.email || 'your inbox'}.
          </p>
        </div>
      </div>
    </div>
  );
}
