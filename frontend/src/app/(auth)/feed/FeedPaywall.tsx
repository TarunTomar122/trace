import React from 'react';
import Link from 'next/link';
import { Check, Loader2, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { trackCheckoutClicked } from '@/lib/posthog';

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
          <p className="text-[11px] text-secondary/50">Try Pro free for 3 days</p>
        </div>
      </div>
      <Link
        href="/profile?tab=subscription"
        prefetch={false}
        onClick={() => trackCheckoutClicked('feed_upgrade_card_trending', { locked_count: lockedCount })}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98]"
      >
        <Sparkles size={14} />
        Try Pro free for 3 days
      </Link>
    </div>
  );
}

export function InlineUnlockBanner({ storyCount }: { storyCount: number }) {
  return (
    <div className="mb-4 rounded-2xl border border-border/20 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/6">
            <Lock size={15} className="text-foreground/60" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Browse {storyCount} stories. Unlock the full brief to read the details.
            </p>
            <p className="mt-0.5 text-xs text-secondary/55">
              Free users can scan the feed. Pro unlocks summaries, key takeaways, and source links.
            </p>
          </div>
        </div>
        <Link
          href="/profile?tab=subscription"
          prefetch={false}
          onClick={() => trackCheckoutClicked('feed_inline_unlock_banner', { story_count: storyCount })}
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
const INDIA_PRICING = { trialDays: 1, priceDisplay: '₹19/month', pricingOffer: 'india' as const };
const DEFAULT_PRICING = { trialDays: 3, priceDisplay: '$2.99/month', pricingOffer: 'default' as const };

function guessClientPricing() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Kolkata') return INDIA_PRICING;
    const lang = (navigator.language || '').toLowerCase();
    if (lang === 'en-in' || lang.endsWith('-in')) return INDIA_PRICING;
  } catch {}
  return DEFAULT_PRICING;
}

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
          Try Pro free for {trialDays} {trialDays === 1 ? 'day' : 'days'}. No charge until the trial ends.
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
          {loading ? <><Loader2 size={14} className="animate-spin" />Setting up your trial...</> : `Try Pro free for ${trialDays} days`}
        </button>
        <p className="text-[11px] text-secondary/35 mt-2.5 text-center">{priceDisplay} after {trialDays} {trialDays === 1 ? 'day' : 'days'} · Cancel anytime</p>
      </div>
    </div>
  );
}
