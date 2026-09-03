import React from 'react';
import Link from 'next/link';
import { Check, Loader2, Lock, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { trackCheckoutClicked, trackFeedSubscribeDialogShown, trackFeedProWelcomeShown, trackPaywallShown } from '@/lib/posthog';
import { LANDING_PRICING_BULLET_POINTS } from '@/lib/subscription-pricing-bullets';
import { ONBOARDING_INTERESTS } from '@/lib/firestore';
import {
  SUBSCRIPTION_COMPARE_AT_DEFAULT,
  SUBSCRIPTION_PRICE_DEFAULT,
  SUBSCRIPTION_PRICE_INDIA,
} from '@/lib/subscription-pricing';

function pricingBulletText(line: string): string {
  return line.replace(/^[\s\S]*?\s{2,}/, '').trim() || line;
}

function usePaywallImpression(source: string) {
  const ref = React.useRef<HTMLDivElement>(null);
  const tracked = React.useRef(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || tracked.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || tracked.current) return;
      tracked.current = true;
      trackPaywallShown(source);
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [source]);

  return ref;
}

function ProPaywallCard({
  trackingId,
  compact = false,
  title = 'Keep your daily brief going',
  subtitle = 'Stay on top of tech without reading 50 sources. Cancel anytime.',
}: {
  trackingId: string;
  compact?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const impressionRef = usePaywallImpression(trackingId);
  return (
    <div
      ref={impressionRef}
      className={`mx-auto w-full rounded-2xl border border-[#e5e7eb] bg-white/95 text-center shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm ${
        compact ? 'max-w-[320px] p-4' : 'max-w-md p-6'
      }`}
    >
      <p className={`font-bold tracking-[-0.02em] text-[#111827] ${compact ? 'text-[15px]' : 'text-[17px]'}`}>
        {title}
      </p>
      <p className={`mt-1.5 leading-relaxed text-[#6b7280] ${compact ? 'text-[12px]' : 'text-[14px]'}`}>
        {subtitle}
      </p>
      <ul className={`mt-4 space-y-2 text-left ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
        {(compact ? LANDING_PRICING_BULLET_POINTS.slice(0, 3) : LANDING_PRICING_BULLET_POINTS).map((line) => (
          <li key={line} className="flex items-start gap-2.5 text-[#374151]">
            <Check size={compact ? 12 : 13} className="mt-0.5 shrink-0 text-[#111827]/45" strokeWidth={2.5} />
            <span className="leading-snug">{pricingBulletText(line)}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/profile?tab=subscription&intent=checkout"
        prefetch={false}
        onClick={() => trackCheckoutClicked(trackingId)}
        className={`mt-5 inline-flex items-center justify-center rounded-full bg-[#111827] font-semibold text-white transition-all hover:bg-[#1f2937] ${
          compact ? 'px-4 py-2 text-[12px]' : 'px-6 py-2.5 text-sm'
        }`}
      >
        Get tomorrow&rsquo;s brief
      </Link>
    </div>
  );
}

const INDIA_PRICING = {
  priceDisplay: SUBSCRIPTION_PRICE_INDIA,
  compareAtPriceDisplay: null as string | null,
  pricingOffer: 'india' as const,
};
const DEFAULT_PRICING = {
  priceDisplay: SUBSCRIPTION_PRICE_DEFAULT,
  compareAtPriceDisplay: SUBSCRIPTION_COMPARE_AT_DEFAULT,
  pricingOffer: 'default' as const,
};

function guessClientPricing() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Kolkata') return INDIA_PRICING;
    const lang = (navigator.language || '').toLowerCase();
    if (lang === 'en-in' || lang.endsWith('-in')) return INDIA_PRICING;
  } catch {
    /* ignore */
  }
  return DEFAULT_PRICING;
}

/** Full-viewport click shield below the feed header: opens subscribe modal (logged-in, not subscribed) or sign-in prompt (unauthenticated). */
export function FeedSubscribeClickLock({ active, defaultOpen = false }: { active: boolean; defaultOpen?: boolean }) {
  const { user, signInWithGoogle } = useAuth();
  const [open, setOpen] = React.useState(false);
  const hasAutoOpened = React.useRef(false);

  React.useEffect(() => {
    if (!active || !defaultOpen || hasAutoOpened.current) return;
    hasAutoOpened.current = true;
    const t = setTimeout(() => {
      trackFeedProWelcomeShown({ pricing_offer: pricingPreview.pricingOffer, price_display: pricingPreview.priceDisplay });
      setOpen(true);
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, defaultOpen]);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [signInLoading, setSignInLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pricingPreview, setPricingPreview] = React.useState<typeof INDIA_PRICING | typeof DEFAULT_PRICING>(DEFAULT_PRICING);

  React.useEffect(() => {
    if (!active) return;
    setPricingPreview(guessClientPricing());
    let cancelled = false;
    const confirm = async () => {
      try {
        const token = await user?.getIdToken();
        const response = await fetch('/api/subscription/pricing', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setPricingPreview(data);
      } catch {
        /* non-fatal */
      }
    };
    void confirm();
    return () => {
      cancelled = true;
    };
  }, [active, user]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSubscribe = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    setError(null);
    trackCheckoutClicked('feed_subscribe_click_lock');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create checkout');
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setCheckoutLoading(false);
    }
  };

  const handleSignInToSubscribe = async () => {
    setSignInLoading(true);
    setError(null);
    const result = await signInWithGoogle('checkout', { rememberIntent: true });
    if (result.status === 'success') {
      // Sign-in succeeded, redirect to profile/subscription or let the post-auth redirect handle it
      window.location.href = '/profile?tab=subscription&intent=checkout';
    } else if (result.status === 'redirecting') {
      // Redirect-based sign-in in progress — page will reload
      return;
    } else if (result.status === 'error') {
      setError(result.message || 'Sign-in failed. Please try again.');
      setSignInLoading(false);
    } else {
      setError('Sign-in failed. Please try again.');
      setSignInLoading(false);
    }
  };

  if (!active) return null;

  return (
    <>
      {/* Covers viewport below sticky header (h-16); blocks all interaction with the feed. */}
      <div
        className="pointer-events-auto fixed inset-x-0 bottom-0 top-16 z-[80] cursor-pointer touch-none"
        aria-hidden
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          trackFeedSubscribeDialogShown({
            pricing_offer: pricingPreview.pricingOffer,
            price_display: pricingPreview.priceDisplay,
          });
          setOpen(true);
        }}
      />
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px] dark:bg-black/80 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feed-subscribe-lock-heading"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.18)] ring-1 ring-foreground/8 dark:ring-foreground/15"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full p-1.5 text-secondary/60 transition hover:bg-foreground/5 hover:text-foreground"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>

            {!user ? (
              <>
                <h2 id="feed-subscribe-lock-heading" className="text-[1.35rem] font-bold tracking-tight text-foreground leading-snug">
                  Try Trace Pro free for 3 days
                </h2>
                <p className="mt-2.5 text-[13px] leading-relaxed text-secondary/55">
                  Sign in to start your 3-day free trial. No charge until the trial ends.
                </p>
                <div className="mt-5 space-y-2.5">
                  {LANDING_PRICING_BULLET_POINTS.map((line) => (
                    <p key={line} className="text-[13px] font-medium leading-snug text-foreground/75">{line}</p>
                  ))}
                </div>
                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
                <button
                  type="button"
                  onClick={handleSignInToSubscribe}
                  disabled={signInLoading}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:opacity-60"
                >
                  {signInLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Signing in...
                    </>
                  ) : (
                    'Start your free trial →'
                  )}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full py-2 text-[13px] text-secondary/45 transition hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Maybe later
                </button>
              </>
            ) : (
              <>
                <h2 id="feed-subscribe-lock-heading" className="text-[1.35rem] font-bold tracking-tight text-foreground leading-snug">
                  Try Trace Pro free for 3 days
                </h2>
                <p className="mt-2.5 text-[13px] leading-relaxed text-secondary/55">
                  Get unlimited reads with no charge for 3 days. Cancel anytime.
                </p>
                <div className="mt-5 space-y-2.5">
                  {LANDING_PRICING_BULLET_POINTS.map((line) => (
                    <p key={line} className="text-[13px] font-medium leading-snug text-foreground/75">{line}</p>
                  ))}
                </div>
                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={checkoutLoading}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:opacity-60"
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Setting up...
                    </>
                  ) : (
                    'Start your free trial →'
                  )}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full py-2 text-[13px] text-secondary/45 transition hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Maybe later
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function InlineUnlockBanner({ storyCount, freeReadsUsed = 0 }: { storyCount: number; freeReadsUsed?: number }) {
  const limitReached = freeReadsUsed >= 3;
  return (
    <div className="mb-4 rounded-2xl border border-border/20 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/6">
            <Lock size={15} className="text-foreground/60" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {limitReached
                ? `${storyCount - 3 > 0 ? `${storyCount - 3} more stories waiting for you.` : 'Unlock the full feed.'}`
                : `Browse ${storyCount} stories. Read the first 3 free — unlock the rest with Pro.`}
            </p>
            <p className="mt-0.5 text-xs text-secondary/55">
              {limitReached
                ? 'Get tomorrow’s personalized brief and keep every story, takeaway, and source unlocked.'
                : `Free users can read the first 3 stories in today's feed.`}
            </p>
          </div>
        </div>
        <Link
          href="/profile?tab=subscription&intent=checkout"
          prefetch={false}
          onClick={() => trackCheckoutClicked('feed_inline_unlock_banner', { story_count: storyCount, free_reads_used: freeReadsUsed })}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90"
        >
          <Sparkles size={14} />
          Try Pro free for 3 days
        </Link>
      </div>
    </div>
  );
}

/* ─── Full-width Paywall Gate ─── */
export function PaywallGate() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Default on server; client guess applied in useEffect before API confirms
  const [pricingPreview, setPricingPreview] = React.useState<typeof INDIA_PRICING | typeof DEFAULT_PRICING>(DEFAULT_PRICING);

  // Still confirm with server in background (handles VPN / edge cases)
  React.useEffect(() => {
    let cancelled = false;
    // Apply client-side timezone/locale guess immediately (synchronous, no round-trip)
    setPricingPreview(guessClientPricing());
    const confirm = async () => {
      try {
        const token = await user?.getIdToken();
        const response = await fetch('/api/subscription/pricing', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setPricingPreview(data);
      } catch {}
    };
    void confirm();
    return () => { cancelled = true; };
  }, [user]);

  const handleSubscribe = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    trackCheckoutClicked('feed_paywall_gate');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create checkout');
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const benefits = [
    {
      title: 'Stay on top of tech without reading 50 sources',
      desc: 'Open one clear edition built from reporting across the web, then move on with your day.',
    },
    {
      title: 'Understand why each story matters',
      desc: 'Get the point, key takeaways, and useful context without reading the same news across ten tabs.',
    },
    {
      title: 'Read one version, not ten duplicates',
      desc: 'Trace groups coverage into one clear story and keeps the best sources attached.',
    },
    {
      title: 'Feel caught up, then move on',
      desc: 'Finish the brief, close the tab, and get back to your day.',
    },
    {
      title: 'Give your agent the same brief',
      desc: 'Connect AI tools and bots through read-only Agent Access.',
    },
  ];
  const planName = pricingPreview.pricingOffer === 'india' ? 'Trace Pro India' : 'Trace Pro';
  return (
    <div className="w-full sm:rounded-2xl sm:bg-surface sm:shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="max-w-md mx-auto px-6 sm:px-12 py-10 sm:py-16">
        <p className="text-[11px] font-semibold text-secondary/35 uppercase tracking-[0.18em] mb-5">{planName}</p>
        <h2 className="text-[1.65rem] font-bold text-foreground tracking-[-0.025em] leading-tight mb-3">
          Your five-minute tech brief,<br />ready every morning.
        </h2>
        <p className="text-[14px] text-secondary/50 mb-10 leading-relaxed">
          Try Trace Pro free for 3 days. No charge until the trial ends.
        </p>

        <div className="space-y-5 mb-10">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-3">
              <Check size={13} className="shrink-0 mt-[3px] text-foreground/40" strokeWidth={2.5} />
              <div>
                <p className="text-[13px] font-semibold text-foreground leading-snug">{b.title}</p>
                <p className="text-[12px] text-secondary/50 mt-0.5 leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full text-[13px] font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:shadow-md hover:shadow-black/10 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:scale-100"
        >
          {loading ? <><Loader2 size={14} className="animate-spin" />Setting up...</> : 'Start your free trial'}
        </button>
        <p className="text-[11px] text-secondary/35 mt-2.5 text-center">
          No charge for 3 days · Cancel anytime
        </p>
      </div>
    </div>
  );
}

export function FeedListPaywallCta() {
  return (
    <div className="pointer-events-auto sticky top-0 z-10 border-b border-[#e5e7eb]/60 bg-white/95 px-4 py-4 backdrop-blur-sm">
      <ProPaywallCard trackingId="feed_list_paywall" compact />
    </div>
  );
}

const INTEREST_LABEL_FALLBACK: Record<string, string> = Object.fromEntries(
  ONBOARDING_INTERESTS.map((interest) => [interest.id, interest.label]),
);

function formatInterestPhrase(labels: string[]): string | null {
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function resolveInterestLabels(interests: string[]): string[] {
  return interests
    .slice(0, 4)
    .map((id) => INTEREST_LABEL_FALLBACK[id] ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
}

/** Inline upgrade card shown after a live Pulse sample. */
export function PulseLockedPreview({
  interests = [],
}: {
  interests?: string[];
}) {
  const interestLabels = resolveInterestLabels(interests);
  const interestPhrase = formatInterestPhrase(interestLabels);
  const impressionRef = usePaywallImpression('pulse_locked');

  const included = [
    'Three distinct signals from X',
    'Top Hacker News discussions with context',
    'Trending repos with clear descriptions',
    'Long-form reads for builders',
  ];

  return (
    <div
      ref={impressionRef}
      className="mt-6 overflow-hidden rounded-2xl bg-[#111827] p-6 text-white shadow-[0_16px_40px_rgba(17,24,39,0.16)] sm:p-7"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Your full Pulse</p>
      <h2 className="mt-2 text-[22px] font-bold leading-tight tracking-[-0.025em]">
        This is a live sample. The rest is waiting.
      </h2>
      <p className="mt-2 max-w-[58ch] text-[13.5px] leading-relaxed text-white/65">
        Get the complete Pulse, refreshed throughout the day
        {interestPhrase ? ` and tuned to ${interestPhrase.toLowerCase()}` : ''}.
      </p>

      <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {included.map((line) => (
          <li key={line} className="flex items-start gap-2.5 text-[12.5px] leading-snug text-white/80">
            <Check size={13} className="mt-0.5 shrink-0 text-white/45" strokeWidth={2.5} />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-white/45">Free for 3 days · Cancel anytime</p>
        <Link
          href="/profile?tab=subscription&intent=checkout"
          prefetch={false}
          onClick={() => trackCheckoutClicked('pulse_locked')}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-[#111827] transition-colors hover:bg-white/90"
        >
          Try Pro free for 3 days
        </Link>
      </div>
    </div>
  );
}

export function MediumPaywallGate({
  trackingId = 'feed_medium_paywall',
}: {
  trackingId?: string;
}) {
  return (
    <div className="mt-8 border-t border-[#e5e7eb] pt-8">
      <ProPaywallCard trackingId={trackingId} />
    </div>
  );
}

/** @deprecated Use MediumPaywallGate */
export function FeedLockedStoryPanel({
  item,
}: {
  item: { title: string; preview?: string; thumbnail?: string | null };
}) {
  return (
    <div className="mt-7">
      {item.preview && (
        <p className="text-[15.5px] leading-[1.7] text-[#374151]">{item.preview}</p>
      )}
      <MediumPaywallGate trackingId="feed_locked_story_panel" />
    </div>
  );
}

export function FreeBlurGate({ hiddenCount, noun = 'stories' }: { hiddenCount: number; noun?: string }) {
  if (hiddenCount <= 0) return null;

  return (
    <div className="mt-4">
      <ProPaywallCard
        trackingId="feed_blur_gate"
        compact
        title={`${hiddenCount} more ${noun} in today’s brief`}
        subtitle="Get the full signal free for 3 days. Cancel anytime."
      />
    </div>
  );
}
