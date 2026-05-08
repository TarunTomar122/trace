"use client";

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ExternalLink, Mail, Newspaper, MessagesSquare, Rocket, type LucideIcon } from 'lucide-react';
import { consumePendingPostAuthIntent, getPostAuthDestination, useAuth } from '@/contexts/AuthContext';
import { trackLandingCTAClicked } from '@/lib/posthog';

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

const reviewStrongClass = 'font-semibold text-foreground/90';

function ReviewQuoteBody({ parts }: { parts: readonly { text: string; strong?: boolean }[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.strong ? (
          <strong key={i} className={reviewStrongClass}>
            {p.text}
          </strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/* ─── page ─── */

const HeroPulsePreview = dynamic(() => import('./HeroPulsePreview'), {
  loading: () => (
    <div className="relative overflow-hidden rounded-2xl border border-border/15 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/4">
      <div className="h-[min(28rem,75vh)] animate-pulse bg-gradient-to-br from-[#f5f1e8] via-white to-[#f3efe7]" />
    </div>
  ),
});

const INDIA_PRICING_PREVIEW = {
  trialDays: 1,
  priceDisplay: '₹19/month',
  pricingOffer: 'india' as const,
};

const DEFAULT_PRICING_PREVIEW = {
  trialDays: 3,
  priceDisplay: '$2.99/month',
  pricingOffer: 'default' as const,
};

function guessClientPricingPreview() {
  if (typeof window === 'undefined') return DEFAULT_PRICING_PREVIEW;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Kolkata') return INDIA_PRICING_PREVIEW;
    const lang = (navigator.language || '').toLowerCase();
    if (lang === 'en-in' || lang.endsWith('-in')) return INDIA_PRICING_PREVIEW;
  } catch {
    // fall through to default
  }
  return DEFAULT_PRICING_PREVIEW;
}

export default function LandingPageClient() {
  const router = useRouter();
  const { user, profile, loading, profileResolved, signInWithGoogle } = useAuth();
  const googlePlayUrl = "/api/affiliate/outbound?target=android_app&next=" + encodeURIComponent("https://play.google.com/store/apps/details?id=online.yourtrace.app");

  const handleAuthStart = async (intent: 'read' | 'checkout') => {
    const result = await signInWithGoogle(intent);
    if (result.status === 'success') {
      router.push(getPostAuthDestination(result.profile, result.intent));
    }
  };

  useEffect(() => {
    if (loading || !user || !profileResolved) return;
    const pendingIntent = consumePendingPostAuthIntent();
    router.replace(getPostAuthDestination(profile, pendingIntent || 'read'));
  }, [user, loading, profileResolved, profile, router]);

  const handleStartReading = (location = 'hero') => {
    trackLandingCTAClicked('read', location);
    router.push('/feed');
  };

  const handleStartTrial = (location = 'hero') => {
    trackLandingCTAClicked('trial', location);
    if (user && profileResolved) {
      router.push(getPostAuthDestination(profile, 'checkout'));
    } else {
      router.push('/onboarding?intent=checkout');
    }
  };

  const pricingPreview = guessClientPricingPreview();
  const trialDays = pricingPreview.trialDays;
  const priceDisplay = pricingPreview.priceDisplay;
  const planName = pricingPreview.pricingOffer === 'india'
    ? 'Trace Pro India'
    : 'Trace Pro';

  if (loading || (user && !profileResolved)) {
    return (
      <div className="min-h-screen bg-[#f4efe7] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-[#f4efe7] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4efe7] text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#f4efe7]/80 backdrop-blur-xl border-b border-black/[0.04]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <img src="/trace.webp" alt="Trace" className="h-5 w-auto" />
            <span className="text-[13px] font-semibold tracking-[0.2em]">TRACE</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/trending"
              className="rounded-full px-4 py-1.5 text-[13px] text-secondary/70 transition-colors hover:text-foreground"
            >
              Trending
            </Link>
            <Link
              href="/daily"
              className="rounded-full px-4 py-1.5 text-[13px] text-secondary/70 transition-colors hover:text-foreground"
            >
              Daily
            </Link>
            <Link
              href="/blog"
              className="rounded-full px-4 py-1.5 text-[13px] text-secondary/70 transition-colors hover:text-foreground"
            >
              Research
            </Link>
            <div className="ml-3 h-4 w-px bg-black/8" />
          </nav>
          <button
            onClick={() => void handleAuthStart('read')}
            className="rounded-full bg-[#151515] px-5 py-2 text-[13px] font-semibold text-white transition-all hover:bg-black hover:shadow-lg hover:shadow-black/10"
          >
            Sign in
          </button>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24 lg:pt-32">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:px-8">
            <div className="max-w-2xl">
              <Reveal>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/50">
                  The daily brief: AI + tech
                </p>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-6 text-[3rem] font-bold leading-[0.95] tracking-[-0.04em] sm:text-[4rem] lg:text-[4.75rem]">
                  What changed<br />
                  in AI + tech<br />
                  <span className="text-foreground/25">since yesterday.</span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mt-8 max-w-md text-[16px] leading-[1.8] text-secondary">
                  Something big moves every day. Trace is one feed for the top stories, the real discussion, and what launched—so you can catch up in a few minutes instead of a dozen open tabs.
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    onClick={() => handleStartReading('hero')}
                    className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-[#151515] px-7 py-4 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all hover:bg-black hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Read today
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    onClick={() => handleStartTrial('hero')}
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 backdrop-blur-sm px-7 py-4 text-[15px] font-semibold transition-all hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Start free trial
                  </button>
                </div>
              </Reveal>

              <Reveal delay={320}>
                <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-secondary/60">
                  <span className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-600/70" />
                    No credit card needed
                  </span>
                  <span className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-600/70" />
                    500+ daily readers
                  </span>
                </div>
              </Reveal>
            </div>

            <Reveal delay={200}>
              <div className="animate-float">
                <HeroPulsePreview />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Email Preview + Newsletter ── */}
        <section className="px-4 pt-4 pb-14 sm:px-6 sm:pt-6 sm:pb-20">
          <Reveal>
            <div className="mx-auto max-w-7xl rounded-[24px] border border-black/[0.05] bg-white/80 backdrop-blur-sm p-8 sm:p-10 lg:px-8">
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <NewsletterPreviewCard />
                <NewsletterSignup />
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Social proof quotes ── */}
        <section className="px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-7xl lg:px-8">
              <p className="mb-5 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-secondary/40">
                Notes from people who already read with Trace
              </p>
              <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                {(
                  [
                    {
                      initials: 'MK',
                      name: 'Maya K.',
                      line: 'Backend eng · fintech, SF',
                      parts: [
                        { text: 'AI is changing so fast it’s ' },
                        { text: 'hard to stay up to date', strong: true },
                        { text: '. ' },
                        { text: 'Trace', strong: true },
                        {
                          text: ' helps me get rid of the ',
                        },
                        { text: 'FOMO', strong: true },
                        { text: ' anxiety around it — I can scroll the ' },
                        { text: 'feed', strong: true },
                        { text: ' for like ' },
                        { text: '2 minutes', strong: true },
                        { text: ' in the morning and I’m ready to talk about everything hehe' },
                      ] as const,
                    },
                    {
                      initials: 'JL',
                      name: 'James L.',
                      line: 'Product · growth-stage SaaS',
                      parts: [
                        { text: 'My Slack and group chats are just ' },
                        { text: 'firehoses of links', strong: true },
                        { text: ' I never had time to open. I use ' },
                        { text: 'Trace', strong: true },
                        { text: ' as my actual ' },
                        { text: 'filter', strong: true },
                        { text: ' so I’m not ' },
                        { text: 'nodding along blind in meetings', strong: true },
                        { text: ' anymore lol' },
                      ] as const,
                    },
                    {
                      initials: 'RO',
                      name: 'Rina O.',
                      line: 'Founding eng · devtools',
                      parts: [
                        { text: 'I’m not trying to be on every trend — I just don’t want to feel dumb when someone brings up a ' },
                        { text: 'new model or a launch', strong: true },
                        { text: '. ' },
                        { text: 'Quick skim of the feed', strong: true },
                        { text: ' and I at least have a ' },
                        { text: 'take', strong: true },
                        { text: '. ' },
                        { text: 'Life saver', strong: true },
                        { text: ' honestly' },
                      ] as const,
                    },
                  ] as const
                ).map((t) => (
                  <figure
                    key={t.name}
                    className="flex gap-4 rounded-2xl border border-black/[0.06] bg-white/55 p-5 text-left shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:flex-col sm:p-6"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-tight text-foreground/80 ring-1 ring-black/[0.06] sm:mx-0 sm:h-9 sm:w-9"
                      style={{
                        background:
                          t.initials === 'MK'
                            ? 'linear-gradient(135deg, #e8e4dd 0%, #ddd7cc 100%)'
                            : t.initials === 'JL'
                              ? 'linear-gradient(135deg, #e0e6ee 0%, #d0d8e4 100%)'
                              : 'linear-gradient(135deg, #e4e8e0 0%, #d4dcd4 100%)',
                      }}
                    >
                      {t.initials}
                    </div>
                    <div className="min-w-0">
                      <blockquote className="text-[14px] leading-[1.6] text-foreground/80">
                        <ReviewQuoteBody parts={t.parts} />
                      </blockquote>
                      <figcaption className="mt-4 text-[12px] leading-tight text-secondary/55">
                        <span className="font-medium text-foreground/75">{t.name}</span>
                        <span className="mt-0.5 block text-[11px] text-secondary/45">{t.line}</span>
                      </figcaption>
                    </div>
                  </figure>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Stats ── */}
        <section className="px-4 pt-20 sm:px-6 sm:pt-28">
          <Reveal>
            <div className="mx-auto max-w-7xl lg:px-8">
              <div className="grid grid-cols-3 gap-px rounded-2xl bg-black/[0.04] overflow-hidden">
                {[
                  { value: '50+', label: 'topics in a full Pro day' },
                  { value: '10+', label: 'sources folded into top stories' },
                  { value: '500+', label: 'people reading with Trace' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#f4efe7] px-4 py-8 text-center sm:px-6 sm:py-10">
                    <p className="text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl lg:text-5xl">{stat.value}</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-secondary/50 sm:text-[12px]">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Sources ── */}
        <section className="px-4 pt-20 sm:px-6 sm:pt-28">
          <Reveal>
            <div className="mx-auto max-w-7xl text-center lg:px-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/35">
                Signals we pull from every day
              </p>
              <div className="mx-auto mt-10 max-w-4xl">
                {[
                  {
                    label: 'Stories & reporting',
                    sources: ['TechCrunch', 'The Verge', 'Ars Technica', 'Wired', '9to5Google', 'Reuters', 'Bloomberg', 'Hacker News', 'The Information'],
                  },
                  {
                    label: 'Community pulse',
                    sources: ['Reddit', 'X', 'Bluesky', 'Threads', 'Lemmy', 'Discord', 'Stack Overflow'],
                  },
                  {
                    label: 'Launches & builds',
                    sources: ['Product Hunt', 'Indie Hackers', 'GitHub', 'Show HN', 'BetaList', 'Peerlist', 'Wellfound'],
                  },
                ].map((group, gi) => (
                  <div key={group.label} className={gi > 0 ? 'mt-8' : ''}>
                    <div className="flex items-center gap-4 justify-center mb-4">
                      <div className="h-px flex-1 max-w-16 bg-black/[0.06]" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30">{group.label}</p>
                      <div className="h-px flex-1 max-w-16 bg-black/[0.06]" />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {group.sources.map((s) => (
                        <span
                          key={`${group.label}-${s}`}
                          className="rounded-full border border-black/[0.05] bg-white/40 px-4 py-2 text-[13px] font-medium text-secondary/50 transition-all hover:text-foreground hover:bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── How your pulse works ── */}
        <section className="px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-7xl lg:px-8">
            <Reveal>
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/35">How it works</p>
              <h2 className="mx-auto mt-5 max-w-3xl text-center text-[2rem] font-bold tracking-[-0.035em] sm:text-[2.75rem] sm:leading-[1.08]">
                One pulse. The shape of the day.
              </h2>
              <p className="mx-auto mt-6 max-w-lg text-center text-[15px] leading-[1.8] text-secondary">
                Trace reads the stories, the conversations, and the launches — then gives you one calm, scannable daily briefing.
              </p>
            </Reveal>
            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {[
                {
                  icon: Newspaper,
                  k: 'What happened',
                  body: 'The biggest tech stories grouped from many sources into one readable view, anchored by the day\'s lead story.',
                },
                {
                  icon: MessagesSquare,
                  k: 'What people are saying',
                  body: 'High-signal discussions from HN, Reddit, and the communities that matter to you — not the noise.',
                },
                {
                  icon: Rocket,
                  k: 'What people are building',
                  body: 'Launches, repos, changelogs, and tools — the building signals worth knowing about, shipped today.',
                },
              ].map((item, i) => (
                <Reveal key={item.k} delay={i * 90}>
                  <div className="group h-full rounded-[20px] border border-black/[0.05] bg-white/80 backdrop-blur-sm p-7 transition-all hover:bg-white hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-8">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#151515]/[0.04] text-foreground/60 transition-colors group-hover:bg-[#151515]/[0.07]">
                      <item.icon size={17} />
                    </div>
                    <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/40">{item.k}</p>
                    <p className="mt-3 text-[15px] leading-[1.75] text-secondary">{item.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={200}>
              <p className="mx-auto mt-14 max-w-xl text-center text-[17px] font-medium tracking-[-0.01em] text-foreground/70">
                Open Trace once, get the shape of the day.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── Explore Trace ── */}
        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="mx-auto max-w-7xl lg:px-8">
            <Reveal>
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/35">Explore Trace</p>
              <h2 className="mx-auto mt-5 max-w-3xl text-center text-[2rem] font-bold tracking-[-0.035em] sm:text-[2.75rem] sm:leading-[1.08]">
                Three lenses on<br className="hidden sm:block" />
                the same day in tech.
              </h2>
              <p className="mx-auto mt-6 max-w-lg text-center text-[15px] leading-[1.8] text-secondary">
                Every part of Trace gives you a different angle — browse them freely, no account needed.
              </p>
            </Reveal>
            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {[
                {
                  href: '/trending',
                  label: 'Trending',
                  title: 'What the tech world is talking about right now',
                  body: 'Stories grouped by topic across TechCrunch, Hacker News, The Verge, and more. One page instead of ten tabs.',
                  cta: 'Browse trending topics',
                },
                {
                  href: '/daily',
                  title: 'A daily snapshot you can scroll in two minutes',
                  label: 'Daily Archive',
                  body: 'Every day Trace captures the full picture — stories, discussions, and launches — and archives it so you never miss a day.',
                  cta: 'See daily snapshots',
                },
                {
                  href: '/blog',
                  label: 'Blog',
                  title: 'Guides & insights on smarter tech reading',
                  body: 'Expert guides on tech news aggregation, productivity, and building better information diets.',
                  cta: 'Read the blog',
                },
              ].map((item, i) => (
                <Reveal key={item.href} delay={i * 90}>
                  <Link href={item.href} className="group flex h-full flex-col rounded-[20px] border border-black/[0.05] bg-white/80 backdrop-blur-sm p-7 transition-all hover:bg-white hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-8">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/35">{item.label}</p>
                    <h3 className="mt-3 text-[17px] font-bold tracking-[-0.02em] leading-snug text-foreground">{item.title}</h3>
                    <p className="mt-3 flex-1 text-[14px] leading-[1.7] text-secondary">{item.body}</p>
                    <div className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground/60 transition-colors group-hover:text-foreground">
                      {item.cta}
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trace Pro ── */}
        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <Reveal>
            <div className="mx-auto max-w-2xl overflow-hidden rounded-[28px] bg-[#151515] shadow-[0_32px_80px_rgba(15,15,15,0.25)]">
              <div className="bg-gradient-to-br from-white/[0.04] to-transparent p-8 sm:p-10">
                <p className="text-[11px] font-semibold text-white/25 uppercase tracking-[0.2em] mb-6">{planName}</p>
                <h3 className="text-[1.7rem] font-bold tracking-[-0.03em] leading-[1.1] text-white mb-3 sm:text-[2rem]">
                  Your personal daily<br className="hidden sm:block" />
                  advantage in tech
                </h3>
                <p className="text-[14px] text-white/40 mb-8 leading-[1.7] max-w-md">
                  Deeper context, smarter filtering, and signal over noise — in one daily pulse. Try it free for {trialDays} days.
                </p>
                <div className="space-y-3.5 mb-9">
                  {[
                    'A daily pulse tailored to your role and interests',
                    'Grouped topic pages instead of duplicate links',
                    'Community signal without endless scrolling',
                    'Launches and products worth watching',
                    'A faster way to stay current in tech',
                  ].map((line) => (
                    <div key={line} className="flex items-start gap-3">
                      <Check size={13} className="shrink-0 mt-[3px] text-white/30" strokeWidth={2.5} />
                      <p className="text-[13px] font-medium text-white/75 leading-snug">{line}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleStartTrial('pricing_card')}
                  className="w-full py-3.5 rounded-full text-[13px] font-semibold bg-white text-[#151515] transition-all hover:bg-white/90 hover:scale-[1.01] active:scale-[0.99]"
                >
                  Start {trialDays}-Day Free Trial
                </button>
                <p className="mt-3 text-center text-[12px] leading-snug text-white/35">
                  {priceDisplay} after {trialDays} days · Cancel anytime
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Topic Preview ── */}
        <section className="px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-7xl lg:px-8">
              <div className="rounded-[24px] border border-black/[0.05] bg-white/80 backdrop-blur-sm p-8 sm:p-10">
                <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-secondary/35">Trending (public sample)</p>
                    <h2 className="mt-5 text-[2rem] font-bold tracking-[-0.035em] sm:text-[2.5rem] sm:leading-[1.08]">
                      One lane of a<br className="hidden sm:block" />
                      bigger pulse
                    </h2>
                    <p className="mt-5 max-w-lg text-[15px] leading-[1.8] text-secondary">
                      Trending is one part of Trace. The full product also shows the conversations and launches behind the stories — so you see how the day in tech actually took shape, not just the headlines.
                    </p>
                    <Link
                      href="/trending"
                      className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground transition-colors hover:text-foreground/70"
                    >
                      Browse live trending
                      <ArrowRight size={14} className="text-secondary" />
                    </Link>
                  </div>
                  <TopicPreviewCard />
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Search Intent Links ── */}
        <section className="px-4 pt-16 sm:px-6 sm:pt-20">
          <Reveal>
            <div className="mx-auto max-w-7xl lg:px-8">
              <div className="rounded-[24px] border border-black/[0.05] bg-white/80 backdrop-blur-sm p-8 sm:p-10">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-secondary/35">Popular comparisons</p>
                  <h2 className="mt-5 text-[2rem] font-bold tracking-[-0.035em] sm:text-[2.4rem] sm:leading-[1.08]">
                    Not looking for<br className="hidden sm:block" />
                    &ldquo;more news&rdquo;? Good.
                  </h2>
                  <p className="mt-5 text-[15px] leading-[1.8] text-secondary">
                    Most people searching for a better news setup are really searching for less noise. These pages explain where Trace fits.
                  </p>
                </div>
                <div className="mt-8 grid gap-3 md:grid-cols-3">
                  {[
                    {
                      href: "/compare/feedly-alternative",
                      title: "Feedly alternative",
                      body: "For people who want the story, not another unread queue.",
                    },
                    {
                      href: "/compare/rss-reader-alternative",
                      title: "RSS reader alternative",
                      body: "For people who want fewer tabs and more context.",
                    },
                    {
                      href: "/compare/best-tech-news-app",
                      title: "Best tech news app",
                      body: "For busy readers who want to stay current fast.",
                    },
                    {
                      href: "/compare/hacker-news-digest",
                      title: "Hacker News digest",
                      body: "The signal from HN without refreshing all day.",
                    },
                    {
                      href: "/compare/techmeme-alternative",
                      title: "Techmeme alternative",
                      body: "Headlines plus the conversation and launches behind them.",
                    },
                    {
                      href: "/compare/ai-news-aggregator",
                      title: "AI news aggregator",
                      body: "Papers, products, and debates — grouped into daily context.",
                    },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group rounded-[16px] bg-[#f7f3eb]/80 p-5 transition-all hover:bg-[#f0ebe0] hover:shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
                    >
                      <h3 className="font-semibold text-[15px] tracking-[-0.01em]">{item.title}</h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-secondary">{item.body}</p>
                      <div className="mt-4 text-[13px] font-semibold text-foreground/60 transition-colors group-hover:text-foreground">Read guide →</div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── CTA Banner ── */}
        <section className="px-4 py-20 sm:px-6 sm:py-28">
          <Reveal>
            <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-[#151515] px-8 py-20 text-center text-white sm:px-16 sm:py-24 lg:px-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(255,214,102,0.06),transparent_50%)]" />
              <div className="relative">
                <h2 className="text-[2rem] font-bold tracking-[-0.035em] sm:text-[3.25rem] sm:leading-[1.05]">
                  Stay current without<br className="hidden sm:block" />
                  the tab stack.
                </h2>
                <p className="mx-auto mt-6 max-w-md text-[15px] leading-[1.7] text-white/40">
                  Stories, community signal, and what shipped — one daily pulse instead of ten half-read feeds.
                </p>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    onClick={() => handleStartReading('bottom_cta')}
                    className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-7 py-4 text-[15px] font-semibold text-[#151515] transition-all hover:shadow-[0_8px_30px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Read today
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    onClick={() => handleStartTrial('bottom_cta')}
                    className="inline-flex items-center justify-center rounded-full border border-white/12 px-7 py-4 text-[15px] font-semibold text-white transition-all hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Start free trial
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Android ── */}
        <section className="px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-7xl lg:px-8">
              <div className="flex flex-col items-start justify-between gap-6 rounded-[20px] border border-black/[0.05] bg-white/80 backdrop-blur-sm p-6 sm:flex-row sm:items-center sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#151515] text-white">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.523 2.246a.75.75 0 0 0-1.046.177l-1.745 2.444a8.503 8.503 0 0 0-5.464 0L7.523 2.423a.75.75 0 1 0-1.223.869l1.56 2.184A8.472 8.472 0 0 0 3.5 12.5v.5a.5.5 0 0 0 .5.5h16a.5.5 0 0 0 .5-.5v-.5a8.472 8.472 0 0 0-4.36-7.024l1.56-2.184a.75.75 0 0 0-.177-1.046zM8.5 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM4 14.5a.5.5 0 0 0-.5.5v5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5a.5.5 0 0 0-.5-.5H4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold">Trace is on Android</h3>
                    <p className="text-[13px] text-secondary/60">Read your daily brief on the go.</p>
                  </div>
                </div>
                <a
                  href={googlePlayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#151515] px-6 py-3 text-[13px] font-semibold text-white transition-all hover:bg-black hover:shadow-lg hover:shadow-black/10"
                >
                  Get on Google Play
                </a>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-black/[0.04] px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-7xl lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                <img src="/trace.webp" alt="Trace" className="h-4 w-auto" />
                <span className="text-[11px] font-semibold tracking-[0.18em] text-secondary/50">TRACE</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-secondary/50">
                <Link href="/trending" className="transition-colors hover:text-foreground">Trending</Link>
                <Link href="/daily" className="transition-colors hover:text-foreground">Daily</Link>
                <Link href="/blog" className="transition-colors hover:text-foreground">Blog</Link>
                <Link href="/compare" className="transition-colors hover:text-foreground">Compare</Link>
                <Link href="/privacy-policy" className="transition-colors hover:text-foreground">Privacy</Link>
                <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
                <Link href="/contact" className="transition-colors hover:text-foreground">Contact</Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function TopicPreviewCard() {
  const topics = [
    {
      label: 'AI & Machine Learning',
      story: 'OpenAI, Anthropic, and Google all ship model updates in one week',
      meta: '7 sources · 4 key points · timeline',
    },
    {
      label: 'Developer Tools',
      story: 'Cursor clones arrive, but teams still want workflow-native context',
      meta: '5 sources · product launches · GitHub',
    },
    {
      label: 'Big Tech & Regulation',
      story: 'Apple, DMA, and the new shape of distribution on mobile',
      meta: '6 sources · policy · market reaction',
    },
  ];

  return (
    <div className="rounded-[20px] border border-black/[0.05] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.05)] sm:p-8">
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.05] pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary/35">Trending topics</p>
          <p className="mt-1 text-[13px] text-secondary/60">Grouped stories instead of duplicate tabs.</p>
        </div>
        <Link href="/trending" className="inline-flex items-center gap-1 text-[13px] font-semibold text-foreground/60 transition-colors hover:text-foreground">
          Open <ArrowRight size={13} />
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {topics.map((topic) => (
          <div key={topic.label} className="rounded-[14px] border border-black/[0.04] bg-[#faf8f4] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary/35">{topic.label}</p>
            <p className="mt-2 text-[14px] font-semibold leading-snug text-foreground">{topic.story}</p>
            <p className="mt-1.5 text-[12px] text-secondary/55">{topic.meta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsletterPreviewCard() {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-secondary/35">
        Newsletter preview
      </p>
      <h3 className="mt-4 text-[1.65rem] font-bold tracking-[-0.03em] text-foreground sm:text-[1.9rem]">
        Real Trace daily style
      </h3>
      <p className="mt-3 max-w-md text-[14px] leading-[1.7] text-secondary">
        This mirrors the actual format we send: one subject, short intro, and a numbered set of stories with direct links.
      </p>

      <div className="mt-6 rounded-2xl border border-black/[0.06] bg-[#faf8f4] p-5 sm:p-6">
        <div className="flex items-center gap-3 border-b border-black/[0.05] pb-3">
          <div className="h-8 w-8 rounded-lg bg-[#151515] flex items-center justify-center">
            <img src="/trace.webp" alt="Trace" className="h-4 w-auto invert" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">Trace</p>
            <p className="text-[11px] text-secondary/45">AI Chips, Crypto Scams, and Japan&apos;s Hybrid Takeover</p>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-[12px] leading-[1.65] text-secondary/70">
          <p>
            Today&apos;s mix spans frontier chips, policy ripples, and product bets across AI, markets, and engineering.
          </p>
          <div className="rounded-lg border border-black/[0.05] bg-white/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/35">1. Top story</p>
            <a
              href="https://www.yourtrace.online/articles/tr_example"
              className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-foreground hover:text-foreground/70"
            >
              New model race shifts chip demand
              <ExternalLink size={11} />
            </a>
            <p className="mt-1 text-[11px] text-secondary/60">What happened, why it matters, and where this heads next.</p>
          </div>
          <div className="rounded-lg border border-black/[0.05] bg-white/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/35">2. Signals</p>
            <p className="text-[11px] text-secondary/60">Fast rundown of the next 6-7 links worth your click.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || status === 'loading') return;
    setStatus('loading');
    try {
      const response = await fetch('/api/newsletter-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error('Failed');
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#151515] text-white">
        <Mail size={17} />
      </div>
      <h3 className="mt-4 text-[1.5rem] font-bold tracking-[-0.03em] text-foreground">Get the daily brief by email</h3>
      <p className="mx-auto mt-3 max-w-md text-[14px] leading-[1.7] text-secondary">
        Same Trace signal, delivered every morning. No spam, just the day&apos;s stories, discussions, and launches worth opening.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 px-2 sm:flex-row sm:px-0">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="min-h-12 flex-1 rounded-full border border-black/[0.08] bg-[#faf8f4] px-6 py-3.5 text-[15px] outline-none transition-colors placeholder:text-secondary/35 focus:border-foreground/20 focus:ring-1 focus:ring-foreground/10 sm:text-[14px]"
          autoComplete="email"
          required
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="inline-flex h-12 items-center justify-center rounded-full bg-[#151515] px-6 text-[13px] font-semibold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === 'loading' ? 'Joining...' : 'Join free'}
        </button>
      </form>
      {status === 'success' && <p className="mt-3 text-[13px] text-emerald-700">You&apos;re on the list.</p>}
      {status === 'error' && <p className="mt-3 text-[13px] text-red-600">Could not subscribe right now.</p>}
    </div>
  );
}
