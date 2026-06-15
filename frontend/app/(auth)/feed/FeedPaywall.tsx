import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Check, Flame, Github, Loader2, Lock, MessageSquare, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { trackCheckoutClicked, trackFeedSubscribeDialogShown, trackFeedProWelcomeShown } from '@/lib/posthog';
import { LANDING_PRICING_BULLET_POINTS } from '@/lib/subscription-pricing-bullets';
import { ONBOARDING_INTERESTS, ROLES } from '@/lib/firestore';
import {
  SUBSCRIPTION_COMPARE_AT_DEFAULT,
  SUBSCRIPTION_PRICE_DEFAULT,
  SUBSCRIPTION_PRICE_INDIA,
} from '@/lib/subscription-pricing';
import SubscriptionPrice from '@/components/SubscriptionPrice';

function pricingBulletText(line: string): string {
  return line.replace(/^[\s\S]*?\s{2,}/, '').trim() || line;
}

function ProPaywallCard({
  trackingId,
  compact = false,
  title = 'Keep reading with Trace Pro',
  subtitle = 'Cancel anytime',
}: {
  trackingId: string;
  compact?: boolean;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div
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
        href="/profile?tab=subscription"
        prefetch={false}
        onClick={() => trackCheckoutClicked(trackingId)}
        className={`mt-5 inline-flex items-center justify-center rounded-full bg-[#111827] font-semibold text-white transition-all hover:bg-[#1f2937] ${
          compact ? 'px-4 py-2 text-[12px]' : 'px-6 py-2.5 text-sm'
        }`}
      >
        Subscribe to Pro
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

/* ─── Upgrade CTA Card ─── */
function UpgradeCard({ lockedCount }: { lockedCount: number }) {
  return (
    <div className="p-4 mx-5 my-3 rounded-xl bg-linear-to-br from-foreground/5 to-foreground/10 border border-foreground/8">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center">
          <Lock size={14} className="text-foreground/60" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{lockedCount}+ more stories</p>
          <p className="text-[11px] text-secondary/50">Unlock with Pro</p>
        </div>
      </div>
      <Link
        href="/profile?tab=subscription"
        prefetch={false}
        onClick={() => trackCheckoutClicked('feed_upgrade_card_trending', { locked_count: lockedCount })}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98]"
      >
        <Sparkles size={14} />
        Upgrade to Pro
      </Link>
    </div>
  );
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
      window.location.href = '/profile?tab=subscription';
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px] dark:bg-black/70 sm:p-6"
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
                  Unlock Trace Pro
                </h2>
                <p className="mt-2.5 text-[13px] leading-relaxed text-secondary/55">
                  Sign in to subscribe. Get unlimited reads at{' '}
                  <SubscriptionPrice
                    price={pricingPreview.priceDisplay}
                    compareAt={pricingPreview.compareAtPriceDisplay}
                    size="sm"
                  />
                  . Cancel anytime.
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
                    'Subscribe to Pro →'
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
                  Unlock Trace Pro
                </h2>
                <p className="mt-2.5 text-[13px] leading-relaxed text-secondary/55">
                  Get unlimited reads at{' '}
                  <SubscriptionPrice
                    price={pricingPreview.priceDisplay}
                    compareAt={pricingPreview.compareAtPriceDisplay}
                    size="sm"
                  />
                  . Cancel anytime.
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
                    'Subscribe to Pro →'
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
                ? 'Upgrade to Pro for unlimited articles, key takeaways, and source links.'
                : `Free users can read the first 3 stories in today's feed.`}
            </p>
          </div>
        </div>
        <Link
          href="/profile?tab=subscription"
          prefetch={false}
          onClick={() => trackCheckoutClicked('feed_inline_unlock_banner', { story_count: storyCount, free_reads_used: freeReadsUsed })}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90"
        >
          <Sparkles size={14} />
          {limitReached ? 'Upgrade to keep reading' : 'Subscribe to unlock'}
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
      title: 'Your pulse, every day',
      desc: 'Wake up to a full feed of stories filtered to what you care about — AI, tech, markets, whatever you follow.',
    },
    {
      title: 'The point, not the whole article',
      desc: "We read it for you. You get the summary, the key takeaways, and why it matters — in under a minute.",
    },
    {
      title: '10 outlets covered it. We show you one.',
      desc: 'When everyone writes about the same story, we collapse it into a single clear view so you stop reading the same thing twice.',
    },
    {
      title: 'No rabbit holes',
      desc: "Skim today's feed in 5 minutes. Know what's going on. Move on with your day.",
    },
  ];
  const priceDisplay = pricingPreview.priceDisplay;
  const compareAtPriceDisplay = pricingPreview.compareAtPriceDisplay ?? null;
  const planName = pricingPreview.pricingOffer === 'india' ? 'Trace Pro India' : 'Trace Pro';
  return (
    <div className="w-full sm:rounded-2xl sm:bg-surface sm:shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="max-w-md mx-auto px-6 sm:px-12 py-10 sm:py-16">
        <p className="text-[11px] font-semibold text-secondary/35 uppercase tracking-[0.18em] mb-5">{planName}</p>
        <h2 className="text-[1.65rem] font-bold text-foreground tracking-[-0.025em] leading-tight mb-3">
          The news habit that<br />doesn't waste your time.
        </h2>
        <p className="text-[14px] text-secondary/50 mb-10 leading-relaxed">
          <SubscriptionPrice price={priceDisplay} compareAt={compareAtPriceDisplay} size="sm" />
          {' '}· Cancel anytime.
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
          {loading ? <><Loader2 size={14} className="animate-spin" />Setting up...</> : 'Subscribe to Pro'}
        </button>
        <p className="text-[11px] text-secondary/35 mt-2.5 text-center">
          <SubscriptionPrice price={priceDisplay} compareAt={compareAtPriceDisplay} size="sm" />
          {' '}· Cancel anytime
        </p>
      </div>
    </div>
  );
}

/* ─── Free-tier blur gate ─── */
/**
 * Renders after the last free item in a column. Shows blurred placeholder rows,
 * a gradient fade, and an inline subscribe CTA.
 */
const FAKE_STORY_TITLES = [
  'OpenAI quietly ships new reasoning model that beats o3 on key benchmarks',
  'Google DeepMind researchers publish landmark paper on agent memory',
  'Apple reportedly building its own AI chip for data centers',
  'Anthropic raises $2B at $40B valuation as AI race intensifies',
  'Meta releases Llama 4 with 128K context window and native tool use',
  'Sam Altman says AGI could arrive "sooner than most people expect"',
  'NVIDIA unveils next-gen GPU architecture designed for inference at scale',
  'Microsoft integrates Copilot into every Office app with new reasoning layer',
  'Perplexity launches enterprise tier with SOC2 compliance and private search',
  'Y Combinator backs 12 new AI infra startups in its biggest batch ever',
  'AWS announces 40% price cut on GPU instances amid cloud AI wars',
  'Cloudflare launches AI Gateway to rate-limit and cache LLM calls',
  "xAI's Grok 3 reportedly outperforms GPT-4o on coding benchmarks",
  'Stripe adds AI fraud detection that reduced chargebacks by 30%',
  'GitHub Copilot now writes entire PRs autonomously with test coverage',
];

const FAKE_TWEET_SNIPPETS = [
  "This new model just wrote a working compiler in 4 minutes. I'm speechless.",
  "Hot take: context windows will make RAG obsolete within 18 months.",
  "Just shipped a full SaaS product solo using Claude + Cursor. 3 days. No joke.",
  "The AI hype cycle is real but so is the underlying capability jump.",
  "Everyone building AI wrappers will be replaced by the model itself soon.",
  "Nobody talks about how much inference costs dropped in the last 6 months.",
  "The best engineers I know are 10x-ing their output with AI. The rest are in denial.",
  "Andrej just dropped another banger explainer thread. Go read it now.",
  "We're at the 'electricity will never power a house' stage of AI skepticism.",
];

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

function resolveRoleLabel(role?: string): string {
  const match = ROLES.find((entry) => entry.id === role);
  return match?.label ?? 'your role';
}

/** Full Pulse lock screen — no real content, profile-tailored feature highlights. */
export function PulseLockedPreview({
  role,
  interests = [],
}: {
  role?: string;
  interests?: string[];
}) {
  const roleLabel = resolveRoleLabel(role);
  const interestLabels = resolveInterestLabels(interests);
  const interestPhrase = formatInterestPhrase(interestLabels);

  const features = [
    { icon: Flame, label: 'Hot on X', detail: 'Trending tech threads, filtered for your feed' },
    { icon: MessageSquare, label: 'Hacker News', detail: 'Top discussions from the builder community' },
    { icon: Github, label: 'GitHub Trending', detail: 'Repos and tools gaining traction this week' },
    { icon: BookOpen, label: 'Top blogs', detail: `Long-form reads picked for ${roleLabel.toLowerCase()}s` },
  ] as const;

  return (
    <div className="flex h-full w-full flex-1 items-center justify-center overflow-hidden bg-white px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.06)] sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9ca3af]">Trace Pulse</p>
          <h2 className="mt-3 text-[20px] font-bold tracking-[-0.02em] text-[#111827] sm:text-[22px]">
            Your daily signal layer
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6b7280]">
            Built for{' '}
            <span className="font-semibold text-[#374151]">{roleLabel}s</span>
            {interestPhrase ? (
              <>
                {' '}
                · tuned to{' '}
                <span className="font-semibold text-[#374151]">{interestPhrase.toLowerCase()}</span>
              </>
            ) : (
              ' · tuned to your profile'
            )}
          </p>

          <ul className="mt-6 space-y-3 border-t border-[#f3f4f6] pt-6 text-left">
            {features.map(({ icon: Icon, label, detail }) => (
              <li key={label} className="flex items-start gap-3">
                <Icon size={15} className="mt-0.5 shrink-0 text-[#9ca3af]" strokeWidth={2.25} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#111827]">{label}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[#6b7280]">{detail}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-[#f3f4f6] pt-6">
            <p className="text-[15px] font-bold tracking-[-0.02em] text-[#111827]">
              Unlock Pulse with Trace Pro
            </p>
            <p className="mt-1 text-[13px] text-[#6b7280]">Cancel anytime</p>
            <Link
              href="/profile?tab=subscription"
              prefetch={false}
              onClick={() => trackCheckoutClicked('pulse_locked')}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#111827] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#1f2937]"
            >
              Subscribe to Pro
            </Link>
          </div>
        </div>
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
    <div className="relative mt-6 overflow-hidden">
      <div
        className="pointer-events-none select-none space-y-3 pb-36 opacity-70 blur-[5px]"
        aria-hidden
      >
        <p className="text-[15.5px] leading-[1.7] text-[#374151]">
          The broader context here matters because it shapes how teams prioritize security, product velocity, and the tradeoffs between shipping fast and staying resilient as these systems scale.
        </p>
        <p className="text-[15.5px] leading-[1.7] text-[#374151]">
          Analysts expect the next wave of releases to focus less on headline benchmarks and more on practical deployment, cost control, and the tooling needed to run models reliably in production environments.
        </p>
        <p className="text-[15.5px] leading-[1.7] text-[#374151]">
          For operators, the key takeaway is not just what changed today, but which constraints will still matter when the initial excitement fades and real adoption begins.
        </p>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/75 to-white" />
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-2 pt-12">
        <ProPaywallCard trackingId={trackingId} />
      </div>
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

  const isTweets = noun === 'tweets';
  const pool = isTweets ? FAKE_TWEET_SNIPPETS : FAKE_STORY_TITLES;
  // Show 5 fake items so the fade looks full of content
  const fakes = [pool[0], pool[2], pool[5], pool[8], pool[11 % pool.length]];

  return (
    <div className="relative mt-1 select-none" aria-hidden="true">
      {/* Blurred fake titles — barely blurred at top, very blurred at bottom */}
      <div className="space-y-2 pointer-events-none">
        {fakes.map((title, i) => {
          const blurPx = 2 + i * 2.5;
          const op = 0.75 - i * 0.12;
          return (
            <div
              key={i}
              className="flex items-start gap-2.5 py-0.5"
              style={{ filter: `blur(${blurPx}px)`, opacity: op }}
            >
              <div className="shrink-0 w-8 h-8 rounded-md bg-foreground/10" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">
                  {title}
                </div>
                <div className="h-[9px] w-20 rounded bg-foreground/8" />
              </div>
            </div>
          );
        })}
      </div>
      {/* Gradient: starts transparent so top items are readable, then fades hard */}
      <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-transparent from-10% via-background/60 via-50% to-background pointer-events-none" />
      {/* CTA pinned at bottom */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-1 pointer-events-auto">
        <p className="text-[11px] text-secondary/45">+{hiddenCount} more {noun}</p>
        <Link
          href="/profile?tab=subscription"
          onClick={() => {
            try { import('@/lib/posthog').then(({ trackCheckoutClicked }) => trackCheckoutClicked('feed_blur_gate', { noun })); } catch { /* ignore */ }
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-[12px] font-semibold text-background transition-all hover:bg-foreground/90 hover:scale-[1.02] active:scale-[0.98] shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
        >
          Unlock full feed
          <ArrowRight size={12} strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  );
}
