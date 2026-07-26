"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, MessagesSquare, Newspaper, Rocket, Smartphone, Zap, type LucideIcon } from 'lucide-react';
import { consumePendingPostAuthIntent, getPostAuthDestination, useAuth } from '@/contexts/AuthContext';
import { trackLandingCTAClicked } from '@/lib/posthog';
import { SUBSCRIPTION_COMPARE_AT_DEFAULT, SUBSCRIPTION_PRICE_DEFAULT, SUBSCRIPTION_PRICE_INDIA } from '@/lib/subscription-pricing';
import SubscriptionPrice from '@/components/SubscriptionPrice';
import Footer from '@/components/Footer';
import { ProBenefits } from '@/app/wip/feed-edition/edition-shared';
import HomeEditionPreview from './HomeEditionPreview';
import type { V3UserFeed } from '@/lib/firestore';

const SOURCES = [
  'TechCrunch', 'Hacker News', 'The Verge', 'Product Hunt', 'GitHub', 'Bloomberg',
  'CNBC', 'Ars Technica', 'Wired', 'Techmeme', 'MIT Technology Review', '9to5Mac', 'and many more',
];

const SURFACES: { icon: LucideIcon; label: string; title: string; body: string }[] = [
  { icon: Newspaper, label: '01 · Edition', title: 'One reading order for the day', body: 'Coverage from across the web, reconciled into a clear edition with the source links still attached.' },
  { icon: MessagesSquare, label: '02 · Pulse', title: 'The conversations moving fastest', body: 'Useful threads and reactions from the communities that shape what happens next.' },
  { icon: Rocket, label: '03 · What shipped', title: 'The work worth noticing', body: 'Launches, repos, and practical work that deserve more than a passing headline.' },
  { icon: Zap, label: '04 · Your lens', title: 'A brief shaped around you', body: 'Two quick choices are enough to make the daily read relevant to your work.' },
];

const FAQ_ITEMS = [
  { q: 'What is Trace?', a: 'Trace reconciles reporting, discussion, and launches from across tech into one readable daily edition.' },
  { q: 'Do I need an account?', a: 'No for public reading. Create an account when you want an edition tailored to the topics you follow.' },
  { q: 'What does Trace Pro include?', a: 'The complete edition, every topic, key point, and source link, with no reading limit.' },
  { q: 'How does Trace choose what matters?', a: 'It groups duplicate coverage, puts the most consequential stories first, and keeps the source trail available when you want to go deeper.' },
  { q: 'Can I shape the edition around my work?', a: 'Yes. Choose the areas you follow during setup, then Trace uses those preferences to organize your daily read.' },
  { q: 'Where can I read Trace?', a: 'Read on the web or use the Android app. Your edition stays focused on the same topics either way.' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#e4e1d8] last:border-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-4 py-5 text-left">
        <span className="text-[16px] font-medium">{q}</span>
        <ChevronDown size={16} className={'text-[#75705f] transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && <p className="max-w-[640px] pb-5 text-[14px] leading-[1.7] text-[#75705f]">{a}</p>}
    </div>
  );
}

export default function LandingPageClient({
  recentBlogPosts = [],
  editionFeed = null,
}: {
  recentBlogPosts?: { href: string; date: string; title: string }[];
  editionFeed?: V3UserFeed | null;
}) {
  const router = useRouter();
  const { user, profile, loading, profileResolved, signInWithGoogle } = useAuth();

  useEffect(() => {
    if (loading || !user || !profileResolved) return;
    router.replace(getPostAuthDestination(profile, consumePendingPostAuthIntent() || 'read'));
  }, [user, loading, profileResolved, profile, router]);

  const startReading = (location: string) => {
    trackLandingCTAClicked('read', location, { destination: user && profileResolved ? 'feed' : 'onboarding' });
    router.push(user && profileResolved ? '/feed' : '/onboarding?intent=read');
  };

  const subscribe = (location: string) => {
    trackLandingCTAClicked('subscribe', location);
    router.push(user && profileResolved ? getPostAuthDestination(profile, 'checkout') : '/onboarding?intent=checkout');
  };

  const signIn = async () => {
    const result = await signInWithGoogle('read');
    if (result.status === 'success') router.push(getPostAuthDestination(result.profile, result.intent));
  };

  const indiaPricing = typeof window !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Kolkata';
  const priceDisplay = indiaPricing ? SUBSCRIPTION_PRICE_INDIA : SUBSCRIPTION_PRICE_DEFAULT;
  const compareAtPriceDisplay = indiaPricing ? null : SUBSCRIPTION_COMPARE_AT_DEFAULT;

  if (user) return <div className="min-h-screen bg-[#faf9f5]" />;

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#1b1a17]">
      <header className="bg-[#faf9f5] px-5 sm:px-8">
        <div className="mx-auto flex max-w-[880px] items-center justify-between border-b border-[#e4e1d8] py-4">
          <Link href="/" className="font-mono text-[12.5px] font-bold tracking-[0.28em]">TRACE</Link>
          <nav className="hidden items-center gap-5 text-[13px] text-[#75705f] sm:flex">
            <a href="/feed" className="hover:text-[#2557d6]">Edition</a>
            <a href="/feed?view=pulse" className="hover:text-[#2557d6]">Pulse</a>
            <Link href="/compare" className="hover:text-[#2557d6]">Compare</Link>
            <Link href="/blog" className="hover:text-[#2557d6]">Guides</Link>
            <Link href="/resources" className="hover:text-[#2557d6]">Resources</Link>
          </nav>
          <button type="button" onClick={() => void signIn()} className="border border-[#2557d6] px-3.5 py-1.5 text-[12px] font-semibold text-[#2557d6] hover:bg-[#2557d6] hover:text-white">Sign in</button>
        </div>
      </header>
      <div className="px-5 sm:px-8">
        <a
          href="/api/affiliate/outbound?target=android_app&next=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Donline.yourtrace.app"
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto flex max-w-[880px] items-center justify-between border-b border-[#e4e1d8] py-3 text-[12px] text-[#75705f] transition-colors hover:text-[#2557d6]"
        >
          <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">
            <Smartphone size={14} strokeWidth={1.8} className="text-[#2557d6]" />
            Trace for Android
          </span>
          <span>Get the app on Google Play →</span>
        </a>
      </div>

      <main>
        <section className="px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-[880px]">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">Trace · Independent daily tech reference</p>
            <h1
              className="mt-6 max-w-[1080px] tracking-[-0.04em]"
              style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif', fontSize: 'clamp(3rem, 5vw, 4.5rem)', lineHeight: 1.08 }}
            >
              Stay on top of tech<br />without reading 50 sources.
            </h1>
            <p className="mt-6 max-w-[620px] text-[16px] leading-[1.7] text-[#75705f] sm:text-[18px]">
              Trace reconciles reporting from across the web into one daily edition, with concise context, key points, and the source links behind every story.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <button type="button" onClick={() => startReading('hero')} className="bg-[#2557d6] px-5 py-3 text-[14px] font-semibold text-white hover:bg-[#1d48b4]">Build my brief</button>
              <span className="text-[13px] text-[#75705f]">Two quick choices, then your personalized edition.</span>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#75705f]">
              {SOURCES.map((source) => <span key={source}>{source}</span>)}
            </div>
          </div>
        </section>

        <section className="px-5 pb-16 sm:px-8 sm:pb-20">
          <div className="mx-auto max-w-[880px] border-t border-[#e4e1d8] pt-8">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">A daily surface</p>
            <div className="mt-5"><HomeEditionPreview feed={editionFeed} /></div>
            <p className="mt-5 max-w-[620px] text-[13px] leading-[1.65] text-[#75705f]">
              Prefer your inbox? Trace sends a daily email with the 10 stories worth knowing across tech, AI, and startups.
            </p>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-[880px] border-y border-[#e4e1d8] py-10">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">How Trace works</p>
            <h2 className="mt-5 max-w-[700px] text-[clamp(2.6rem,5vw,4.2rem)] leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>A clear view of the day, with the evidence still attached.</h2>
            <div className="mt-10 border-t border-[#e4e1d8]">
              {SURFACES.map((item) => (
                <article key={item.title} className="grid gap-4 border-b border-[#e4e1d8] py-6 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-8">
                  <div className="flex self-start gap-2 pt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2557d6]"><item.icon size={14} />{item.label}</div>
                  <div>
                    <h3 className="text-[28px] leading-[1.1] tracking-[-0.025em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>{item.title}</h3>
                    <p className="mt-3 max-w-[610px] text-[15px] leading-[1.7] text-[#75705f]">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-[880px] border-y border-[#e4e1d8] py-10">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">Trace Pro</p>
            <h2 className="mt-5 max-w-[600px] text-[clamp(2.6rem,5vw,4.2rem)] leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>The complete daily read.</h2>
            <p className="mt-4 max-w-[560px] text-[16px] leading-[1.7] text-[#75705f]">Get the complete day in one focused read, with every story, key point, and source link still there when you need it.</p>
            <ProBenefits className="mt-7" />
            <div className="mt-8 border-t border-[#e4e1d8] pt-7">
              <SubscriptionPrice price={priceDisplay} compareAt={compareAtPriceDisplay} size="lg" />
              <button type="button" onClick={() => subscribe('pro')} className="mt-5 w-full bg-[#2557d6] px-5 py-3 text-[14px] font-semibold text-white hover:bg-[#1d48b4]">Get Trace Pro</button>
              <p className="mt-3 text-center text-[12px] text-[#75705f]">Cancel anytime.</p>
            </div>
          </div>
        </section>

        {recentBlogPosts.length > 0 && (
          <section className="px-5 py-16 sm:px-8 sm:py-20">
            <div className="mx-auto max-w-[880px] border-y border-[#e4e1d8] py-10">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">Guides</p>
              <h2 className="mt-5 text-[clamp(2.6rem,5vw,4.2rem)] leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>Read tech with less noise.</h2>
              <div className="mt-8 border-t border-[#e4e1d8]">
                {recentBlogPosts.map((post) => (
                  <Link key={post.href} href={post.href} className="group grid gap-3 border-b border-[#e4e1d8] py-5 hover:bg-[#f5f3ed] sm:grid-cols-[150px_minmax(0,1fr)] sm:px-3">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#75705f]">{post.date}</span>
                    <span className="text-[23px] leading-[1.15] group-hover:text-[#2557d6]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>{post.title}</span>
                  </Link>
                ))}
              </div>
              <Link href="/blog" className="mt-6 inline-block text-[13px] font-semibold text-[#2557d6]">All guides →</Link>
            </div>
          </section>
        )}

        <section className="px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-[880px] border-y border-[#e4e1d8] py-10">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">Questions</p>
            <h2 className="mt-5 text-[clamp(2.6rem,5vw,4.2rem)] leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>A few things to know.</h2>
            <div className="mt-8 border-t border-[#e4e1d8]">{FAQ_ITEMS.map((item) => <FaqItem key={item.q} {...item} />)}</div>
          </div>
        </section>

        <section className="px-5 pb-16 sm:px-8 sm:pb-20">
          <div className="mx-auto max-w-[880px] bg-[#2557d6] px-7 py-12 text-white sm:px-10 sm:py-16">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">Today’s edition is ready</p>
            <h2 className="mt-5 max-w-[620px] text-[clamp(2.7rem,5vw,4.6rem)] leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>Spend less time finding the story. Spend more time understanding it.</h2>
            <div className="mt-8 flex flex-wrap gap-4">
              <button type="button" onClick={() => startReading('bottom_cta')} className="bg-[#faf9f5] px-5 py-3 text-[14px] font-semibold text-[#1b1a17] hover:bg-white">Read today</button>
              <a href="/feed" className="border border-white/60 px-5 py-3 text-[14px] font-semibold text-white hover:bg-white/10">See an edition</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
