"use client";

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, MessagesSquare, Newspaper, Rocket, Smartphone, Zap, type LucideIcon } from 'lucide-react';
import {
  consumePendingPostAuthIntent,
  getPostAuthDestination,
  peekPendingPostAuthIntent,
  useAuth,
} from '@/contexts/AuthContext';
import { getSignedInLandingDestination } from '@/lib/landing-routing';
import { trackLandingCTAClicked } from '@/lib/posthog';
import Footer from '@/components/Footer';
import HomeEditionPreview from './HomeEditionPreview';
import AgentAccessLanding from '@/components/AgentAccessLanding';
import type { V3UserFeed } from '@/lib/firestore';
import {
  HOME_COMPARISON_ROWS,
  HOME_FAQ_ITEMS,
  HOME_INTENT_LINKS,
} from '@/lib/home-seo';
import { SUBSCRIPTION_PRICE_DEFAULT } from '@/lib/subscription-pricing';

const SOURCES = [
  'Hacker News', 'GitHub', 'Simon Willison', 'AI Engineer', 'Theo', 'Fireship',
  'Latent Space', 'Google DeepMind', 'Hugging Face', 'Product Hunt', 'The Pragmatic Engineer', 'and more',
];

const DIRECTORY_BADGES = [
  {
    name: 'Startup List',
    href: 'https://www.startup-list.org/startup/trace',
  },
  {
    name: 'Featured on Startup Spotlight',
    href: 'https://startupspotlight.co/startup/trace',
    imageSrc: 'https://startupspotlight.co/api/badge/cmrydmpan002315qal6gqvzps?variant=dark&v=2',
  },
];

const SURFACES: { icon: LucideIcon; label: string; title: string; body: string }[] = [
  { icon: Newspaper, label: '01 · News', title: 'Important tech news', body: 'Short summaries of important technology and AI news.' },
  { icon: Rocket, label: '02 · Projects', title: 'Projects and tools', body: 'Open-source repositories, product launches, and developer tools people are using.' },
  { icon: MessagesSquare, label: '03 · Discussions', title: 'Technical discussions', body: 'Current discussions from Hacker News, Lobsters, and other builder communities.' },
  { icon: Zap, label: '04 · Videos and articles', title: 'Videos and articles', body: 'Summaries and key takeaways from technical videos and independent writers.' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const answerId = useId();
  return (
    <div className="border-b border-[#e4e1d8] last:border-0">
      <button
        type="button"
        aria-controls={answerId}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[16px] font-medium">{q}</span>
        <ChevronDown size={16} className={'text-[#75705f] transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      <p id={answerId} hidden={!open} className="max-w-[640px] pb-5 text-[14px] leading-[1.7] text-[#75705f]">{a}</p>
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
    if (loading || !user) return;
    const destination = getSignedInLandingDestination(
      profile,
      profileResolved,
      peekPendingPostAuthIntent(),
    );
    if (!destination) return;
    consumePendingPostAuthIntent();
    router.replace(destination);
  }, [user, loading, profileResolved, profile, router]);

  const startReading = async (location: string) => {
    trackLandingCTAClicked('read', location, { destination: 'feed' });
    if (user) {
      router.push(getPostAuthDestination(profile, 'read'));
      return;
    }
    const result = await signInWithGoogle('read');
    if (result.status === 'success') router.push(getPostAuthDestination(result.profile, result.intent));
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

  if (user) return <div className="min-h-screen bg-[#faf9f5]" />;

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#1b1a17]">
      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="trace-auth-loading-cover fixed inset-0 z-[100] bg-[#faf9f5]"
        >
          <span className="sr-only">Checking your session</span>
        </div>
      )}
      <noscript>
        <style>{'.trace-auth-loading-cover{display:none!important}.trace-auth-home-content{visibility:visible!important}'}</style>
      </noscript>
      <div className={`trace-auth-home-content ${loading ? 'invisible' : ''}`}>
        <header className="bg-[#faf9f5]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between border-b border-[#e4e1d8] px-4 py-4 sm:px-16 lg:px-24">
          <Link href="/" className="font-mono text-[12.5px] font-bold tracking-[0.28em]">TRACE</Link>
          <nav className="hidden items-center gap-5 text-[13px] text-[#75705f] sm:flex">
            <a href="/feed?view=pulse" className="hover:text-[#2557d6]">Pulse</a>
            <a href="/feed?view=edition" className="hover:text-[#2557d6]">Edition</a>
            <Link href="/compare" className="hover:text-[#2557d6]">Compare</Link>
            <Link href="/blog" className="hover:text-[#2557d6]">Guides</Link>
            <Link href="/resources" className="hover:text-[#2557d6]">Resources</Link>
            <Link href="/agents" className="hover:text-[#2557d6]">Agents</Link>
          </nav>
          <button type="button" onClick={() => void signIn()} className="border border-[#2557d6] px-3.5 py-1.5 text-[12px] font-semibold text-[#2557d6] hover:bg-[#2557d6] hover:text-white">Sign in</button>
        </div>
      </header>
      <div>
        <a
          href="/api/affiliate/outbound?target=android_app&next=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Donline.yourtrace.app"
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto flex max-w-[1500px] items-center justify-between border-b border-[#e4e1d8] px-4 py-3 text-[12px] text-[#75705f] transition-colors hover:text-[#2557d6] sm:px-16 lg:px-24"
        >
          <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">
            <Smartphone size={14} strokeWidth={1.8} className="text-[#2557d6]" />
            Trace for Android
          </span>
          <span>Get the app on Google Play →</span>
        </a>
      </div>

      <main>
        <section className="pb-16 pt-16 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-[1500px] px-4 sm:px-16 lg:px-24">
            <div className="grid items-center gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">Tech · AI · Open source · Updated hourly</p>
                <h1
                  className="mt-6 max-w-[800px] tracking-[-0.04em]"
                  style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif', fontSize: 'clamp(3rem, 5vw, 4.5rem)', lineHeight: 1.08 }}
                >
                  The fastest way to catch up on AI &amp; Tech
                </h1>
                <p className="mt-6 max-w-[620px] text-[16px] leading-[1.7] text-[#75705f] sm:text-[18px]">
                  Trace is a focused AI and developer news aggregator. Read technology news, open-source projects, technical discussions, videos, and independent writing in one source-linked feed.
                </p>
                <div className="mt-8">
                  <button type="button" onClick={() => startReading('hero')} className="bg-[#2557d6] px-5 py-3 text-[14px] font-semibold text-white hover:bg-[#1d48b4]">Explore today&rsquo;s feed</button>
                </div>
              </div>
              <Image
                src="/trace-feed-hero.svg"
                alt="Technology sources converging into one concise feed"
                width={620}
                height={480}
                priority
                className="hidden w-full max-w-sm justify-self-start lg:col-span-1 lg:block"
              />
            </div>
            <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#75705f]">
              {SOURCES.map((source) => <span key={source}>{source}</span>)}
            </div>
          </div>
        </section>

        <section className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-[1500px] border-t border-[#e4e1d8] px-4 pt-8 sm:px-16 lg:px-24">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">What builders are watching now</p>
            <div className="mt-5"><HomeEditionPreview feed={editionFeed} /></div>
            <p className="mt-5 max-w-[620px] text-[13px] leading-[1.65] text-[#75705f]">
              Want the calmer version? Trace also sends one daily email with the technology and AI stories worth knowing.
            </p>
          </div>
        </section>

        <AgentAccessLanding feed={editionFeed} />

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-[1500px] border-y border-[#e4e1d8] px-4 py-10 sm:px-16 lg:px-24">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">How Trace works</p>
            <h2 className="mt-5 max-w-[700px] text-[clamp(2.6rem,5vw,4.2rem)] leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>New tech stories throughout the day.</h2>
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

        <section className="py-16 sm:py-20" aria-labelledby="trace-comparison-title">
          <div className="mx-auto max-w-[1500px] border-y border-[#e4e1d8] px-4 py-10 sm:px-16 lg:px-24">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">One feed, less tab-hopping</p>
            <h2 id="trace-comparison-title" className="mt-5 max-w-[760px] text-[clamp(2.6rem,5vw,4.2rem)] leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>Trace vs. following every source manually.</h2>
            <p className="mt-5 max-w-[680px] text-[15px] leading-[1.7] text-[#75705f]">Trace keeps the original sources while removing the repetitive work of checking each channel separately.</p>
            <div className="mt-9 overflow-x-auto border border-[#e4e1d8]">
              <table className="w-full min-w-[720px] border-collapse text-left text-[14px] leading-[1.6]">
                <thead className="bg-[#f5f3ed] font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#75705f]">
                  <tr>
                    <th scope="col" className="w-[20%] px-5 py-4">Comparison</th>
                    <th scope="col" className="w-[40%] px-5 py-4">Manual monitoring</th>
                    <th scope="col" className="w-[40%] px-5 py-4 text-[#2557d6]">Trace</th>
                  </tr>
                </thead>
                <tbody>
                  {HOME_COMPARISON_ROWS.map((row) => (
                    <tr key={row.label} className="border-t border-[#e4e1d8] align-top">
                      <th scope="row" className="px-5 py-5 font-semibold text-[#1b1a17]">{row.label}</th>
                      <td className="px-5 py-5 text-[#75705f]">{row.manual}</td>
                      <td className="px-5 py-5 text-[#1b1a17]">{row.trace}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav aria-label="Explore Trace by goal" className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-[13px] font-semibold text-[#2557d6]">
              {HOME_INTENT_LINKS.map((link) => <Link key={link.href} href={link.href}>{link.label} →</Link>)}
            </nav>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-[1500px] px-4 sm:px-16 lg:px-24">
            <div className="grid overflow-hidden border border-[#e4e1d8] bg-[#faf9f5] md:grid-cols-[minmax(0,1fr)_360px]">
              <div className="p-7 sm:p-10 lg:p-12">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">Trace Pro</p>
                <h2 className="mt-5 max-w-[600px] text-[clamp(2.4rem,4vw,3.8rem)] leading-[1] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>Read the complete feed.</h2>
                <p className="mt-5 max-w-[600px] text-[16px] leading-[1.7] text-[#75705f]">Get every news story, project, discussion, video summary, key takeaway, and source link.</p>
              </div>
              <div className="flex flex-col justify-center bg-[#2557d6] p-7 text-white sm:p-10">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">3 days on us</p>
                <p className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em]">Try Trace Pro free</p>
                <p className="mt-3 text-[14px] font-medium text-white/90">3 days free, then {SUBSCRIPTION_PRICE_DEFAULT}</p>
                <button type="button" onClick={() => subscribe('pro')} className="mt-7 bg-white px-5 py-3 text-[14px] font-semibold text-[#2557d6] hover:bg-[#f5f3ed]">Start your free trial</button>
                <p className="mt-3 text-center text-[12px] text-white/70">No charge for 3 days · Cancel anytime.</p>
              </div>
            </div>
          </div>
        </section>

        {recentBlogPosts.length > 0 && (
          <section className="py-16 sm:py-20">
            <div className="mx-auto max-w-[1500px] border-y border-[#e4e1d8] px-4 py-10 sm:px-16 lg:px-24">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">Guides</p>
              <h2 className="mt-5 text-[clamp(2.6rem,5vw,4.2rem)] leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>Guides to tech news apps.</h2>
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

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-[1500px] border-y border-[#e4e1d8] px-4 py-10 sm:px-16 lg:px-24">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">Questions</p>
            <h2 className="mt-5 text-[clamp(2.6rem,5vw,4.2rem)] leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>A few things to know.</h2>
            <div className="mt-8 border-t border-[#e4e1d8]">{HOME_FAQ_ITEMS.map((item) => <FaqItem key={item.q} {...item} />)}</div>
          </div>
        </section>

        <section className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-[1500px] bg-[#2557d6] px-4 py-12 text-white sm:px-16 sm:py-16 lg:px-24">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">Today’s tech news is ready</p>
            <h2 className="mt-5 max-w-[620px] text-[clamp(2.7rem,5vw,4.6rem)] leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif' }}>Read today&rsquo;s tech news in five minutes.</h2>
            <div className="mt-8 flex flex-wrap gap-4">
              <button type="button" onClick={() => startReading('bottom_cta')} className="bg-[#faf9f5] px-5 py-3 text-[14px] font-semibold text-[#1b1a17] hover:bg-white">Read today</button>
              <a href="/feed?view=edition" className="border border-white/60 px-5 py-3 text-[14px] font-semibold text-white hover:bg-white/10">See an edition</a>
            </div>
          </div>
        </section>
      </main>
        <Footer directoryBadges={DIRECTORY_BADGES} />
      </div>
    </div>
  );
}
