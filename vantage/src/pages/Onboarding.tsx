import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, Terminal, PenTool, Rocket, Compass, TrendingUp, BookOpen } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ROLES, GOALS, INTERESTS, type Role, type Goal } from '../lib/types';
import { BRAND } from '../lib/brand';
import { Mark } from '../components/Logo';

const roleIcons: Record<Role, typeof Terminal> = {
  engineer: Terminal,
  designer: PenTool,
  founder: Rocket,
  pm: Compass,
  investor: TrendingUp,
  student: BookOpen,
};

const TOTAL = 4;

export default function Onboarding() {
  const nav = useNavigate();
  const { signIn, updateProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | undefined>();
  const [goal, setGoal] = useState<Goal | undefined>();
  const [interests, setInterests] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const canNext =
    (step === 1 && role) || (step === 2 && goal) || step === 3 || (step === 4 && email.includes('@'));

  const next = () => {
    if (step < TOTAL) return setStep((s) => s + 1);
    updateProfile({ role, goal, interests, name });
    signIn(email, name);
    nav('/welcome');
  };

  const toggleInterest = (t: string) =>
    setInterests((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className="dawn min-h-[calc(100vh-4rem)]">
      <div className="container-x max-w-2xl py-10 md:py-16">
        {/* progress */}
        <div className="mb-10 flex items-center gap-3">
          <Mark size={28} />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${(step / TOTAL) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs text-muted tabular-nums">
            {step}/{TOTAL}
          </span>
        </div>

        {step === 1 && (
          <Step title="What do you do?" sub="So the brief speaks your language. Pick the closest.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ROLES.map((r) => {
                const Icon = roleIcons[r.id];
                const active = role === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={`flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition ${
                      active ? 'border-accent bg-accent-soft/50 shadow-soft' : 'border-line bg-surface hover:border-ink/25'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        active ? 'bg-accent text-white' : 'bg-bg text-ink'
                      }`}
                    >
                      <Icon size={19} />
                    </span>
                    <span className="text-[15px] font-semibold">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title="What are you really after?" sub="This is the difference between news and a brief that’s useful to you.">
            <div className="grid gap-3">
              {GOALS.map((g) => {
                const active = goal === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`flex items-center justify-between gap-4 rounded-2xl border p-4 text-left transition ${
                      active ? 'border-accent bg-accent-soft/50 shadow-soft' : 'border-line bg-surface hover:border-ink/25'
                    }`}
                  >
                    <span>
                      <span className="block text-[15px] font-semibold">{g.label}</span>
                      <span className="mt-0.5 block text-[13.5px] text-muted">{g.sub}</span>
                    </span>
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                        active ? 'border-accent bg-accent text-white' : 'border-line'
                      }`}
                    >
                      {active && <Check size={14} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step title="Anything you especially care about?" sub="Optional — nudge the mix. You can change this anytime.">
            <div className="flex flex-wrap gap-2.5">
              {INTERESTS.map((t) => {
                const active = interests.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleInterest(t)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      active
                        ? 'border-accent bg-accent text-white'
                        : 'border-line bg-surface text-ink hover:border-ink/25'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {step === 4 && (
          <Step title="Where should your first brief land?" sub="We’ll send tomorrow’s brief here. No card needed to start.">
            <div className="grid gap-3">
              <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              <input
                className="input"
                type="email"
                placeholder="you@work.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted">
                By continuing you agree to get a daily brief from {BRAND.name}. Unsubscribe anytime.
              </p>
            </div>
          </Step>
        )}

        <div className="mt-8 flex items-center justify-between">
          {step > 1 ? (
            <button className="btn-ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <span />
          )}
          <button className="btn-primary btn-lg disabled:opacity-40" disabled={!canNext} onClick={next}>
            {step === TOTAL ? 'Build my brief' : step === 3 ? 'Continue' : 'Next'} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="animate-rise">
      <h1 className="h-display text-[1.8rem] leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-[15px] text-muted">{sub}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}
