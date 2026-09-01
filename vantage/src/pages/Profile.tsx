import { Podcast, Mail, MessageCircle, Headphones, Check, ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ROLES, GOALS, INTERESTS, type Role, type Goal } from '../lib/types';
import { BRAND } from '../lib/brand';
import { startCheckout } from '../lib/checkout';

const paces = [
  { id: 'relaxed', label: 'Relaxed' },
  { id: 'natural', label: 'Natural' },
  { id: 'brisk', label: 'Brisk' },
] as const;

const channels = [
  { key: 'podcast', icon: Podcast, label: 'Podcast feed', sub: 'Apple, Spotify, Overcast' },
  { key: 'email', icon: Mail, label: 'Email', sub: 'A morning note with the play link' },
  { key: 'app', icon: Headphones, label: 'In the app', sub: 'Listen right here' },
  { key: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', sub: 'Voice note — optional' },
] as const;

export default function Profile() {
  const { user, profile, subscribed, subscribe, updateProfile } = useAuth();

  const toggleInterest = (t: string) =>
    updateProfile({
      interests: profile.interests.includes(t)
        ? profile.interests.filter((x) => x !== t)
        : [...profile.interests, t],
    });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="h-display text-[1.8rem] leading-tight sm:text-4xl">Your profile</h1>
      <p className="mt-1.5 text-[14.5px] text-muted">{user?.email} · this is what tunes your brief.</p>

      {/* Membership */}
      <Section title="Membership">
        {subscribed ? (
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[14.5px] font-medium">
              <Check size={18} className="text-accent" /> Active — ${BRAND.priceMonthly}/month
            </p>
            <button className="btn-ghost" onClick={() => updateProfile({})}>Manage</button>
          </div>
        ) : (
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-[14.5px] text-muted">Free — one sample brief. Go daily for ${BRAND.priceMonthly}/mo.</p>
            <button className="btn-primary" onClick={() => startCheckout(subscribe)}>
              Upgrade <ArrowRight size={16} />
            </button>
          </div>
        )}
      </Section>

      {/* Role */}
      <Section title="What you do">
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <Chip key={r.id} active={profile.role === r.id} onClick={() => updateProfile({ role: r.id as Role })}>
              {r.label}
            </Chip>
          ))}
        </div>
      </Section>

      {/* Goal */}
      <Section title="What you’re after">
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <Chip key={g.id} active={profile.goal === g.id} onClick={() => updateProfile({ goal: g.id as Goal })}>
              {g.label}
            </Chip>
          ))}
        </div>
      </Section>

      {/* Interests */}
      <Section title="Topics you care about">
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((t) => (
            <Chip key={t} active={profile.interests.includes(t)} onClick={() => toggleInterest(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </Section>

      {/* Pace */}
      <Section title="Voice pace">
        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {paces.map((p) => (
            <button
              key={p.id}
              onClick={() => updateProfile({ pace: p.id })}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                profile.pace === p.id ? 'bg-accent text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Delivery */}
      <Section title="Where to send it">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {channels.map((c) => {
            const on = profile.delivery[c.key as keyof typeof profile.delivery];
            return (
              <button
                key={c.key}
                onClick={() => updateProfile({ delivery: { ...profile.delivery, [c.key]: !on } })}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition ${
                  on ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface hover:border-ink/20'
                }`}
              >
                <c.icon size={18} className={on ? 'text-accent-dark' : 'text-muted'} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">{c.label}</span>
                  <span className="block text-[12.5px] text-muted">{c.sub}</span>
                </span>
                <span className={`grid h-5 w-5 place-items-center rounded-full border ${on ? 'border-accent bg-accent text-white' : 'border-line'}`}>
                  {on && <Check size={12} />}
                </span>
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card mt-4">
      <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-ink hover:border-ink/25'
      }`}
    >
      {children}
    </button>
  );
}
