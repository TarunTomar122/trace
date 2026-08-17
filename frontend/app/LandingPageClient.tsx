"use client";

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ChevronDown, Chrome, ExternalLink, Layers3, Newspaper, Share2, Smartphone, Sparkles } from 'lucide-react';
import {
  consumePendingPostAuthIntent,
  getPostAuthDestination,
  peekPendingPostAuthIntent,
  useAuth,
} from '@/contexts/AuthContext';
import { getSignedInLandingDestination } from '@/lib/landing-routing';
import { trackLandingCTAClicked } from '@/lib/posthog';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';
import AgentAccessLanding from '@/components/AgentAccessLanding';
import HomeEditionPreview from './HomeEditionPreview';
import type { V3UserFeed } from '@/lib/firestore';
import { HOME_FAQ_ITEMS } from '@/lib/home-seo';
import { CHROME_EXTENSION_URL } from '@/lib/product-links';
import { SUBSCRIPTION_PRICE_DEFAULT } from '@/lib/subscription-pricing';

const CHROME_CTA_LABEL = 'Add Chrome Extension';
const CHROME_EXTENSION_AVAILABLE = true;
const ANDROID_URL = '/api/affiliate/outbound?target=android_app&next=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Donline.yourtrace.app';

const HERO_COMPANY_LOGOS = [
  { name: 'TechCrunch', src: 'https://cdn.simpleicons.org/techcrunch/00B289' },
  { name: 'Hacker News', src: 'https://cdn.simpleicons.org/ycombinator/FF6600' },
  { name: 'Reddit', src: 'https://cdn.simpleicons.org/reddit/FF4500' },
  { name: 'Product Hunt', src: 'https://cdn.simpleicons.org/producthunt/DA552F' },
  { name: 'X', src: 'https://cdn.simpleicons.org/x/181815' },
  { name: 'YouTube', src: 'https://cdn.simpleicons.org/youtube/FF0000' },
  { name: 'Bluesky', src: 'https://cdn.simpleicons.org/bluesky/1185FE' },
  { name: 'Substack', src: 'https://cdn.simpleicons.org/substack/FF6719' },
  { name: 'DEV Community', src: 'https://cdn.simpleicons.org/devdotto/181815' },
];

const DIRECTORY_BADGES = [
  { name: 'Startup List', href: 'https://www.startup-list.org/startup/trace' },
  {
    name: 'Featured on Startup Spotlight',
    href: 'https://startupspotlight.co/startup/trace',
    imageSrc: 'https://startupspotlight.co/api/badge/cmrydmpan002315qal6gqvzps?variant=dark&v=2',
  },
];

const HOW_IT_WORKS = [
  {
    icon: Newspaper,
    title: 'Find the signal',
    body: 'We collect reporting about model releases, company changes, layoffs, security, policy, and the trends shaping technology.',
  },
  {
    icon: Layers3,
    title: 'Group the noise',
    body: 'When several publications report the same event, Trace puts that coverage into one story and keeps the original links attached.',
  },
  {
    icon: Sparkles,
    title: 'Make it yours',
    body: CHROME_EXTENSION_AVAILABLE
      ? 'Open Trace in a new Chrome tab, use the web feed, or read it on Android. Your interests decide what appears first.'
      : 'Use the web feed or read Trace on Android. Your interests decide what appears first, with the Chrome new tab experience coming soon.',
  },
];

const FREE_FEATURES = [
  'A personalized AI and tech news feed',
  CHROME_EXTENSION_AVAILABLE ? '30 headlines in every new Chrome tab' : '30 headlines in your daily feed',
  'Three unique AI summaries every day',
  'Unlimited original source links',
  'Topic filters for the stories you follow',
  'Bookmarks with a free Trace account',
];

const PRO_FEATURES = [
  'Unlimited AI summaries in the web feed',
  'Search your complete saved archive',
  'The complete daily news archive',
  'Full personalized Pulse and Edition',
  'Read-only Agent Access',
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const answerId = useId();
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        aria-controls={answerId}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[16px] font-semibold text-foreground">{q}</span>
        <ChevronDown size={16} className={`shrink-0 text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <p id={answerId} hidden={!open} className="max-w-[680px] pb-5 text-[14px] leading-[1.7] text-secondary">{a}</p>
    </div>
  );
}

export default function LandingPageClient({ editionFeed = null }: { editionFeed?: V3UserFeed | null }) {
  const router = useRouter();
  const { user, profile, loading, profileResolved, signInWithGoogle } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    const destination = getSignedInLandingDestination(profile, profileResolved, peekPendingPostAuthIntent());
    if (!destination) return;
    consumePendingPostAuthIntent();
    router.replace(destination);
  }, [user, loading, profileResolved, profile, router]);

  const openWebFeed = (location: string) => {
    trackLandingCTAClicked('read', location, { destination: 'feed' });
    router.push(user ? getPostAuthDestination(profile, 'read') : '/feed');
  };

  const subscribe = async (location: string) => {
    trackLandingCTAClicked('subscribe', location);
    if (user && profileResolved) {
      router.push(getPostAuthDestination(profile, 'checkout'));
      return;
    }
    const result = await signInWithGoogle('checkout');
    if (result.status === 'success') router.push(getPostAuthDestination(result.profile, result.intent));
  };

  const signIn = async () => {
    const result = await signInWithGoogle('read');
    if (result.status === 'success') router.push(getPostAuthDestination(result.profile, result.intent));
  };

  if (user) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {loading && (
        <div role="status" aria-live="polite" className="trace-auth-loading-cover fixed inset-0 z-[100] bg-background">
          <span className="sr-only">Checking your session</span>
        </div>
      )}
      <noscript><style>{'.trace-auth-loading-cover{display:none!important}.trace-auth-home-content{visibility:visible!important}'}</style></noscript>

      <div className={`trace-auth-home-content ${loading ? 'invisible' : ''}`}>
        <PublicHeader
          rightSlot={<button type="button" onClick={() => void signIn()} className="inline-flex min-h-11 items-center rounded-full border border-foreground/15 bg-transparent px-5 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-secondary" style={{ whiteSpace: 'nowrap' }}>Sign in</button>}
        />

        <main>
          <section className="px-4 pb-16 pt-16 sm:px-8 sm:pb-28 sm:pt-28 lg:px-12 lg:pt-32">
            <div className="mx-auto max-w-[1160px] text-center">
              <div aria-label="Companies shaping the AI and tech news Trace follows" className="mx-auto flex items-center justify-center gap-3 sm:gap-7">
                {HERO_COMPANY_LOGOS.map((logo) => (
                  <img key={logo.name} src={logo.src} alt={logo.name} className="h-5 w-5 shrink-0 object-contain sm:h-8 sm:w-8" />
                ))}
              </div>
              <h1 className="mx-auto mt-10 max-w-[900px] text-balance font-semibold tracking-[-0.045em] sm:mt-12" style={{ fontSize: 'clamp(2rem, 10vw, 3.75rem)', lineHeight: 1.02 }}>
                The fastest way to catch up<br />
                on tech and AI news
              </h1>
              <p className="mx-auto mt-7 max-w-[760px] text-pretty font-medium text-secondary" style={{ fontSize: 'clamp(1rem, 1.2vw, 1.2rem)', lineHeight: 1.55 }}>
                Tech news from multiple sources, grouped and summarised in one feed.
              </p>
              <div className="mt-10 flex justify-center">
                <a
                  href={CHROME_EXTENSION_URL}
                  onClick={() => trackLandingCTAClicked('read', 'hero_chrome', { destination: 'chrome_extension' })}
                  className="inline-flex min-h-11 w-full max-w-[360px] items-center justify-center gap-3 rounded-full px-6 py-4 text-center text-[16px] font-semibold transition-opacity hover:opacity-85 sm:w-auto sm:max-w-none sm:whitespace-nowrap sm:px-10 sm:text-[18px]"
                  style={{ backgroundColor: '#181815', color: '#f7f4ec' }}
                >
                  <Chrome size={20} /> {CHROME_CTA_LABEL} <ArrowRight size={21} />
                </a>
              </div>
              <button type="button" onClick={() => openWebFeed('hero_web')} className="mt-4 inline-flex min-h-11 items-center text-[14px] font-medium text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-foreground">
                Prefer the web feed? Open it here
              </button>
            </div>
          </section>

          <section id="demo" className="scroll-mt-24 px-4 pb-20 sm:px-8 sm:pb-28 lg:px-12">
            <div className="mx-auto max-w-[1280px]">
              <div className="mx-auto mb-8 max-w-[700px] text-center">
                <div className="flex items-center justify-center gap-3">
                  <h2 className="-translate-y-4 text-balance text-[clamp(1.5rem,6vw,2.25rem)] font-semibold leading-[1.1] tracking-[-0.025em]">Your next Chrome tab</h2>
                  <svg aria-hidden="true" viewBox="0 0 44 32" className="h-8 w-11 text-accent" fill="none">
                    <path d="M5 4c10 0 20 5 19 16-0.2 3-1 5-2 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="m15 22 7 6 7-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <HomeEditionPreview feed={editionFeed} />
            </div>
          </section>

          <section id="how" className="scroll-mt-24 border-y border-border bg-surface-secondary/45 px-4 py-20 sm:px-8 sm:py-28 lg:px-12">
            <div className="mx-auto max-w-[1280px]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">How Trace works</p>
                  <h2 className="mt-4 max-w-[700px] text-balance font-semibold leading-[1.05] tracking-[-0.035em]" style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}>A calmer way to catch up.</h2>
                </div>
                <p className="max-w-[250px] text-[14px] leading-[1.65] text-secondary sm:text-right">Three small steps between you and the stories worth your time.</p>
              </div>
              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {HOW_IT_WORKS.map(({ icon: Icon, title, body }, index) => (
                  <article key={title} className="relative overflow-hidden rounded-[24px] bg-surface p-6 shadow-[0_2px_12px_rgba(24,24,21,0.04)] ring-1 ring-foreground/6 dark:ring-white/8 sm:p-8">
                    <span aria-hidden="true" className="absolute -right-5 -top-5 size-20 rounded-full bg-accent/5" />
                    <div className="relative flex items-center justify-between">
                      <span className="flex size-11 items-center justify-center rounded-full bg-background text-accent ring-1 ring-border/70"><Icon size={18} strokeWidth={1.8} /></span>
                      <span className="rounded-full bg-background px-2.5 py-1 font-mono text-[10px] font-semibold text-secondary ring-1 ring-border/60">0{index + 1}</span>
                    </div>
                    <h3 className="relative mt-7 text-[20px] font-semibold tracking-[-0.025em]">{title}</h3>
                    <p className="relative mt-3 text-[14px] leading-[1.7] text-secondary">{body}</p>
                  </article>
                ))}
              </div>
              <p className="mt-7 text-[13px] text-secondary">Read in Chrome or open the same feed on the web.</p>
            </div>
          </section>

          <section className="px-4 py-20 sm:px-8 sm:py-28 lg:px-12">
            <div className="mx-auto max-w-[1080px]">
              <div className="text-center">
                <h2 className="text-balance font-semibold leading-[1.1] tracking-[-0.025em]" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>Your feed. Everywhere.</h2>
              </div>
              <div className="mt-12 grid gap-5 md:grid-cols-2">
                <article className="rounded-[20px] bg-surface p-7 ring-1 ring-foreground/8 sm:p-9">
                  <Smartphone size={20} className="text-accent" />
                  <h3 className="mt-6 text-[17px] font-semibold">Trace for Android</h3>
                  <p className="mt-3 max-w-[430px] text-pretty text-[14px] leading-[1.7] text-secondary">Get your AI and technology feed in the Trace Android app, with the same stories ready whenever you have five minutes.</p>
                  <a href={ANDROID_URL} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-[13px] font-semibold text-background">Get it on Google Play <ExternalLink size={14} /></a>
                </article>
                <article className="rounded-[20px] bg-surface p-7 ring-1 ring-foreground/8 sm:p-9">
                  <Share2 size={20} className="text-accent" />
                  <h3 className="mt-6 text-[17px] font-semibold">Trace on iPhone and iPad</h3>
                  <p className="mt-3 max-w-[430px] text-pretty text-[14px] leading-[1.7] text-secondary">Open Trace in Safari, tap Share, then choose Add to Home Screen. You will get an app-like shortcut that opens your web feed.</p>
                  <button type="button" onClick={() => openWebFeed('mobile_ios')} className="mt-7 rounded-full border border-border bg-background px-5 py-3 text-[13px] font-semibold hover:bg-surface-secondary">Open the web feed</button>
                </article>
              </div>
            </div>
          </section>

          <section id="about" className="px-4 py-20 sm:px-8 sm:py-28 lg:px-12">
            <div className="mx-auto max-w-[900px] rounded-[28px] bg-surface p-7 shadow-[0_2px_16px_rgba(24,24,21,0.06)] ring-1 ring-foreground/8 sm:p-12">
              <div className="mb-7 flex justify-center">
                <Image src="/tarat-avatar.jpg" width={96} height={96} alt="Tarat" className="size-24 rounded-full object-cover ring-4 ring-accent/15" />
              </div>
              <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">A note from the person behind Trace</p>
              <h2 className="mx-auto mt-5 max-w-[720px] text-center text-balance text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.035em]">Hey, I am Tarat.</h2>
              <div className="mx-auto mt-8 max-w-[720px] space-y-5 text-[16px] leading-[1.75] text-secondary">
                <p>Trace is the first solo indie app I’ve built and launched. I put it out at the end of January 2026, and it got so much traction on Product Hunt that I decided to keep going.</p>
                <p>Six months in, the app has changed a lot. I read every bit of feedback I can get and genuinely love working on it, making Trace more useful, clearer, and more worth opening for the people who use it.</p>
                <p>On the personal side, I’m starting my master’s in AI at the University of Edinburgh this September. So anything you spend on Trace helps me keep building while I figure out student life and, honestly, survive it.</p>
                <p>If you’re into investing or the US stock market, I also make <a href="https://stocksbrew.online" target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline decoration-border underline-offset-4 hover:text-accent">StocksBrew</a>. You can find more about me and the other things I’m building at <a href="https://www.tarat.space" target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline decoration-border underline-offset-4 hover:text-accent">tarat.space</a>.</p>
                <p>I’m a human, promise. For anything, feedback, ideas, bugs, or just a hello, email me at <a href="mailto:tomartarun2001@gmail.com" className="font-semibold text-foreground underline decoration-border underline-offset-4 hover:text-accent">tomartarun2001@gmail.com</a>.</p>
              </div>
            </div>
          </section>

          <section id="pricing" className="scroll-mt-24 px-4 py-20 sm:px-8 sm:py-28 lg:px-12">
            <div className="mx-auto max-w-[1080px]">
              <div className="text-center">
                <h2 className="text-balance font-semibold leading-[1.1] tracking-[-0.025em]" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>Start free. Go further.</h2>
              </div>
              <div className="mt-12 grid gap-5 md:grid-cols-2">
                <article className="rounded-[20px] bg-surface p-7 ring-1 ring-foreground/8 sm:p-9">
                  <p className="text-[12px] font-medium text-secondary">Free</p>
                  <p className="mt-4 text-[42px] font-semibold tracking-[-0.05em]">$0</p>
                  <p className="mt-2 text-[14px] text-secondary">Use Trace every day without paying.</p>
                  <ul className="mt-8 space-y-3">
                    {FREE_FEATURES.map((feature) => <li key={feature} className="flex gap-3 text-[14px] leading-[1.5]"><Check size={16} className="mt-0.5 shrink-0 text-accent" />{feature}</li>)}
                  </ul>
                  <button type="button" onClick={() => openWebFeed('pricing_free')} className="mt-9 w-full rounded-full border border-border bg-background px-5 py-3 text-[14px] font-semibold hover:bg-surface-secondary">Start reading free</button>
                </article>

                <article className="rounded-[20px] bg-foreground p-7 text-background ring-1 ring-foreground sm:p-9">
                  <p className="text-[12px] font-medium opacity-75">Trace Pro</p>
                  <div className="mt-4 flex items-end gap-2"><p className="text-[42px] font-semibold tracking-[-0.05em]">{SUBSCRIPTION_PRICE_DEFAULT.replace('/month', '')}</p><span className="pb-2 text-[13px] opacity-65">per month</span></div>
                  <p className="mt-2 text-[14px] opacity-70">Less than a coffee. Three days free.</p>
                  <ul className="mt-8 space-y-3">
                    {PRO_FEATURES.map((feature) => <li key={feature} className="flex gap-3 text-[14px] leading-[1.5]"><Check size={16} className="mt-0.5 shrink-0" />{feature}</li>)}
                  </ul>
                  <button type="button" onClick={() => void subscribe('pricing_pro')} className="mt-9 w-full rounded-full bg-background px-5 py-3 text-[14px] font-semibold text-foreground hover:opacity-90">Try Pro free for 3 days</button>
                </article>
              </div>
            </div>
          </section>

          <AgentAccessLanding feed={editionFeed} />

          <section id="questions" className="scroll-mt-24 border-y border-border bg-surface px-4 py-20 sm:px-8 sm:py-24 lg:px-12">
            <div className="mx-auto max-w-[880px]">
              <h2 className="text-balance text-[clamp(2.2rem,4vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.035em]">A few things to know.</h2>
              <div className="mt-10 border-t border-border">{HOME_FAQ_ITEMS.map((item) => <FaqItem key={item.q} {...item} />)}</div>
            </div>
          </section>

          <section className="px-4 py-20 sm:px-8 sm:py-28 lg:px-12">
            <div className="mx-auto max-w-[1000px] rounded-[24px] bg-foreground px-5 py-14 text-center text-background sm:px-12 sm:py-20">
              <Chrome size={22} className="mx-auto opacity-70" />
              <h2 className="mx-auto mt-6 max-w-[700px] text-balance text-[clamp(2.2rem,4vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.035em]">Your next tab can catch you up.</h2>
              <p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-[1.7] opacity-70">Get major AI and technology stories in a feed that takes minutes to finish.</p>
              <a href={CHROME_EXTENSION_URL} onClick={() => trackLandingCTAClicked('read', 'bottom_chrome', { destination: 'chrome_extension' })} className="mt-8 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-background px-5 py-3.5 text-center text-[14px] font-semibold text-foreground sm:w-auto"><Chrome size={17} /> {CHROME_CTA_LABEL}</a>
            </div>
          </section>
        </main>

        <Footer directoryBadges={DIRECTORY_BADGES} />
      </div>
    </div>
  );
}
