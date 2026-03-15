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
  Lock,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { trackCheckoutClicked, trackPaywallShown, trackSubscriptionStarted } from '@/lib/posthog';

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

function buildSubscriptionStatus(profile: any): SubscriptionStatus {
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
    hasAccess: ['trial', 'active'].includes(status) || ['trial', 'active'].includes(profile?.appSubscriptionStatus || 'none'),
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
  const autoCheckoutStarted = React.useRef(false);
  const trackedPaywall = React.useRef(false);
  const trackedSuccess = React.useRef(false);
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
        const checkoutTime = new Date((profile.lastCheckoutCreatedAt as any).seconds * 1000);
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
        return 'text-amber-500';
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
        return <CheckCircle2 className="text-amber-500" size={20} />;
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

  useEffect(() => {
    if (checkoutIntent && !autoCheckoutStarted.current && !isLoading && status === 'none' && !isCreatingCheckout) {
      autoCheckoutStarted.current = true;
      handleSubscribe();
    }
  }, [checkoutIntent, isLoading, status, isCreatingCheckout]);

  useEffect(() => {
    if (checkoutReturned && !trackedSuccess.current && (status === 'trial' || status === 'active')) {
      trackedSuccess.current = true;
      trackSubscriptionStarted('pro_monthly');
    }
  }, [checkoutReturned, status]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Unsubscribed state — matches profile tab section style
  if (status === 'none') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="space-y-8"
      >
        {/* How it works section */}
        <section className="pb-8 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60 mb-6 flex items-center gap-2">
            <Lock size={14} className="text-foreground" />
            What you get with Pro
          </h2>

          <div className="space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                <Zap size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Unlimited topic access</p>
                <p className="text-sm text-secondary mt-0.5">
                  Get the full set of daily trending topics, summaries, and timelines.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-amber-500/60 flex items-center justify-center shrink-0 mt-0.5">
                <Bell size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">AI summaries in your style</p>
                <p className="text-sm text-secondary mt-0.5">
                  Read clean summaries with the context and key points worth remembering.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Start with a free trial</p>
                <p className="text-sm text-secondary mt-0.5">
                  Try Pro free for 3 days, then $2.99/mo. Cancel anytime and you won&apos;t be charged if you cancel before the trial ends.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section>
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={isCreatingCheckout}
            className="w-full bg-amber-500 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-amber-500/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isCreatingCheckout ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Setting up your trial...
              </>
            ) : (
              <>
                <Zap size={16} />
                Start Free Trial
              </>
            )}
          </button>

          <p className="text-xs text-secondary/50 mt-3">
            3-day free trial, then $2.99/month. Cancel anytime.
          </p>
        </section>

        <p className="text-xs text-secondary/40">
          Questions? yourtrace.online@gmail.com
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
        className="bg-white dark:bg-[#16161e] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8"
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              {getStatusIcon(status)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Trace Pro
              </h3>
              <p className={`text-sm font-medium mt-0.5 ${getStatusColor(status)}`}>
                {status.replace('_', ' ')}
              </p>
            </div>
          </div>
          {hasAccess && (
            <span className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-medium">
              Active
            </span>
          )}
        </div>

        {/* Subscription Details */}
        <div className="space-y-3 mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
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
              Plan: <span className="text-foreground font-medium">$2.99/month</span>
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
                    className="w-full bg-amber-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-amber-500/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                  className="w-full border border-gray-200 dark:border-gray-700 text-secondary hover:border-red-300 dark:hover:border-red-700 hover:text-red-500 py-3 rounded-xl text-sm font-medium transition-colors"
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
                      className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {isCancelling ? 'Cancelling...' : 'Cancel at Period End'}
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 border border-gray-200 dark:border-gray-700 text-secondary py-2.5 rounded-lg text-sm font-medium hover:border-foreground hover:text-foreground transition-colors"
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
              className="w-full bg-amber-500 text-white py-4 rounded-xl text-sm font-medium hover:bg-amber-500/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
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
      <p className="text-xs text-secondary/40 text-center">
        Questions? yourtrace.online@gmail.com
      </p>
    </div>
  );
}
