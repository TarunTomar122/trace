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
  priceDisplay: '$4.99/month',
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
    if (user && profileResolved) {
      router.push(getPostAuthDestination(profile, 'read'));
    } else {
      router.push('/onboarding');
    }
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
              Trending
            </Link>
            <Link
              href="/daily"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-secondary transition-colors hover:text-foreground sm:inline-flex"
            >
              Daily
            </Link>
            <Link
              href="/research"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-secondary transition-colors hover:text-foreground sm:inline-flex"
            >
              Research
            </Link>
            <button
              onClick={() => void handleAuthStart('read')}
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
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="max-w-2xl">
              <Reveal>
                <div className="inline-flex items-center gap-2.5 rounded-full border border-black/8 bg-white/80 backdrop-blur-sm px-4 py-2.5 text-[13px] font-medium text-secondary shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Stories, conversations &amp; launches
                </div>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-7 text-[2.65rem] font-bold leading-[0.98] tracking-[-0.045em] sm:text-[3.75rem] lg:text-[4.25rem]">
                  Your daily tech,<br />
                  <span className="text-[#151515]/30">in one place.</span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mt-7 max-w-lg text-[17px] leading-[1.7] text-secondary">
                  Trace brings together the biggest stories, the conversations around them, and the products people are building so you can stay current without bouncing between feeds.
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    onClick={() => handleStartReading('hero')}
                    className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-[#151515] px-7 py-4 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all hover:bg-black hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    See today&apos;s tech pulse
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
                <div className="mt-8 space-y-3">
                  {[
                    { quote: 'Replaced my morning tab routine entirely.', who: 'Senior eng @ fintech startup' },
                    { quote: 'The pulse is the only thing I read before standup now.', who: 'Product lead, Series B' },
                  ].map((t) => (
                    <div key={t.who} className="flex items-start gap-2.5 text-[13px] leading-snug">
                      <span className="mt-0.5 shrink-0 text-secondary/30">&ldquo;</span>
                      <div>
                        <span className="text-secondary/80">{t.quote}</span>
                        <span className="ml-1.5 text-secondary/40">— {t.who}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-sm text-secondary">
                    <span className="flex items-center gap-2">
                      <Check size={15} className="text-emerald-600" />
                      No credit card needed
                    </span>
                    <span className="flex items-center gap-2">
                      <Check size={15} className="text-emerald-600" />
                      500+ daily readers
                    </span>
                  </div>
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

        {/* ── Stats ── */}
        <section className="px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-6xl">
              <div className="grid grid-cols-3 divide-x divide-black/6 rounded-2xl border border-black/6 bg-white/60 backdrop-blur-sm">
                <StatCard value="50+" label="topics in a full Pro day" />
                <StatCard value="10+" label="sources folded into top stories" />
                <StatCard value="500+" label="people reading with Trace" />
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Sources ── */}
        <section className="px-4 pt-16 sm:px-6 sm:pt-24">
          <Reveal>
            <div className="mx-auto max-w-6xl text-center">
              <p className="text-[11px] uppercase tracking-[0.3em] text-secondary/40">
                Signals we pull from every day
              </p>
              <div className="mx-auto mt-8 max-w-4xl space-y-6">
                {[
                  {
                    label: 'Stories & reporting',
                    sources: [
                      'TechCrunch',
                      'The Verge',
                      'Ars Technica',
                      'Wired',
                      '9to5Google',
                      'Reuters',
                      'Bloomberg',
                      'Hacker News',
                      'The Information',
                    ],
                  },
                  {
                    label: 'Community pulse',
                    sources: ['Reddit', 'X', 'Bluesky', 'Threads', 'Lemmy', 'Discord', 'Stack Overflow'],
                  },
                  {
                    label: 'Launches & builds',
                    sources: ['Product Hunt', 'Indie Hackers', 'GitHub', 'Show HN', 'BetaList', 'Peerlist', 'Wellfound'],
                  },
                ].map((group) => (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary/35">{group.label}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2.5 sm:justify-center">
                      {group.sources.map((s) => (
                        <span
                          key={`${group.label}-${s}`}
                          className="rounded-full border border-black/6 bg-white/50 px-3.5 py-1.5 text-[13px] font-medium text-secondary/55 transition-colors hover:text-secondary hover:bg-white/80"
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

        {/* ── Value Props ── */}
        <section className="px-4 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">
            {[
              { icon: Newspaper, title: 'What happened', desc: 'The biggest tech stories grouped from many sources into one readable view.' },
              { icon: MessagesSquare, title: 'What people are saying', desc: 'High-signal discussions from the communities that shape the industry.' },
              { icon: Rocket, title: 'What people are building', desc: 'Launches, tools, repos, and experiments shipping right now.' },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 100}>
                <ProofCard icon={card.icon} title={card.title} description={card.desc} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── How your pulse works ── */}
        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <p className="text-center text-[11px] uppercase tracking-[0.28em] text-secondary/40">How your pulse works</p>
              <h2 className="mx-auto mt-4 max-w-2xl text-center text-3xl font-bold tracking-[-0.03em] sm:text-[2.35rem] sm:leading-[1.12]">
                One pulse. The shape of the day.
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-center text-[15px] leading-[1.75] text-secondary">
                Trace reads the stories, the conversations, and the launches — then gives you one calm, scannable daily briefing.
              </p>
            </Reveal>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {[
                {
                  k: 'What happened',
                  body: 'Grouped trending stories across sources, anchored by the day\'s lead story.',
                },
                {
                  k: 'What people are saying',
                  body: 'High-signal discussions from HN, Reddit, and the communities that matter to you.',
                },
                {
                  k: 'What people are building',
                  body: 'Launches, repos, changelogs, and tools — the building signals worth knowing about.',
                },
              ].map((item, i) => (
                <Reveal key={item.k} delay={i * 90}>
                  <div className="h-full rounded-[24px] border border-black/6 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/50">{item.k}</p>
                    <p className="mt-4 text-[15px] leading-[1.75] text-secondary">{item.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={200}>
              <p className="mx-auto mt-12 max-w-xl text-center text-lg font-semibold tracking-[-0.02em] text-foreground sm:text-xl">
                Open Trace once, get the shape of the day.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── Trace Pro ── */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <Reveal>
            <div className="mx-auto max-w-2xl rounded-[28px] bg-[#151515] p-8 text-white shadow-[0_32px_80px_rgba(15,15,15,0.2)] sm:p-10">
              <p className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.18em] mb-5">{planName}</p>
              <h3 className="text-[1.55rem] font-bold tracking-[-0.025em] leading-tight mb-3">
                Your personal daily advantage in tech
              </h3>
              <p className="text-[14px] text-white/45 mb-8 leading-relaxed">
                Deeper context, smarter filtering, and signal over noise — in one daily pulse. Try it free for {trialDays} days. No charge until the trial ends.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  'A daily pulse tailored to your role and interests',
                  'Grouped topic pages instead of duplicate links',
                  'Community signal without endless scrolling',
                  'Launches and products worth watching',
                  'A faster way to stay current in tech',
                ].map((line) => (
                  <div key={line} className="flex items-start gap-3">
                    <Check size={13} className="shrink-0 mt-[3px] text-white/40" strokeWidth={2.5} />
                    <p className="text-[13px] font-medium text-white/88 leading-snug">{line}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleStartTrial('pricing_card')}
                className="w-full py-3.5 rounded-full text-[13px] font-semibold bg-white text-[#151515] transition-all hover:bg-white/90 hover:scale-[1.01] active:scale-[0.99]"
              >
                Start {trialDays}-Day Free Trial
              </button>
              <p className="mt-3 text-center text-[13px] leading-snug text-white/55">
                {priceDisplay} after {trialDays} days · Cancel anytime
              </p>
            </div>
          </Reveal>
        </section>

        {/* ── Topic Preview ── */}
        <section className="px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-6xl rounded-[28px] border border-black/6 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-10">
              <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-secondary/40">Trending (public sample)</p>
                  <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-[2.5rem] sm:leading-[1.1]">
                    One lane of a bigger pulse
                  </h2>
                  <p className="mt-5 max-w-lg text-[15px] leading-[1.75] text-secondary">
                    Trending is one part of Trace. The full product also shows the conversations and launches behind the stories — so you see how the day in tech actually took shape, not just the headlines.
                  </p>
                  <Link
                    href="/trending"
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-foreground/70"
                  >
                    Browse live trending
                    <ArrowRight size={15} className="text-secondary" />
                  </Link>
                </div>
                <TopicPreviewCard />
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Search Intent Links ── */}
        <section className="px-4 pt-16 sm:px-6 sm:pt-20">
          <Reveal>
            <div className="mx-auto max-w-6xl rounded-[28px] border border-black/6 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-10">
              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.24em] text-secondary/40">Popular comparisons</p>
                <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-[2.4rem] sm:leading-[1.1]">
                  Not looking for “more news”? Good.
                </h2>
                <p className="mt-5 text-[15px] leading-[1.75] text-secondary">
                  Most people searching for a better news setup are really searching for less noise. These pages explain where Trace fits without giving away the whole product.
                </p>
              </div>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
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
                    className="rounded-[22px] bg-[#f7f3eb] p-5 transition-colors hover:bg-[#f0ebe0]"
                  >
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-secondary">{item.body}</p>
                    <div className="mt-4 text-sm font-semibold">Read guide →</div>
                  </Link>
                ))}
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
                  Stay current<br className="hidden sm:block" />
                  without the tab stack.
                </h2>
                <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-white/50">
                  Stories, community signal, and what shipped — one daily pulse instead of ten half-read feeds.
                </p>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    onClick={() => handleStartReading('bottom_cta')}
                    className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-7 py-4 text-[15px] font-semibold text-[#151515] transition-all hover:shadow-[0_8px_30px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    See today&apos;s tech pulse
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    onClick={() => handleStartTrial('bottom_cta')}
                    className="inline-flex items-center justify-center rounded-full border border-white/15 px-7 py-4 text-[15px] font-semibold text-white transition-all hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98]"
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
                  href={googlePlayUrl}
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

        {/* ── Email Preview + Newsletter ── */}
        <section className="px-4 pt-8 pb-16 sm:px-6 sm:pt-10 sm:pb-24">
          <Reveal>
            <div className="mx-auto max-w-4xl rounded-[24px] border border-black/6 bg-white p-8 sm:p-12">
              <div className="mb-10">
                <p className="text-[11px] uppercase tracking-[0.24em] text-secondary/40 text-center mb-5">What you&apos;ll get</p>
                <div className="mx-auto max-w-lg rounded-2xl border border-black/8 bg-[#faf8f4] p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-black/6">
                    <div className="h-8 w-8 rounded-lg bg-[#151515] flex items-center justify-center">
                      <img src="/trace.webp" alt="Trace" className="h-4 w-auto invert" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">Your Trace Daily Brief</p>
                      <p className="text-[11px] text-secondary/50">Every morning · 2 min read</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.15em] mb-1.5">Top stories</p>
                      <p className="text-[13px] font-semibold text-foreground leading-snug">Google turns Maps into a full AI navigation product</p>
                      <p className="text-[11px] text-secondary/60 mt-0.5">5 sources · Gemini answers, immersive views, lane-level detail</p>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-foreground leading-snug">Anthropic ships a sharper Claude for long documents</p>
                      <p className="text-[11px] text-secondary/60 mt-0.5">6 sources · Better reasoning on dense PDFs and spreadsheets</p>
                    </div>
                    <div className="pt-2 border-t border-black/6">
                      <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.15em] mb-1.5">Popular today</p>
                      <p className="text-[12px] text-secondary/70">&ldquo;We replaced our RAG pipeline with one long-context call&rdquo; — r/LocalLLaMA</p>
                    </div>
                    <div className="pt-2 border-t border-black/6">
                      <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.15em] mb-1.5">Shipped today</p>
                      <p className="text-[12px] text-secondary/70">Unkey · sqlite-vec · Trigger.dev v3</p>
                    </div>
                  </div>
                </div>
              </div>
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
              <Link href="/trending" className="transition-colors hover:text-foreground">Trending</Link>
              <Link href="/daily" className="transition-colors hover:text-foreground">Daily</Link>
              <Link href="/research" className="transition-colors hover:text-foreground">Research</Link>
              <Link href="/compare" className="transition-colors hover:text-foreground">Compare</Link>
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

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-5 text-center sm:px-6">
      <p className="text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">{value}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-secondary sm:text-[12px]">{label}</p>
    </div>
  );
}

function ProofCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="h-full rounded-[24px] border border-black/6 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-7">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f5efe6] text-foreground">
        <Icon size={18} />
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-secondary">{description}</p>
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
    <div className="rounded-[28px] border border-black/6 bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.06)] sm:p-8">
      <div className="flex items-center justify-between gap-3 border-b border-black/6 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">Trending topics</p>
          <p className="mt-1 text-sm text-secondary">Grouped stories instead of duplicate tabs.</p>
        </div>
        <Link href="/trending" className="inline-flex items-center gap-1 text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground">
          Open <ArrowRight size={14} />
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {topics.map((topic) => (
          <div key={topic.label} className="rounded-2xl border border-black/6 bg-[#faf8f4] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary/40">{topic.label}</p>
            <p className="mt-2 text-[14px] font-semibold leading-snug text-foreground">{topic.story}</p>
            <p className="mt-1.5 text-[12px] text-secondary/65">{topic.meta}</p>
          </div>
        ))}
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
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#151515] text-white">
        <Mail size={18} />
      </div>
      <h3 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-foreground">Get the daily brief by email</h3>
      <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-secondary">
        Same Trace signal, delivered every morning. No spam, just the day&apos;s stories, discussions, and launches worth opening.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="h-12 flex-1 rounded-full border border-black/10 bg-[#faf8f4] px-5 text-sm outline-none transition-colors placeholder:text-secondary/40 focus:border-foreground/25"
          autoComplete="email"
          required
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="inline-flex h-12 items-center justify-center rounded-full bg-[#151515] px-6 text-sm font-semibold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === 'loading' ? 'Joining...' : 'Join free'}
        </button>
      </form>
      {status === 'success' && <p className="mt-3 text-sm text-emerald-700">You&apos;re on the list.</p>}
      {status === 'error' && <p className="mt-3 text-sm text-red-600">Could not subscribe right now.</p>}
    </div>
  );
}
