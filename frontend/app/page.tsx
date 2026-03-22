"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ExternalLink, Mail, Newspaper, MessagesSquare, Rocket } from 'lucide-react';
import { consumePendingPostAuthIntent, getPostAuthDestination, useAuth } from '@/contexts/AuthContext';
import { PulseBetaBadge } from '@/components/PulseBetaBadge';

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
  const { user, profile, loading, profileResolved, signInWithGoogle } = useAuth();
  const [pricingPreview, setPricingPreview] = useState<{
    trialDays: number;
    priceDisplay: string;
    pricingOffer: 'india' | 'default';
  } | null>(null);
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

  useEffect(() => {
    let cancelled = false;

    const loadPricingPreview = async () => {
      try {
        const response = await fetch('/api/subscription/pricing');
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setPricingPreview(data);
        }
      } catch (error) {
        console.error('Error fetching landing pricing:', error);
      }
    };

    void loadPricingPreview();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartReading = () => {
    router.push('/onboarding');
  };

  const handleStartTrial = () => {
    router.push('/onboarding?intent=checkout');
  };

  const trialDays = pricingPreview?.trialDays ?? 3;
  const priceDisplay = pricingPreview?.priceDisplay ?? '$4.99/month';
  const planName = pricingPreview?.pricingOffer === 'india' ? 'Trace Pro India' : 'Trace Pro';

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
              href="/research"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-secondary transition-colors hover:text-foreground sm:inline-flex"
            >
              Research
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
                    onClick={handleStartReading}
                    className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-[#151515] px-7 py-4 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all hover:bg-black hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    See today&apos;s tech pulse
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    onClick={handleStartTrial}
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 backdrop-blur-sm px-7 py-4 text-[15px] font-semibold transition-all hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Start free trial
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
                onClick={handleStartTrial}
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
                    onClick={handleStartReading}
                    className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-7 py-4 text-[15px] font-semibold text-[#151515] transition-all hover:shadow-[0_8px_30px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    See today&apos;s tech pulse
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    onClick={handleStartTrial}
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

const DEMO_PULSE_EYEBROW =
  'text-[10px] font-semibold text-secondary/60 uppercase tracking-[0.15em] sm:text-[11px]';

function HeroDemoFeedToggle({
  view,
  onChange,
}: {
  view: 'pulse' | 'briefing';
  onChange: (view: 'pulse' | 'briefing') => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground/6 p-1">
      {([
        { key: 'briefing' as const, label: 'News' },
        { key: 'pulse' as const, label: 'Pulse' },
      ] as const).map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors sm:px-3.5 sm:text-[12px] ${
            view === item.key
              ? 'bg-foreground text-background'
              : 'text-secondary/70 hover:text-foreground'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function HeroPulsePreview() {
  const [demoView, setDemoView] = useState<'pulse' | 'briefing'>('briefing');
  const [newsPick, setNewsPick] = useState(0);
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const newsStories = [
    {
      title: 'Google turns Maps into an AI navigation product',
      preview:
        'Gemini answers, immersive route views, and richer driver context — a shift toward conversational navigation.',
      meta: '42m ago · 5 sources',
      keyTakeaways: [
        'Gemini is woven into turn-by-turn guidance so drivers can ask plain-language questions without leaving navigation.',
        'Immersive previews and lane-level detail are pitched as reducing wrong exits in complex interchanges.',
        'Google is framing Maps as an “AI surface” alongside Search and Workspace, not just a utility.',
      ],
      timeline: [
        {
          when: 'Mon 6:12 AM',
          source: 'Bloomberg',
          title: 'Google tests conversational prompts inside Maps beta',
          summary: 'Screenshots show a Gemini chip above the route card for a small Android cohort.',
        },
        {
          when: 'Mon 11:40 AM',
          source: 'Google Blog',
          title: 'Official walkthrough of AI navigation features',
          summary: 'Emphasis on eyes-free Q&A and summarizing reviews for busy corridors.',
        },
        {
          when: 'Tue 3:05 PM',
          source: 'The Verge',
          title: 'Competitors race to match on-device routing assistants',
          summary: 'Analysts note regulatory scrutiny on location data used for model tuning.',
        },
      ],
    },
    {
      title: 'Meta confirms major workforce reduction',
      preview:
        'The company is restructuring teams while doubling down on AI infrastructure and core products.',
      meta: '3h ago · 3 sources',
      keyTakeaways: [
        'Cuts are concentrated in middle management and duplicated product roles, per internal talking points.',
        'CapEx guidance still points upward for GPUs and data-center leases through next year.',
        'Reality Labs spending is being re-phased; wearables remain a public priority.',
      ],
      timeline: [
        {
          when: 'Tue 9:00 AM',
          source: 'WSJ',
          title: 'Meta prepares another round of layoffs',
          summary: 'Sources cite a focus on “flattening” org charts after rapid hiring in 2021–22.',
        },
        {
          when: 'Tue 11:22 AM',
          source: 'Meta',
          title: 'Internal memo outlines restructuring timeline',
          summary: 'Affected employees to hear by end of week; severance similar to prior rounds.',
        },
        {
          when: 'Tue 2:48 PM',
          source: 'FT',
          title: 'Investors weigh efficiency vs. metaverse burn rate',
          summary: 'Shares move on commentary that AI ads could offset slower Reality Labs revenue.',
        },
      ],
    },
    {
      title: 'Anthropic ships a sharper Claude for long documents',
      preview:
        'Better reasoning on dense PDFs and spreadsheets, with clearer citations for enterprise workflows.',
      meta: 'Yesterday · 6 sources',
      keyTakeaways: [
        'Long-context performance is tuned for contracts, security reviews, and financial filings.',
        'Inline citations link back to page regions so teams can audit answers quickly.',
        'Pricing tiers nudge enterprises toward annual commits with higher rate limits.',
      ],
      timeline: [
        {
          when: 'Sun 4:10 PM',
          source: 'Anthropic',
          title: 'Release notes: document QA and spreadsheet tools',
          summary: 'Highlights lower hallucination rate on tabular extracts in internal benchmarks.',
        },
        {
          when: 'Mon 8:30 AM',
          source: 'TechCrunch',
          title: 'Enterprises trial Claude on due-diligence workflows',
          summary: 'Legal teams cite citation trails as the feature that passed procurement.',
        },
        {
          when: 'Mon 6:15 PM',
          source: 'Ars Technica',
          title: 'Benchmark drama: vendors dispute methodology',
          summary: 'Anthropic argues rivals omit long-doc suites their customers actually run.',
        },
      ],
    },
  ];

  const preventNav = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="relative">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="pointer-events-none absolute -top-10 -right-18 z-0 hidden h-20 w-auto rotate-30 lg:block"
      >
        <source src="/hello.webm" type="video/webm" />
      </video>
      <div className="relative z-10 overflow-hidden rounded-2xl border border-border/15 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/15 px-4 py-3 sm:px-5">
          <p className="text-[10px] font-semibold text-secondary/45 uppercase tracking-[0.18em]">{todayLabel}</p>
          <HeroDemoFeedToggle view={demoView} onChange={setDemoView} />
        </div>

        {/* Fixed height so switching News ↔ Pulse does not resize the card */}
        <div className="h-[min(28rem,75vh)]">
        {demoView === 'pulse' ? (
          <div className="h-full overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
            <header className="mb-8">
              <div className={`${DEMO_PULSE_EYEBROW} mb-2 flex flex-wrap items-center gap-2`}>
                <span>Pulse</span>
                <PulseBetaBadge />
              </div>
              <h3 className="text-xl font-bold tracking-[-0.02em] text-foreground sm:text-2xl">{greeting}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-secondary/70 sm:text-[14px]">
                Briefing, conversations, and builds in one column — same rhythm as News.
              </p>
            </header>

            <section className="border-t border-border/15 pt-6">
              <p className={DEMO_PULSE_EYEBROW}>Briefing</p>
              <p className="mt-2 text-[13px] leading-relaxed text-secondary/70 sm:text-[14px]">
                The shape of the day in one read.
              </p>
              <p className="mt-4 text-[13px] leading-relaxed text-secondary sm:text-[14px]">
                Markets are watching rate guidance while big tech doubles down on AI product layers. Below: what
                shipped, what people are debating, and what launched overnight.
              </p>
            </section>

            <section className="mt-8 border-t border-border/15 pt-6">
              <p className={DEMO_PULSE_EYEBROW}>Popular builds</p>
              <p className="mt-2 text-[13px] text-secondary/70 sm:text-[14px]">Launches, tools, and ships worth a look.</p>
              <div className="mt-4 divide-y divide-border/10">
                {[
                  {
                    title: 'ShipKit — codegen CLI for product teams',
                    body: 'Open-source workflows to scaffold services, docs, and review-ready PRs from a single command.',
                    when: '5:30 AM',
                    src: 'Product Hunt',
                  },
                  {
                    title: 'llm-bench eval harness',
                    body: 'A tiny harness to compare latency and quality across models without standing up infra.',
                    when: '5:30 AM',
                    src: 'GitHub',
                  },
                ].map((row) => (
                  <div key={row.title} className="py-4 first:pt-0 last:pb-0">
                    <h4 className="text-sm font-semibold leading-snug text-foreground">
                      <a
                        href="#"
                        onClick={preventNav}
                        className="group inline-flex max-w-full items-start gap-1.5 rounded-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2"
                      >
                        <span className="min-w-0 flex-1 decoration-foreground/35 underline-offset-[3px] group-hover:underline">
                          {row.title}
                        </span>
                        <ExternalLink
                          size={14}
                          className="mt-0.5 shrink-0 text-secondary/45 transition-colors group-hover:text-foreground/60"
                          aria-hidden
                        />
                      </a>
                    </h4>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-secondary/50">
                      <span>{row.when}</span>
                      <span className="text-secondary/30">·</span>
                      <span>{row.src}</span>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-secondary/65">{row.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8 border-t border-border/15 pt-6">
              <p className={DEMO_PULSE_EYEBROW}>Popular conversations</p>
              <p className="mt-2 text-[13px] text-secondary/70 sm:text-[14px]">What people are talking about right now.</p>
              <div className="mt-4 divide-y divide-border/10">
                {[
                  {
                    title: 'Why we moved our inference stack to smaller models',
                    body: 'Teams trade raw benchmark wins for predictable cost curves and simpler on-call — the thread breaks down when it pays off.',
                    when: '5:30 AM',
                    src: 'r/LocalLLaMA',
                  },
                  {
                    title: 'When to stop chasing the new framework',
                    body: 'A grounded take on shipping vs. novelty — stability, hiring, and velocity weighed against rewrite risk.',
                    when: '5:30 AM',
                    src: 'r/ExperiencedDevs',
                  },
                ].map((row) => (
                  <div key={row.title} className="py-4 first:pt-0 last:pb-0">
                    <h4 className="text-sm font-semibold leading-snug text-foreground">
                      <a
                        href="#"
                        onClick={preventNav}
                        className="group inline-flex max-w-full items-start gap-1.5 rounded-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2"
                      >
                        <span className="min-w-0 flex-1 decoration-foreground/35 underline-offset-[3px] group-hover:underline">
                          {row.title}
                        </span>
                        <ExternalLink
                          size={14}
                          className="mt-0.5 shrink-0 text-secondary/45 transition-colors group-hover:text-foreground/60"
                          aria-hidden
                        />
                      </a>
                    </h4>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-secondary/50">
                      <span>{row.when}</span>
                      <span className="text-secondary/30">·</span>
                      <span>{row.src}</span>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-secondary/65">{row.body}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col sm:flex-row">
            <div className="flex min-h-0 flex-3 flex-col border-b border-border/15 sm:w-[44%] sm:flex-none sm:border-b-0 sm:border-r">
              <div className="shrink-0 border-b border-border/15 px-4 py-3 sm:px-3.5">
                <p className="text-[12px] font-bold text-foreground">News</p>
                <p className="mt-0.5 text-[10px] text-secondary/55">Today · {newsStories.length} stories</p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {(['For You', 'AI', 'Suggested'] as const).map((pill, i) => (
                    <span
                      key={pill}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                        i === 0 ? 'bg-foreground text-background' : 'bg-foreground/8 text-secondary/70'
                      }`}
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-border/10 overflow-y-auto overscroll-contain">
                {newsStories.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => setNewsPick(i)}
                    className={`w-full px-4 py-3.5 text-left transition-colors sm:px-3.5 ${
                      newsPick === i ? 'bg-surface-secondary' : 'hover:bg-surface-secondary/50'
                    }`}
                  >
                    <p className="text-[12px] font-semibold leading-snug text-foreground line-clamp-2">{s.title}</p>
                    <p className="mt-1.5 text-[10px] text-secondary/50">{s.meta}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-2 overflow-y-auto overscroll-contain bg-white p-4 sm:flex-1 sm:p-5">
              {(() => {
                const story = newsStories[newsPick]!;
                return (
                  <>
                    <p className="text-[10px] text-secondary/50">{story.meta}</p>
                    <h4 className="mt-2 text-[15px] font-bold leading-snug tracking-[-0.01em] text-foreground">
                      {story.title}
                    </h4>
                    <p className="mt-3 text-[13px] leading-relaxed text-secondary">{story.preview}</p>

                    <div className="mt-6 border-t border-border/15 pt-5">
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-secondary/60">
                        Key takeaways
                      </h3>
                      <ul className="mt-3 space-y-2.5">
                        {story.keyTakeaways.map((point, i) => (
                          <li key={i} className="flex gap-2.5 text-[12px] leading-relaxed text-secondary/85">
                            <span className="mt-0.5 shrink-0 font-mono text-[10px] text-secondary/35">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 border-t border-border/15 pt-5">
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-secondary/50">
                        Timeline
                      </h3>
                      <div className="mt-3 space-y-1">
                        {story.timeline.map((ev, i) => (
                          <div
                            key={i}
                            className="rounded-lg px-2.5 py-2.5 -mx-2.5 hover:bg-foreground/3 transition-colors"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-secondary/50">{ev.when}</span>
                              <span className="text-secondary/30 text-[10px]">·</span>
                              <span className="text-[10px] text-secondary/50">{ev.source}</span>
                            </div>
                            <div className="mt-1 flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-medium leading-snug text-foreground">{ev.title}</p>
                                {ev.summary ? (
                                  <p className="mt-1 text-[11px] leading-relaxed text-secondary/55 line-clamp-2">
                                    {ev.summary}
                                  </p>
                                ) : null}
                              </div>
                              <ExternalLink
                                size={12}
                                className="mt-0.5 shrink-0 text-secondary/30"
                                aria-hidden
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="mt-6 border-t border-border/15 pt-4 text-[10px] leading-relaxed text-secondary/45">
                      In Trace, this panel matches your live feed — open originals from the timeline anytime.
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        )}
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

function TopicPreviewCard() {
  const points = [
    'Coverage from several outlets is merged into one storyline.',
    'You see the big move first, then the details that matter.',
    'Original links stay there when you want deeper reporting.',
  ];

  return (
    <div className="lg:border-l lg:border-black/8 lg:pl-10">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-secondary/40">Sample grouped topic</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <h3 className="max-w-xl text-[1.35rem] font-semibold leading-snug tracking-[-0.03em] text-foreground sm:text-2xl sm:leading-tight">
          Anthropic launches a more capable Claude
        </h3>
        <p className="shrink-0 text-[13px] tabular-nums text-secondary/50 sm:pt-1 sm:text-right">
          <span className="font-semibold text-foreground">6</span>
          <span className="text-secondary/40"> · </span>
          sources
        </p>
      </div>

      <div className="mt-6 border-t border-black/8 pt-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary/40">Brief</p>
        <p className="mt-2.5 text-[14px] leading-[1.75] text-secondary">
          Anthropic is pushing Claude higher up the stack, with better reasoning, longer-context workflows, and a clearer play for enterprise teams that want AI integrated into real work.
        </p>
      </div>

      <div className="mt-6 border-t border-black/8 pt-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary/40">Key points</p>
        <ul className="mt-3 space-y-2.5">
          {points.map((text, i) => (
            <li key={text} className="flex gap-3 text-[14px] leading-snug text-secondary">
              <span className="w-5 shrink-0 font-mono text-[11px] text-secondary/35">{String(i + 1).padStart(2, '0')}</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
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
