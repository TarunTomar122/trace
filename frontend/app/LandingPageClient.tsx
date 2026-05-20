"use client";

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Newspaper,
  MessagesSquare,
  Rocket,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { consumePendingPostAuthIntent, getPostAuthDestination, useAuth } from '@/contexts/AuthContext';
import { trackLandingCTAClicked } from '@/lib/posthog';
import { LANDING_PRICING_BULLET_POINTS } from '@/lib/subscription-pricing-bullets';
import {
  SUBSCRIPTION_COMPARE_AT_DEFAULT,
  SUBSCRIPTION_PRICE_DEFAULT,
  SUBSCRIPTION_PRICE_INDIA,
} from '@/lib/subscription-pricing';
import SubscriptionPrice from '@/components/SubscriptionPrice';
import type { HeroHeadline } from '@/lib/hero-headlines';

/* ─── scroll-reveal ─── */

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
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── data ─── */

const TRUST_SOURCES = ['TechCrunch', 'Hacker News', 'The Verge', 'Product Hunt', 'GitHub'];

/** Stable portrait URLs from randomuser.me (free, no API key). */
const READER_AVATARS = [
  { src: 'https://randomuser.me/api/portraits/women/44.jpg', alt: 'Trace reader' },
  { src: 'https://randomuser.me/api/portraits/men/32.jpg', alt: 'Trace reader' },
  { src: 'https://randomuser.me/api/portraits/women/68.jpg', alt: 'Trace reader' },
] as const;

const NAV_LINKS = [
  { href: '/compare', label: 'Compare' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/use-cases', label: 'Use Cases' },
  { href: '/resources', label: 'Resources' },
  { href: '/blog', label: 'Blog' },
] as const;

const PULSE_LENSES: { icon: LucideIcon; label: string; title: string; body: string }[] = [
  {
    icon: Newspaper,
    label: 'What happened',
    title: 'Grouped stories',
    body: 'The biggest tech stories from many sources in one readable view, anchored by the day\'s lead story.',
  },
  {
    icon: MessagesSquare,
    label: 'What people are saying',
    title: 'Community signal',
    body: 'High-signal threads from HN, Reddit, and the communities that matter, without the noise.',
  },
  {
    icon: Zap,
    label: 'Hot tweets',
    title: 'Viral tech conversation',
    body: 'The tweets driving the day: spicy takes, viral threads, and debates worth knowing about.',
  },
  {
    icon: Rocket,
    label: 'What people are building',
    title: 'Launches & repos',
    body: 'Product Hunt launches, GitHub repos, changelogs, and tools shipped today.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Backend eng',
    handle: 'fintech, SF',
    quote: 'Trace helps me get rid of the FOMO anxiety. I scroll for 2 minutes in the morning and I\'m ready to talk about everything.',
  },
  {
    name: 'Product lead',
    handle: 'growth-stage SaaS',
    quote: 'My Slack is a firehose of links I never open. Trace is my actual filter so I\'m not nodding along blind in meetings.',
  },
  {
    name: 'Founding eng',
    handle: 'devtools',
    quote: 'Quick skim of the feed and I at least have a take when someone brings up a new model or launch. Life saver honestly.',
  },
  {
    name: 'PM',
    handle: 'AI products',
    quote: 'I stopped checking 10 tabs every morning. One pulse and I know what the day in tech looks like.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'What is Trace?',
    a: 'Trace is a daily tech briefing. It pulls stories, community discussions, hot tweets, and launches from 50+ sources, then groups them into one scannable pulse with AI summaries, key points, and timelines.',
  },
  {
    q: 'Do I need an account?',
    a: 'No for browsing. Trending, daily archives, and blog guides are public. Sign in when you want your personalized feed, bookmarks, and Trace Pro.',
  },
  {
    q: 'What does Trace Pro include?',
    a: 'A feed tailored to your role and interests, full topic depth, hot tweets, launches, and community signal, with a 3-day free trial. Cancel before day 3 and pay nothing.',
  },
  {
    q: 'Is there an Android app?',
    a: 'Yes. Trace is on Google Play if you want the same daily brief on your phone.',
  },
];

const HeroPulsePreview = dynamic(() => import('./HeroPulsePreview'), {
  loading: () => (
    <div className="relative overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
      <div className="h-[min(28rem,75vh)] animate-pulse bg-gradient-to-br from-blue-50 via-white to-gray-50" />
    </div>
  ),
});

const INDIA_PRICING_PREVIEW = {
  trialDays: 3,
  priceDisplay: SUBSCRIPTION_PRICE_INDIA,
  compareAtPriceDisplay: null,
  pricingOffer: 'india' as const,
};
const DEFAULT_PRICING_PREVIEW = {
  trialDays: 3,
  priceDisplay: SUBSCRIPTION_PRICE_DEFAULT,
  compareAtPriceDisplay: SUBSCRIPTION_COMPARE_AT_DEFAULT,
  pricingOffer: 'default' as const,
};

function guessClientPricingPreview() {
  if (typeof window === 'undefined') return DEFAULT_PRICING_PREVIEW;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Kolkata') return INDIA_PRICING_PREVIEW;
    const lang = (navigator.language || '').toLowerCase();
    if (lang === 'en-in' || lang.endsWith('-in')) return INDIA_PRICING_PREVIEW;
  } catch { /* default */ }
  return DEFAULT_PRICING_PREVIEW;
}

function LiveHeadline({ headlines }: { headlines: HeroHeadline[] }) {
  const [index, setIndex] = useState(0);
  const items = headlines.length > 0 ? headlines : [{ text: 'Something big happened in AI today.', company: '', domain: '' }];

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 4000);
    return () => clearInterval(t);
  }, [items.length]);

  return (
    <p className="text-[13px] font-medium" style={{ color: '#2563eb' }}>
      Live now: {items[index]?.text}
    </p>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#e5e7eb] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[15px] font-semibold text-[#111827]">{q}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-[#9ca3af] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? '200px' : '0', opacity: open ? 1 : 0 }}
      >
        <p className="pb-5 text-[14px] leading-relaxed text-[#6b7280]">{a}</p>
      </div>
    </div>
  );
}

/* ─── page ─── */

export default function LandingPageClient({
  heroHeadlines = [],
  recentBlogPosts = [],
}: {
  heroHeadlines?: HeroHeadline[];
  recentBlogPosts?: { href: string; date: string; title: string }[];
}) {
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
    if (user && profileResolved) {
      trackLandingCTAClicked('read', location, { destination: 'feed' });
      router.push('/feed');
    } else {
      trackLandingCTAClicked('read', location, { destination: 'onboarding' });
      try { sessionStorage.setItem('trace-show-pro-welcome', '1'); } catch { /* ignore */ }
      router.push('/onboarding?intent=read');
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
  const priceDisplay = pricingPreview.priceDisplay;
  const compareAtPriceDisplay = pricingPreview.compareAtPriceDisplay;

  if (loading || (user && !profileResolved)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#2563eb]/20 border-t-[#2563eb] rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#2563eb]/20 border-t-[#2563eb] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="landing-page">
      <div className="landing-grid-bg">
        {/* ── Floating nav ── */}
        <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
          <div className="landing-nav">
            <Link href="/" className="flex items-center gap-2.5 no-underline" style={{ color: 'inherit' }}>
              <Image src="/trace.webp" alt="Trace" width={22} height={22} priority className="h-[22px] w-auto" />
              <span className="text-[13px] font-bold tracking-[0.12em]">TRACE</span>
            </Link>
            <nav className="landing-nav-links">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="landing-nav-link">
                  {link.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => void handleAuthStart('read')}
              className="landing-btn landing-btn-primary landing-btn-sm"
            >
              Sign in
            </button>
          </div>
        </header>

        <main>
          {/* ── Hero ── */}
          <section className="px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
            <div className="mx-auto max-w-3xl text-center">
              <Reveal>
                <div className="landing-social-pill mx-auto mb-8">
                  <div className="landing-avatars">
                    {READER_AVATARS.map((avatar) => (
                      <span
                        key={avatar.src}
                        className="landing-avatar-wrap"
                        style={{ borderRadius: '9999px', overflow: 'hidden' }}
                      >
                        <img
                          src={avatar.src}
                          alt={avatar.alt}
                          width={28}
                          height={28}
                          loading="lazy"
                          style={{ borderRadius: '9999px', objectFit: 'cover', width: '100%', height: '100%', display: 'block' }}
                        />
                      </span>
                    ))}
                  </div>
                  <span className="text-[13px] font-medium" style={{ color: '#374151' }}>Join 500+ readers</span>
                  <button
                    type="button"
                    onClick={() => handleStartReading('hero_badge')}
                    className="landing-btn landing-btn-green landing-btn-sm"
                    style={{ padding: '0.375rem 0.875rem', fontSize: '12px' }}
                  >
                    Read today&apos;s pulse →
                  </button>
                </div>

                {heroHeadlines.length > 0 && (
                  <div className="mb-4">
                    <LiveHeadline headlines={heroHeadlines} />
                  </div>
                )}

                <h1 className="landing-hero-title">
                  F*ck the algorithms.<br />
                  Build your own feed
                </h1>
                <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.7] landing-muted sm:text-[17px]">
                  We scan 50+ sources, remove the duplicate noise, and give you one clear daily pulse with the stories, reactions, and launches that actually matter.
                </p>

                <div className="landing-hero-actions">
                  <button
                    type="button"
                    onClick={() => handleStartReading('hero')}
                    className="landing-btn landing-btn-primary landing-btn-lg"
                  >
                    Read today's brief
                  </button>
                </div>
                <p className="mt-4 text-[13px]" style={{ color: '#9ca3af' }}>Free to read · No credit card</p>
              </Reveal>

              <Reveal delay={120}>
                <div className="landing-trust-row">
                  {TRUST_SOURCES.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
              </Reveal>
            </div>
          </section>

          {/* ── Product preview ── */}
          <section id="preview" className="px-4 pb-20 sm:px-6 sm:pb-28">
            <div className="mx-auto max-w-5xl">
              <Reveal>
                <p className="mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: '#9ca3af' }}>
                  What you get every day
                </p>
                <HeroPulsePreview />
              </Reveal>
            </div>
          </section>

          {/* ── How it works ── */}
          <section id="how-it-works" className="px-4 py-20 sm:px-6 sm:py-28">
            <div className="mx-auto max-w-7xl">
              <Reveal>
                <div className="text-center">
                  <span className="landing-badge">How it works</span>
                  <h2 className="landing-section-title mt-6">
                    One brief. Zero tab chaos.
                  </h2>
                  <p className="mx-auto mt-4 max-w-lg text-[16px] landing-muted">
                    Trace pulls in the biggest stories, what people are saying, and what shipped today, then turns it into a short brief you can skim in minutes.
                  </p>
                </div>
              </Reveal>

              <div className="landing-grid-4 mt-14">
                {PULSE_LENSES.map((item, i) => (
                  <div key={item.label} className="landing-grid-item">
                    <Reveal delay={i * 80}>
                      <div className="landing-card landing-pulse-card">
                        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: '#eff6ff', color: '#2563eb' }}>
                          <item.icon size={16} />
                        </div>
                        <p className="landing-pulse-label">{item.label}</p>
                        <h3 className="landing-pulse-title">{item.title}</h3>
                        <p className="landing-pulse-body">{item.body}</p>
                      </div>
                    </Reveal>
                  </div>
                ))}
              </div>

              <Reveal delay={320}>
                <p className="mx-auto mt-12 max-w-xl text-center text-[17px] font-medium" style={{ color: '#374151' }}>
                  Open Trace once, get the shape of the day.
                </p>
              </Reveal>
            </div>
          </section>

          {/* ── Reader notes ── */}
          <section id="readers" className="overflow-hidden py-16 sm:py-20">
            <Reveal>
              <div className="text-center px-4">
                <span className="landing-badge">From readers</span>
                <h2 className="landing-section-title mt-6">
                  Built for people who hate falling behind
                </h2>
                <p className="mt-3 text-[15px] landing-muted">Notes from developers, PMs, and founders who read with Trace.</p>
              </div>
            </Reveal>
            <div className="mt-10 relative overflow-hidden">
              <div className="landing-testimonial-track">
                {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                  <figure
                    key={`${t.name}-${i}`}
                    className="landing-card w-[320px] shrink-0 p-6"
                  >
                    <blockquote className="text-[14px] leading-relaxed text-[#374151]">&ldquo;{t.quote}&rdquo;</blockquote>
                    <figcaption className="mt-4">
                      <p className="text-[13px] font-semibold text-[#111827]">{t.name}</p>
                      <p className="text-[12px] text-[#9ca3af]">{t.handle}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>

          {/* ── Pricing ── */}
          <section id="pricing" className="px-4 py-16 sm:px-6 sm:py-20">
            <Reveal>
              <div className="mx-auto max-w-lg overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
                <div className="bg-gradient-to-br from-[#eff6ff] to-white p-8 sm:p-10">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">Trace Pro</p>
                  <h3 className="mt-4 text-[1.75rem] font-bold tracking-[-0.02em]">
                    Your personal daily advantage in tech
                  </h3>
                  <div className="mt-4">
                    <SubscriptionPrice
                      price={priceDisplay}
                      compareAt={compareAtPriceDisplay}
                      size="lg"
                    />
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-[#6b7280]">
                    Try free for 3 days. Cancel before day 3 and you pay nothing.
                  </p>
                  <div className="mt-6 space-y-3">
                    {LANDING_PRICING_BULLET_POINTS.map((line) => (
                      <div key={line} className="flex items-start gap-3">
                        <Check size={14} className="mt-0.5 shrink-0 text-[#2563eb]" strokeWidth={2.5} />
                        <p className="text-[13px] text-[#374151]">{line}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStartTrial('pricing_card')}
                    className="landing-btn landing-btn-primary landing-btn-lg mt-8 w-full"
                  >
                    Start my free 3-day trial
                  </button>
                  <p className="mt-3 text-center text-[12px] text-[#9ca3af]">
                    3-day free trial · Cancel anytime
                  </p>
                </div>
              </div>
            </Reveal>
          </section>

          {/* ── Blog ── */}
          {recentBlogPosts.length > 0 && (
            <section className="px-4 py-16 sm:px-6 sm:py-20">
              <div className="mx-auto max-w-6xl">
                <Reveal>
                  <div className="text-center">
                    <span className="landing-badge">Blog</span>
                    <h2 className="landing-section-title mt-6">
                      Guides on smarter tech reading
                    </h2>
                    <p className="mt-3 text-[15px] landing-muted">
                      Feedly alternatives, doomscrolling, RSS fatigue, and where Trace fits.
                    </p>
                  </div>
                </Reveal>
                <div className="landing-blog-grid landing-section-gap">
                  {recentBlogPosts.map((post) => (
                    <Link key={post.href} href={post.href} className="landing-blog-card">
                      <span className="landing-blog-date">{post.date}</span>
                      <span className="landing-blog-title">{post.title}</span>
                    </Link>
                  ))}
                </div>
                <div className="landing-blog-footer">
                  <Link href="/blog">Read all guides →</Link>
                </div>
              </div>
            </section>
          )}

          {/* ── FAQ ── */}
          <section id="faq" className="px-4 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-2xl">
              <Reveal>
                <h2 className="text-center text-[2rem] font-bold tracking-[-0.03em] sm:text-[2.5rem]">FAQ</h2>
                <div className="mt-10 rounded-3xl border border-[#e5e7eb] bg-white px-6 sm:px-8">
                  {FAQ_ITEMS.map((item) => (
                    <FaqItem key={item.q} q={item.q} a={item.a} />
                  ))}
                </div>
              </Reveal>
            </div>
          </section>

          {/* ── Bottom CTA ── */}
          <section className="px-4 pb-8 sm:px-6">
            <Reveal>
              <div className="landing-gradient-cta landing-dot-grid relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] px-8 py-20 text-center sm:px-16 sm:py-24">
                <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-white sm:text-[3rem] sm:leading-[1.08]">
                  Stay current without<br className="hidden sm:block" />
                  the tab stack
                </h2>
                <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-white/80">
                  Stories, community signal, and what shipped, in one daily pulse instead of ten half-read feeds.
                </p>
                <div className="landing-hero-actions mt-10">
                  <button
                    type="button"
                    onClick={() => handleStartReading('bottom_cta')}
                    className="landing-btn landing-btn-primary landing-btn-lg"
                  >
                    Read today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartTrial('bottom_cta')}
                    className="landing-btn landing-btn-secondary landing-btn-lg"
                    style={{ background: 'rgba(255,255,255,0.95)' }}
                  >
                    Try free for 3 days
                  </button>
                </div>
              </div>
            </Reveal>
          </section>

          {/* ── Android ── */}
          <section className="px-4 pb-12 sm:px-6">
            <Reveal>
              <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 rounded-3xl border border-[#e5e7eb] bg-white p-6 sm:flex-row sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2563eb] text-white">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.523 2.246a.75.75 0 0 0-1.046.177l-1.745 2.444a8.503 8.503 0 0 0-5.464 0L7.523 2.423a.75.75 0 1 0-1.223.869l1.56 2.184A8.472 8.472 0 0 0 3.5 12.5v.5a.5.5 0 0 0 .5.5h16a.5.5 0 0 0 .5-.5v-.5a8.472 8.472 0 0 0-4.36-7.024l1.56-2.184a.75.75 0 0 0-.177-1.046zM8.5 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM4 14.5a.5.5 0 0 0-.5.5v5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5a.5.5 0 0 0-.5-.5H4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold">Trace is on Android</h3>
                    <p className="text-[13px] text-[#6b7280]">Read your daily brief on the go.</p>
                  </div>
                </div>
                <a
                  href={googlePlayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-btn landing-btn-sm"
                  style={{ background: '#111827', color: '#fff', padding: '0.75rem 1.5rem' }}
                >
                  Get on Google Play
                </a>
              </div>
            </Reveal>
          </section>

          {/* ── Footer ── */}
          <footer className="relative overflow-hidden border-t border-[#e5e7eb] px-4 py-16 sm:px-6">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 select-none text-center">
              <p className="text-[clamp(4rem,15vw,10rem)] font-bold leading-none tracking-[-0.04em] text-[#f3f4f6]">
                TRACE
              </p>
            </div>
            <div className="relative mx-auto max-w-5xl">
              <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                <div className="flex items-center gap-2">
                  <Image src="/trace.webp" alt="Trace" width={18} height={18} className="h-[18px] w-auto" />
                  <span className="text-[12px] font-bold tracking-[0.12em] text-[#9ca3af]">TRACE</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] landing-muted">
                  <Link href="/blog" className="hover:text-[#111827]">Blog</Link>
                  <Link href="/compare" className="hover:text-[#111827]">Compare</Link>
                  <Link href="/privacy-policy" className="hover:text-[#111827]">Privacy</Link>
                  <Link href="/terms" className="hover:text-[#111827]">Terms</Link>
                  <Link href="/contact" className="hover:text-[#111827]">Contact</Link>
                </div>
              </div>
              <p className="mt-8 text-center text-[12px] text-[#9ca3af]">
                © {new Date().getFullYear()} Trace. All rights reserved.
              </p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
