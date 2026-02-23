"use client";

import React, { useState, useEffect } from 'react';
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

export default function SubscriptionManager() {
  const { user, profile, refreshProfile } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

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

      setSubscriptionStatus({
        subscriptionStatus: status,
        subscriptionId: profile.subscriptionId || null,
        planId: profile.planId || null,
        trialEndDate: profile.trialEndDate ? new Date((profile.trialEndDate as any).seconds * 1000) : null,
        nextBillingDate: profile.nextBillingDate ? new Date((profile.nextBillingDate as any).seconds * 1000) : null,
        lastPaymentDate: profile.lastPaymentDate ? new Date((profile.lastPaymentDate as any).seconds * 1000) : null,
        cancelledAt: profile.cancelledAt ? new Date((profile.cancelledAt as any).seconds * 1000) : null,
        willCancelAt: profile.willCancelAt ? new Date((profile.willCancelAt as any).seconds * 1000) : null,
        hasAccess: ['trial', 'active'].includes(status) || ['trial', 'active'].includes(profile.appSubscriptionStatus || 'none'),
      });
      setIsLoading(false);
    }
  }, [profile]);

  const handleSubscribe = async () => {
    if (!user) return;

    setIsCreatingCheckout(true);
    setError(null);

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
        return 'text-green-500';
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
        return <CheckCircle2 className="text-green-500" size={20} />;
      case 'on_hold':
        return <AlertCircle className="text-yellow-500" size={20} />;
      case 'cancelled':
      case 'expired':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <CreditCard className="text-secondary" size={20} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const status = subscriptionStatus?.subscriptionStatus || 'none';
  const hasAccess = subscriptionStatus?.hasAccess || false;

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
              <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                <Zap size={14} className="text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Unlimited For You &amp; Deep Dives</p>
                <p className="text-sm text-secondary mt-0.5">
                  Full access to all personalized articles and expert deep dives, refreshed daily.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-accent/60 flex items-center justify-center shrink-0 mt-0.5">
                <Bell size={14} className="text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">AI summaries in your style</p>
                <p className="text-sm text-secondary mt-0.5">
                  Choose executive brief, practitioner deep-dive, or casual talking points.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-accent/30 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 size={14} className="text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Start with a free trial</p>
                <p className="text-sm text-secondary mt-0.5">
                  Try Pro free for 4 days, then $2.99/mo. Cancel anytime &mdash; no charge if you cancel before the trial ends.
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
            className="w-full bg-accent text-accent-foreground py-3.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
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
            4-day free trial, then $2.99/month. Cancel anytime.
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
            <span className="px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-medium">
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
                    className="w-full bg-accent text-accent-foreground py-3 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                    Are you sure? You&apos;ll lose unlimited For You articles and Deep Dives.
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
              className="w-full bg-accent text-accent-foreground py-4 rounded-xl text-sm font-medium hover:bg-accent/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
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
