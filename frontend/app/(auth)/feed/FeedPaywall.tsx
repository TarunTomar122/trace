import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Loader2, Lock, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { trackCheckoutClicked, trackFeedSubscribeDialogShown, trackFeedProWelcomeShown } from '@/lib/posthog';
import { LANDING_PRICING_BULLET_POINTS } from '@/lib/subscription-pricing-bullets';

const INDIA_PRICING = { trialDays: 0, priceDisplay: '₹19/month', pricingOffer: 'india' as const };
const DEFAULT_PRICING = { trialDays: 0, priceDisplay: '$4.99/month', pricingOffer: 'default' as const };

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
                <p className="pr-10 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
                  {pricingPreview.pricingOffer === 'india' ? 'Trace Pro India' : 'Trace Pro'}
                </p>
                <h2 id="feed-subscribe-lock-heading" className="mt-2 text-xl font-bold tracking-tight text-foreground">
                  Sign in to unlock
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-secondary/60">
                  Sign in, then subscribe for {pricingPreview.priceDisplay}. Full briefings, unlimited reads, cancel anytime.
                </p>
                <div className="mt-5 max-h-[min(40vh,16rem)] space-y-3 overflow-y-auto pr-0.5 sm:max-h-none sm:overflow-visible">
                  {LANDING_PRICING_BULLET_POINTS.map((line) => (
                    <div key={line} className="flex items-start gap-3">
                      <Check size={13} className="shrink-0 mt-[3px] text-foreground/35" strokeWidth={2.5} />
                      <p className="text-[13px] font-medium leading-snug text-foreground/85">{line}</p>
                    </div>
                  ))}
                </div>
                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
                <button
                  type="button"
                  onClick={handleSignInToSubscribe}
                  disabled={signInLoading}
                  className="mt-6 flex w-full items-center justify-center rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:opacity-60"
                >
                  {signInLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Signing in...
                    </>
                  ) : (
                    'Sign in with Google'
                  )}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full py-2 text-sm text-secondary/60 transition hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Maybe later
                </button>
              </>
            ) : (
              <>
                <p className="pr-10 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
                  {pricingPreview.pricingOffer === 'india' ? 'Trace Pro India' : 'Trace Pro'}
                </p>
                <h2 id="feed-subscribe-lock-heading" className="mt-2 text-xl font-bold tracking-tight text-foreground">
                  Unlock your feed
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-secondary/60">
                  Subscribe for {pricingPreview.priceDisplay}. Full briefings, unlimited reads, cancel anytime.
                </p>
                <div className="mt-5 max-h-[min(40vh,16rem)] space-y-3 overflow-y-auto pr-0.5 sm:max-h-none sm:overflow-visible">
                  {LANDING_PRICING_BULLET_POINTS.map((line) => (
                    <div key={line} className="flex items-start gap-3">
                      <Check size={13} className="shrink-0 mt-[3px] text-foreground/35" strokeWidth={2.5} />
                      <p className="text-[13px] font-medium leading-snug text-foreground/85">{line}</p>
                    </div>
                  ))}
                </div>
                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={checkoutLoading}
                  className="mt-6 flex w-full items-center justify-center rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:opacity-60"
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Setting up...
                    </>
                  ) : (
                    `Subscribe to ${pricingPreview.pricingOffer === 'india' ? 'Trace Pro India' : 'Trace Pro'}`
                  )}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full py-2 text-sm text-secondary/60 transition hover:text-foreground"
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
                ? `You've read your 3 free articles today. ${storyCount - 3 > 0 ? `${storyCount - 3} more waiting for you.` : ''}`
                : `Browse ${storyCount} stories. Unlock the full brief to read the details.`}
            </p>
            <p className="mt-0.5 text-xs text-secondary/55">
              {limitReached
                ? 'Upgrade to Pro for unlimited articles, key takeaways, and source links.'
                : `Free users can read 3 articles per day. You've read ${freeReadsUsed} of 3 today.`}
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

  const handleStartTrial = async () => {
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
  const trialDays = pricingPreview.trialDays;
  const priceDisplay = pricingPreview.priceDisplay;
  const planName = pricingPreview.pricingOffer === 'india' ? 'Trace Pro India' : 'Trace Pro';
  return (
    <div className="w-full sm:rounded-2xl sm:bg-surface sm:shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="max-w-md mx-auto px-6 sm:px-12 py-10 sm:py-16">
        <p className="text-[11px] font-semibold text-secondary/35 uppercase tracking-[0.18em] mb-5">{planName}</p>
        <h2 className="text-[1.65rem] font-bold text-foreground tracking-[-0.025em] leading-tight mb-3">
          The news habit that<br />doesn't waste your time.
        </h2>
        <p className="text-[14px] text-secondary/50 mb-10 leading-relaxed">
          {priceDisplay}. Cancel anytime.
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
          onClick={handleStartTrial}
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full text-[13px] font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:shadow-md hover:shadow-black/10 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:scale-100"
        >
          {loading ? <><Loader2 size={14} className="animate-spin" />Setting up...</> : `Subscribe to ${planName}`}
        </button>
        <p className="text-[11px] text-secondary/35 mt-2.5 text-center">{priceDisplay} · Cancel anytime</p>
      </div>
    </div>
  );
}

/* ─── Free-tier blur gate ─── */
/**
 * Renders after the last free item in a column. Shows blurred placeholder rows,
 * a gradient fade, and an inline subscribe CTA.
 */
export function FreeBlurGate({ hiddenCount, noun = 'stories' }: { hiddenCount: number; noun?: string }) {
  if (hiddenCount <= 0) return null;
  return (
    <div className="relative mt-1 select-none" aria-hidden="true">
      {/* Blurred ghost rows */}
      <div className="space-y-3 pointer-events-none">
        {[0.55, 0.35, 0.18].map((opacity, i) => (
          <div
            key={i}
            className="h-11 rounded-lg bg-foreground/8"
            style={{ filter: `blur(${3 + i * 2}px)`, opacity }}
          />
        ))}
      </div>
      {/* Gradient fade to background */}
      <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-transparent via-background/70 to-background pointer-events-none" />
      {/* CTA */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pt-4 pb-1 pointer-events-auto">
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
