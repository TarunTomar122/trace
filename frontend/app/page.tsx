"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Clock3, Mail, Newspaper, Zap, Layers, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/* ─── scroll-reveal utility ─── */

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.65s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.65s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── page ─── */

export default function LandingPage() {
  const router = useRouter();
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const isOnboarded = !!user && !!profile?.onboarded;
  const handleStartReading = () => signInWithGoogle('read');
  const handleStartTrial = () => signInWithGoogle('checkout');

  useEffect(() => {
    if (!loading && user) {
      router.replace(isOnboarded ? '/feed' : '/onboarding');
    }
  }, [user, loading, isOnboarded, router]);

  if (loading || user) {
    return (
      <div className="min-h-screen bg-[#f4efe7] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4efe7] text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#f4efe7]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <img src="/trace.webp" alt="Trace" className="h-6 w-auto" />
            <span className="text-sm font-semibold tracking-[0.18em]">TRACE</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/trending"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-secondary transition-colors hover:text-foreground sm:inline-flex"
            >
              Sample topics
            </Link>
            <button
              onClick={handleStartReading}
              className="rounded-full bg-[#151515] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-black hover:shadow-lg hover:shadow-black/10"
            >
              Sign in
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20 lg:pt-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="max-w-2xl">
              <Reveal>
                <div className="inline-flex items-center gap-2.5 rounded-full border border-black/8 bg-white/80 backdrop-blur-sm px-4 py-2.5 text-[13px] font-medium text-secondary shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Tech news, without the tab chaos
                </div>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-7 text-[3.25rem] font-bold leading-[0.92] tracking-[-0.045em] sm:text-[4.25rem] lg:text-[5rem]">
                  Stop checking<br />
                  10 apps every<br />
                  <span className="text-[#151515]/30">morning.</span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mt-7 max-w-lg text-[17px] leading-[1.7] text-secondary">
                  Trace reads the sources, groups coverage into topics, and hands you a short daily brief with only the links worth opening.
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    onClick={handleStartReading}
                    className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-[#151515] px-7 py-4 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all hover:bg-black hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    See today&apos;s topics
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    onClick={handleStartTrial}
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 backdrop-blur-sm px-7 py-4 text-[15px] font-semibold transition-all hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Start 3-day free trial
                  </button>
                </div>
              </Reveal>

              <Reveal delay={320}>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-secondary">
                  <span className="flex items-center gap-2">
                    <Check size={15} className="text-emerald-600" />
                    No credit card needed
                  </span>
                  <span className="flex items-center gap-2">
                    <Check size={15} className="text-emerald-600" />
                    200+ daily readers
                  </span>
                </div>
              </Reveal>
            </div>

            <Reveal delay={200}>
              <div className="animate-float">
                <HeroBriefCard />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-6xl">
              <div className="grid grid-cols-3 divide-x divide-black/6 rounded-2xl border border-black/6 bg-white/60 backdrop-blur-sm">
                <StatCard value="20+" label="topics in a full Pro day" />
                <StatCard value="2 min" label="to understand one major story" />
                <StatCard value="200+" label="people reading with Trace" />
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Sources ── */}
        <section className="px-4 pt-16 sm:px-6 sm:pt-24">
          <Reveal>
            <div className="mx-auto max-w-6xl text-center">
              <p className="text-[11px] uppercase tracking-[0.3em] text-secondary/40">
                Sources we pull from every day
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2.5">
                {['TechCrunch', 'The Verge', 'Ars Technica', 'Wired', '9to5Google', 'Reuters', 'Bloomberg', 'Hacker News', 'The Information'].map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-black/6 bg-white/50 px-3.5 py-1.5 text-[13px] font-medium text-secondary/55 transition-colors hover:text-secondary hover:bg-white/80"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Value Props ── */}
        <section className="px-4 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">
            {[
              { icon: Layers, title: 'Grouped by topic', desc: 'Five scattered links become one clean briefing instead of a dozen open tabs.' },
              { icon: Zap, title: 'Summarized to the point', desc: 'You get the core update, the real implications, and the links worth opening.' },
              { icon: BookOpen, title: 'Built for daily use', desc: 'Fast enough for a commute, clear enough that you actually retain what happened.' },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 100}>
                <ProofCard icon={card.icon} title={card.title} description={card.desc} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── How It Works + Pricing ── */}
        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Reveal>
              <div className="h-full rounded-[28px] border border-black/6 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-10">
                <p className="text-[11px] uppercase tracking-[0.24em] text-secondary/40">How Trace works</p>
                <div className="mt-8 grid gap-4">
                  <FeatureCard number="01" title="Pick what you care about" description="AI, tech, startups, markets, engineering, product and design, or marketing." />
                  <FeatureCard number="02" title="We collapse the noise" description="Related coverage is grouped into one topic, so you understand the story before you open any link." />
                  <FeatureCard number="03" title="Read only what is worth it" description="Start with the briefing, then open the original source only when you want the deeper take." />
                </div>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="h-full rounded-[28px] bg-[#151515] p-8 text-white shadow-[0_32px_80px_rgba(15,15,15,0.2)] sm:p-10">
                <div className="flex flex-col gap-6 lg:flex-row">
                  <PricingCard
                    tone="dark"
                    label="Free"
                    price="Try it"
                    sublabel="A lightweight daily skim"
                    items={[
                      '3 topic briefings per day',
                      'Summaries, key points, and timelines',
                      'Daily newsletter access',
                    ]}
                    actionLabel="Start free"
                    onClick={handleStartReading}
                  />
                  <PricingCard
                    tone="light"
                    label="Pro"
                    price="$2.99"
                    sublabel="per month, after 3-day trial"
                    items={[
                      'Full daily topic feed',
                      'Unlimited topic briefings',
                      'A much cleaner habit than doomscrolling',
                    ]}
                    actionLabel="Start free trial"
                    onClick={handleStartTrial}
                    popular
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Topic Preview ── */}
        <section className="px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-6xl rounded-[28px] border border-black/6 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-10">
              <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-secondary/40">What you actually read</p>
                  <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-[2.5rem] sm:leading-[1.1]">
                    One topic, one view, enough context to move on.
                  </h2>
                  <p className="mt-5 max-w-lg text-[15px] leading-[1.75] text-secondary">
                    Instead of scanning TechCrunch, The Verge, X, newsletters, and Reddit separately, you get one readable topic page that shows the summary, the key developments, and the source trail.
                  </p>
                </div>
                <TopicPreviewCard />
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── CTA Banner ── */}
        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[32px] bg-[#151515] px-8 py-16 text-center text-white sm:px-16 sm:py-20">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.12),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(255,214,102,0.08),transparent_50%)]" />
              <div className="relative">
                <h2 className="text-3xl font-bold tracking-[-0.03em] sm:text-5xl sm:leading-[1.1]">
                  Catch up in 2&nbsp;minutes,<br className="hidden sm:block" />
                  not&nbsp;20.
                </h2>
                <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-white/50">
                  Join hundreds of readers who replaced their morning tab chaos with one clean daily brief.
                </p>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    onClick={handleStartReading}
                    className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-7 py-4 text-[15px] font-semibold text-[#151515] transition-all hover:shadow-[0_8px_30px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    See today&apos;s topics
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    onClick={handleStartTrial}
                    className="inline-flex items-center justify-center rounded-full border border-white/15 px-7 py-4 text-[15px] font-semibold text-white transition-all hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Start 3-day free trial
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Android ── */}
        <section className="px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-4xl">
              <div className="flex flex-col items-start justify-between gap-6 rounded-[24px] border border-black/6 bg-white p-6 sm:flex-row sm:items-center sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#151515] text-white">
                    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.523 2.246a.75.75 0 0 0-1.046.177l-1.745 2.444a8.503 8.503 0 0 0-5.464 0L7.523 2.423a.75.75 0 1 0-1.223.869l1.56 2.184A8.472 8.472 0 0 0 3.5 12.5v.5a.5.5 0 0 0 .5.5h16a.5.5 0 0 0 .5-.5v-.5a8.472 8.472 0 0 0-4.36-7.024l1.56-2.184a.75.75 0 0 0-.177-1.046zM8.5 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM4 14.5a.5.5 0 0 0-.5.5v5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5a.5.5 0 0 0-.5-.5H4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Trace is on Android</h3>
                    <p className="text-sm text-secondary">Read your daily brief on the go.</p>
                  </div>
                </div>
                <a
                  href="https://play.google.com/store/apps/details?id=online.yourtrace.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#151515] px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black hover:shadow-lg hover:shadow-black/10"
                >
                  Get on Google Play
                </a>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Newsletter ── */}
        <section className="px-4 pt-8 pb-16 sm:px-6 sm:pt-10 sm:pb-24">
          <Reveal>
            <div className="mx-auto max-w-4xl rounded-[24px] border border-black/6 bg-white p-8 sm:p-12">
              <NewsletterSignup />
            </div>
          </Reveal>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-black/4 px-4 py-8 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <img src="/trace.webp" alt="Trace" className="h-5 w-auto" />
              <span className="text-xs font-semibold tracking-[0.16em] text-secondary">TRACE</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-secondary">
              <Link href="/privacy-policy" className="transition-colors hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
              <Link href="/contact" className="transition-colors hover:text-foreground">Contact</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ─── sub-components ─── */

function HeroBriefCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#151515] p-5 text-white shadow-[0_32px_80px_rgba(15,15,15,0.25)] sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Live briefing</p>
          </div>
          <h2 className="mt-3 max-w-[280px] text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em] sm:max-w-sm sm:text-[1.75rem]">
            Google turns Maps into an AI navigation product
          </h2>
        </div>
        <div className="shrink-0 rounded-lg bg-white/8 px-3 py-2 text-right">
          <div className="text-lg font-bold leading-none">5</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/35">sources</div>
        </div>
      </div>

      {/* Summary */}
      <div className="pb-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Summary</p>
        <p className="mt-2 text-[15px] leading-[1.7] text-white/85">
          Google is bundling Gemini answers, immersive route views, and richer driver context into one broader shift toward conversational navigation.
        </p>
      </div>

      {/* Why it matters */}
      <div className="rounded-xl bg-[#f4efe7] p-4 text-[#151515]">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#151515]/35">Why it matters</p>
        <div className="mt-2.5 space-y-2">
          {[
            'Ask Maps uses Gemini to answer route questions instead of forcing a manual search loop.',
            'Coverage from TechCrunch, The Verge, and 9to5Google is stitched into one readable story.',
            'You decide quickly which original sources are actually worth opening.',
          ].map((text, i) => (
            <p key={i} className="text-[13px] leading-[1.65] text-[#151515]/75">
              <span className="mr-1.5 font-mono text-[11px] text-[#151515]/30">{String(i + 1).padStart(2, '0')}</span>
              {text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-5 text-center sm:px-6">
      <div className="text-2xl font-bold tracking-[-0.04em] sm:text-3xl">{value}</div>
      <p className="mt-1 text-xs leading-5 text-secondary sm:text-sm">{label}</p>
    </div>
  );
}

function ProofCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="h-full rounded-[24px] border border-black/6 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#f7f3eb]">
        <Icon size={20} />
      </div>
      <h3 className="text-lg font-semibold tracking-[-0.02em]">{title}</h3>
      <p className="mt-3 text-[15px] leading-[1.75] text-secondary">{description}</p>
    </div>
  );
}

function FeatureCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="rounded-[22px] bg-[#f7f3eb] p-5 transition-colors hover:bg-[#f0ebe0]">
      <div className="mb-2 font-mono text-xs text-secondary/35">{number}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-secondary">{description}</p>
    </div>
  );
}

function PricingCard({
  tone,
  label,
  price,
  sublabel,
  items,
  actionLabel,
  onClick,
  popular,
}: {
  tone: 'dark' | 'light';
  label: string;
  price: string;
  sublabel: string;
  items: string[];
  actionLabel: string;
  onClick: () => void;
  popular?: boolean;
}) {
  const isDark = tone === 'dark';

  return (
    <div className={`flex-1 rounded-[24px] p-6 ${isDark ? 'bg-white/5' : 'bg-[#f4efe7] text-[#151515]'}`}>
      {popular && (
        <div className="mb-3 inline-flex rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-400">
          Most popular
        </div>
      )}
      <p className={`text-sm font-medium ${isDark ? 'text-white/60' : 'text-[#151515]/55'}`}>{label}</p>
      <div className="mt-4 text-4xl font-bold tracking-[-0.03em]">{price}</div>
      <p className={`mt-2 text-sm ${isDark ? 'text-white/50' : 'text-[#151515]/50'}`}>{sublabel}</p>
      <ul className={`mt-6 space-y-3 text-sm ${isDark ? 'text-white/70' : 'text-[#151515]/70'}`}>
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2.5">
            <Check size={14} className="shrink-0" />
            {item}
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        className={`mt-8 w-full rounded-full px-4 py-3.5 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${
          isDark
            ? 'bg-white/12 text-white hover:bg-white/18'
            : 'bg-[#151515] text-white hover:bg-black hover:shadow-lg hover:shadow-black/10'
        }`}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function TopicPreviewCard() {
  return (
    <div className="rounded-[24px] border border-black/6 bg-[#f7f3eb] p-5">
      <div className="flex items-center justify-between border-b border-black/8 pb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-secondary/40">Sample topic</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            Anthropic launches a more capable Claude
          </h3>
        </div>
        <div className="rounded-2xl bg-white px-3 py-2 text-right">
          <div className="text-lg font-semibold">6</div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-secondary/40">sources</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[20px] bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-secondary/40">
            <Newspaper size={13} />
            Brief
          </div>
          <p className="mt-3 text-sm leading-7 text-secondary">
            Anthropic is pushing Claude higher up the stack, with better reasoning, longer-context workflows, and a clearer play for enterprise teams that want AI integrated into real work.
          </p>
        </div>

        <div className="rounded-[20px] bg-[#151515] p-4 text-white">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/40">
            <Clock3 size={13} />
            Key points
          </div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-white/75">
            <p>01. Coverage from several outlets is merged into one storyline.</p>
            <p>02. You see the big move first, then the details that matter.</p>
            <p>03. Original links stay there when you want deeper reporting.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage(data.message || "You're in! Check your inbox soon.");
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong.');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Try again.');
    }
  };

  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7f3eb]">
        <Mail size={22} className="text-secondary/50" />
      </div>
      <h2 className="text-2xl font-bold tracking-[-0.03em]">Get the daily brief</h2>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-secondary">
        One short email with the biggest tech topics of the day, already grouped and summarized.
      </p>

      {status === 'success' ? (
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#f7f3eb] px-4 py-2.5">
          <Check size={16} className="text-emerald-600" />
          <span className="text-sm font-medium">{message}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
            placeholder="your@email.com"
            required
            className="flex-1 rounded-full border border-black/8 bg-[#f7f3eb] px-5 py-3.5 text-sm text-foreground placeholder:text-secondary/35 focus:outline-none focus:ring-2 focus:ring-foreground/15"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="rounded-full bg-[#151515] px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black hover:shadow-lg hover:shadow-black/10 disabled:opacity-50"
          >
            {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
          </button>
        </form>
      )}

      {status === 'error' && <p className="mt-3 text-xs text-red-500">{message}</p>}
    </div>
  );
}
