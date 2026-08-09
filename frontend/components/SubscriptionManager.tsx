"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import type { UserProfile } from '@/lib/firestore';
import { trackCheckoutClicked, trackPaywallShown } from '@/lib/posthog';
import {
  SUBSCRIPTION_COMPARE_AT_DEFAULT,
  SUBSCRIPTION_PRICE_DEFAULT,
  SUBSCRIPTION_PRICE_INDIA,
} from '@/lib/subscription-pricing';
import SubscriptionPrice from '@/components/SubscriptionPrice';
import { hasActiveSubscription } from '@/lib/subscription-access';

interface SubscriptionStatus {
  subscriptionStatus: string;
  subscriptionId: string | null;
  planId: string | null;
  trialEndDate: Date | null;
  nextBillingDate: Date | null;
  lastPaymentDate: Date | null;
  cancelledAt: Date | null;
  willCancelAt: Date | null;
  hasAccess: boolean;
}

interface PricingPreview {
  countryCode: string | null;
  countrySource: 'header' | 'profile' | 'fallback';
  priceDisplay: string;
  compareAtPriceDisplay?: string | null;
  pricingOffer: 'india' | 'default';
}

const INDIA_PRICING_PREVIEW: PricingPreview = {
  countryCode: 'IN',
  countrySource: 'fallback',
  priceDisplay: SUBSCRIPTION_PRICE_INDIA,
  compareAtPriceDisplay: null,
  pricingOffer: 'india',
};

const DEFAULT_PRICING_PREVIEW: PricingPreview = {
  countryCode: null,
  countrySource: 'fallback',
  priceDisplay: SUBSCRIPTION_PRICE_DEFAULT,
  compareAtPriceDisplay: SUBSCRIPTION_COMPARE_AT_DEFAULT,
  pricingOffer: 'default',
};

function guessClientPricingPreview(): PricingPreview {
  if (typeof window === 'undefined') return DEFAULT_PRICING_PREVIEW;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Kolkata') return INDIA_PRICING_PREVIEW;
    const lang = (navigator.language || '').toLowerCase();
    if (lang === 'en-in' || lang.endsWith('-in')) return INDIA_PRICING_PREVIEW;
  } catch {
    // fall through
  }
  return DEFAULT_PRICING_PREVIEW;
}

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as { seconds?: number; toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') return maybeTimestamp.toDate();
    if (typeof maybeTimestamp.seconds === 'number') return new Date(maybeTimestamp.seconds * 1000);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildSubscriptionStatus(profile: UserProfile): SubscriptionStatus {
  const status = profile?.subscriptionStatus || 'none';
  return {
    subscriptionStatus: status,
    subscriptionId: profile?.subscriptionId || null,
    planId: profile?.planId || null,
    trialEndDate: toDateOrNull(profile?.trialEndDate),
    nextBillingDate: toDateOrNull(profile?.nextBillingDate),
    lastPaymentDate: toDateOrNull(profile?.lastPaymentDate),
    cancelledAt: toDateOrNull(profile?.cancelledAt),
    willCancelAt: toDateOrNull(profile?.willCancelAt),
    hasAccess: hasActiveSubscription(profile),
  };
}

export default function SubscriptionManager() {
  const { user, profile, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [pricingPreview, setPricingPreview] = useState<PricingPreview | null>(null);
  const autoCheckoutStarted = React.useRef(false);
  const trackedPaywall = React.useRef(false);
  const refreshProfileRef = React.useRef(refreshProfile);
  const checkoutIntent = searchParams.get('intent') === 'checkout';
  const checkoutReturned = searchParams.get('subscription') === 'success';

  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  const fetchSubscriptionStatus = React.useCallback(async () => {
    if (!user) return false;
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return false;
      const response = await fetch('/api/subscription/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) return false;
      const data = await response.json();
      setSubscriptionStatus({
        subscriptionStatus: data.subscriptionStatus || 'none',
        subscriptionId: data.subscriptionId || null,
        planId: data.planId || null,
        trialEndDate: toDateOrNull(data.trialEndDate),
        nextBillingDate: toDateOrNull(data.nextBillingDate),
        lastPaymentDate: toDateOrNull(data.lastPaymentDate),
        cancelledAt: toDateOrNull(data.cancelledAt),
        willCancelAt: toDateOrNull(data.willCancelAt),
        hasAccess: Boolean(data.hasAccess),
      });
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('Error fetching subscription status:', err);
      return false;
    }
  }, [user]);

  // Refresh profile once on mount to get latest subscription data
  const hasRefreshed = React.useRef(false);
  useEffect(() => {
    if (user && !hasRefreshed.current) {
      hasRefreshed.current = true;
      refreshProfile();
    }
  }, [user, refreshProfile]);

  useEffect(() => {
    if (profile) {
      // Get subscription status from profile (handle undefined for existing users)
      const status = profile.subscriptionStatus || 'none';

      // Debug log to help troubleshoot subscription issues
      console.log('[SubscriptionManager] Profile data:', {
        subscriptionStatus: status,
        subscriptionId: profile.subscriptionId,
        planId: profile.planId,
      });

      // Check for abandoned checkout (older than 15 minutes)
      let showAbandonedWarning = false;
      if (status === 'none' && profile.lastCheckoutCreatedAt) {
        const checkoutTime = new Date(profile.lastCheckoutCreatedAt.seconds * 1000);
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        if (checkoutTime > fifteenMinutesAgo) {
          showAbandonedWarning = true;
        }
      }

      if (showAbandonedWarning) {
        setError('💡 You started a checkout but didn\'t complete it. Ready to try again?');
      }

      setSubscriptionStatus(buildSubscriptionStatus(profile));
      setIsLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    let attempts = 0;
    const syncStatus = async () => {
      attempts += 1;
      const ok = await fetchSubscriptionStatus();
      if (ok && checkoutReturned) {
        await refreshProfileRef.current();
      }
    };
    syncStatus();
    if (!checkoutReturned) return;
    const interval = setInterval(() => {
      if (attempts >= 6) {
        clearInterval(interval);
        return;
      }
      syncStatus();
    }, 4000);
    return () => clearInterval(interval);
  }, [user, checkoutReturned, fetchSubscriptionStatus]);

  useEffect(() => {
    if (!trackedPaywall.current && !isLoading && subscriptionStatus?.subscriptionStatus === 'none') {
      trackedPaywall.current = true;
      trackPaywallShown('profile_subscription_tab');
    }
  }, [isLoading, subscriptionStatus?.subscriptionStatus]);

  useEffect(() => {
    let cancelled = false;

    const loadPricingPreview = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch('/api/subscription/pricing', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setPricingPreview(data);
        }
      } catch (err) {
        console.error('Error fetching subscription pricing:', err);
      }
    };

    void loadPricingPreview();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubscribe = async () => {
    if (!user) return;

    setIsCreatingCheckout(true);
    setError(null);
    trackCheckoutClicked(checkoutIntent ? 'checkout_intent_resume' : 'profile_subscription_cta');

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.needsSetup) {
          setError('⚠️ Dodo Payments not set up yet. This will work once you configure your Dodo account.');
          setIsCreatingCheckout(false);
          return;
        }
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      // Redirect to Dodo Payments checkout
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error('Error creating checkout:', err);
      setError(err instanceof Error ? err.message : 'Failed to start subscription');
      setIsCreatingCheckout(false);
    }
  };

  const handleCancelSubscription = async (immediate = false) => {
    if (!user) return;

    if (!subscriptionStatus?.subscriptionId) {
      setError('Unable to cancel: subscription ID not found. Please try refreshing the page or contact support.');
      return;
    }

    setIsCancelling(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelAtPeriodEnd: !immediate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      const data = await response.json();
      alert(data.message);

      // Refresh the page to update status
      window.location.reload();
    } catch (err) {
      console.error('Error cancelling subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const handleResumeSubscription = async () => {
    if (!user || !subscriptionStatus?.subscriptionId) return;

    setIsResuming(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/subscription/resume', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resume subscription');
      }

      const data = await response.json();
      alert(data.message);

      // Refresh the page to update status
      window.location.reload();
    } catch (err) {
      console.error('Error resuming subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to resume subscription');
    } finally {
      setIsResuming(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'trial':
      case 'active':
        return 'text-[#2557d6]';
      case 'on_hold':
        return 'text-yellow-500';
      case 'cancelled':
      case 'expired':
        return 'text-red-500';
      default:
        return 'text-secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'trial':
      case 'active':
        return <CheckCircle2 className="text-[#2557d6]" size={20} />;
      case 'on_hold':
        return <AlertCircle className="text-yellow-500" size={20} />;
      case 'cancelled':
      case 'expired':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <CreditCard className="text-secondary" size={20} />;
    }
  };

  const status = subscriptionStatus?.subscriptionStatus || 'none';
  const hasAccess = subscriptionStatus?.hasAccess || false;
  const fallbackPricing = guessClientPricingPreview();
  const priceDisplay = pricingPreview?.priceDisplay ?? fallbackPricing.priceDisplay;
  const compareAtPriceDisplay =
    pricingPreview?.compareAtPriceDisplay ?? fallbackPricing.compareAtPriceDisplay ?? null;
  const planName = (pricingPreview?.pricingOffer ?? fallbackPricing.pricingOffer) === 'india'
    ? 'Trace Pro India'
    : 'Trace Pro';

  useEffect(() => {
    if (checkoutIntent && !autoCheckoutStarted.current && !isLoading && status === 'none' && !isCreatingCheckout) {
      autoCheckoutStarted.current = true;
      handleSubscribe();
    }
  }, [checkoutIntent, isLoading, status, isCreatingCheckout]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Unsubscribed state
  if (status === 'none') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="space-y-4"
      >
        <div className="grid overflow-hidden rounded-[18px] bg-surface-secondary ring-1 ring-foreground/7 dark:ring-white/10 md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="p-7 sm:p-9">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">{planName}</p>
            <h2 className="mt-4 text-[32px] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground">
              Keep the whole story within reach.
            </h2>
            <p className="mt-4 max-w-[520px] text-[14px] leading-[1.7] text-secondary">
              Unlimited AI summaries, searchable saved posts, the complete daily archive, and Agent Access.
            </p>
          </div>
          <div className="flex flex-col justify-center bg-foreground p-7 text-background">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] opacity-65">3 days free</p>
            <p className="mt-2 text-[28px] font-semibold leading-[1.05] tracking-[-0.035em]">Try Trace Pro</p>
            <p className="mt-2 text-[13px] opacity-70">Then {priceDisplay}/month. Cancel anytime.</p>
            <button
              onClick={handleSubscribe}
              disabled={isCreatingCheckout}
              className="mt-6 flex items-center justify-center gap-2 rounded-full bg-background py-3 text-[13px] font-semibold text-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isCreatingCheckout ? (
                <><Loader2 className="animate-spin" size={15} />Setting up...</>
              ) : (
                <>Start your free trial</>
              )}
            </button>
            <p className="mt-3 text-center text-[11px] opacity-65">No charge for the first 3 days.</p>
          </div>
        </div>

        {error && (
          <div className="rounded-[14px] bg-red-500/8 p-3 text-sm text-red-600 ring-1 ring-red-500/15 dark:text-red-400">
            {error}
          </div>
        )}

        <p className="text-[11px] text-secondary">
          Questions? tomartarun2001@gmail.com
        </p>
      </motion.div>
    );
  }

  // Subscribed / active / cancelled / expired states
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[18px] bg-surface-secondary p-6 ring-1 ring-foreground/7 dark:ring-white/10 md:p-8"
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface">
              {getStatusIcon(status)}
            </div>
            <div>
              <h3 className="text-[26px] font-semibold leading-none tracking-[-0.03em] text-foreground">
                {planName}
              </h3>
              <p className={`text-sm font-medium mt-0.5 ${getStatusColor(status)}`}>
                {status.replace('_', ' ')}
              </p>
            </div>
          </div>
          {hasAccess && (
            <span className="rounded-full bg-surface px-3 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent">
              Active
            </span>
          )}
        </div>

        {/* Subscription Details */}
        <div className="mb-6 space-y-3 rounded-[14px] bg-surface p-4">
          {status === 'trial' && subscriptionStatus?.trialEndDate && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar size={16} className="text-secondary" />
              <span className="text-secondary">
                Trial ends: <span className="text-foreground font-medium">{formatDate(subscriptionStatus.trialEndDate)}</span>
              </span>
            </div>
          )}

          {status === 'active' && subscriptionStatus?.nextBillingDate && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar size={16} className="text-secondary" />
              <span className="text-secondary">
                Next billing: <span className="text-foreground font-medium">{formatDate(subscriptionStatus.nextBillingDate)}</span>
              </span>
            </div>
          )}

          {subscriptionStatus?.lastPaymentDate && (
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle2 size={16} className="text-secondary" />
              <span className="text-secondary">
                Last payment: <span className="text-foreground font-medium">{formatDate(subscriptionStatus.lastPaymentDate)}</span>
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm">
            <CreditCard size={16} className="text-secondary" />
            <span className="text-secondary">
              Plan:{' '}
              <SubscriptionPrice price={priceDisplay} compareAt={compareAtPriceDisplay} size="sm" />
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {(status === 'trial' || status === 'active') && (
            <>
              {subscriptionStatus?.cancelledAt ? (
                <div className="space-y-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-100 dark:border-yellow-900/40">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400" />
                    <p className="text-sm font-medium text-foreground">
                      Subscription cancelled
                    </p>
                  </div>
                  <p className="text-sm text-secondary mb-3">
                    Your access will end {subscriptionStatus.willCancelAt ? `on ${formatDate(subscriptionStatus.willCancelAt)}` : 'at the end of your billing period'}.
                  </p>
                  <button
                    onClick={handleResumeSubscription}
                    disabled={isResuming}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {isResuming ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Resuming...
                      </>
                    ) : (
                      'Resume Subscription'
                    )}
                  </button>
                </div>
              ) : !showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full rounded-full bg-surface py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/20 transition-colors hover:bg-red-500/5 dark:text-red-400"
                >
                  Cancel Subscription
                </button>
              ) : (
                <div className="space-y-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/40">
                  <p className="text-sm text-foreground">
                    Are you sure? You&apos;ll lose unlimited topic access and your full feed.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleCancelSubscription(false)}
                      disabled={isCancelling}
                    className="flex-1 rounded-full bg-red-600 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {isCancelling ? 'Cancelling...' : 'Cancel at Period End'}
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 rounded-full bg-surface py-2.5 text-sm font-medium text-secondary ring-1 ring-foreground/10 transition-colors hover:text-foreground"
                    >
                      Keep Subscription
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {(status === 'expired' || status === 'cancelled') && (
            <button
              onClick={handleSubscribe}
              disabled={isCreatingCheckout}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isCreatingCheckout ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Creating Checkout...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Resubscribe
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>

      {/* Help Text */}
      <p className="text-center text-xs text-secondary">
        Questions? tomartarun2001@gmail.com
      </p>
    </div>
  );
}
