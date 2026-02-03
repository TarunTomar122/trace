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
  Zap
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
        hasAccess: ['trial', 'active'].includes(status),
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

  return (
    <div className="space-y-6">
      {/* Subscription Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8"
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              {getStatusIcon(status)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Premium Feed Access
              </h3>
              <p className={`text-sm font-medium mt-0.5 ${getStatusColor(status)}`}>
                {status === 'none' ? 'No Subscription' : status.replace('_', ' ')}
              </p>
            </div>
          </div>
          {hasAccess && (
            <span className="px-3 py-1.5 rounded-full bg-green-50 text-green-600 text-xs font-medium">
              Active
            </span>
          )}
        </div>

        {/* Subscription Details */}
        {status !== 'none' && (
          <div className="space-y-3 mb-6 p-4 bg-gray-50 rounded-xl">
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
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-100 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Benefits Section - only show when not subscribed */}
        {status === 'none' && (
          <div className="mb-6 space-y-4">
            <div className="p-5 bg-gray-50 rounded-xl">
              <h4 className="text-sm font-medium text-foreground mb-4">
                What you get:
              </h4>
              <ul className="space-y-3 text-sm text-secondary">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs shrink-0">✓</span>
                  <span>A calm, focused daily feed tailored to your interests</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs shrink-0">✓</span>
                  <span>A daily briefing delivered to your inbox</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs shrink-0">✓</span>
                  <span>High-signal picks from trusted sources across the web</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs shrink-0">✓</span>
                  <span>AI-curated to reduce noise and avoid doomscrolling</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {status === 'none' && (
            <button
              onClick={handleSubscribe}
              disabled={isCreatingCheckout}
              className="w-full bg-foreground text-background py-3.5 rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCreatingCheckout ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Creating Checkout...
                </>
              ) : (
                <span className="flex flex-col items-center text-center gap-1">
                  <span className="flex items-center gap-2 text-white text-sm">
                    <Zap size={16} />
                    Start 3-Day Free Trial
                  </span>
                  <span className="text-[10px] md:text-[11px] text-white/70 leading-tight max-w-64">
                    Cancel anytime before your trial ends and you won&apos;t be charged.
                  </span>
                </span>
              )}
            </button>
          )}

          {(status === 'trial' || status === 'active') && (
            <>
              {subscriptionStatus?.cancelledAt ? (
                <div className="space-y-3 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-yellow-600" />
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
                    className="w-full bg-foreground text-background py-3 rounded-xl text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                  className="w-full border border-gray-200 text-secondary hover:border-red-300 hover:text-red-500 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel Subscription
                </button>
              ) : (
                <div className="space-y-3 p-4 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-sm text-foreground">
                    Are you sure you want to cancel? You&apos;ll lose access to your premium feed.
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
                      className="flex-1 border border-gray-200 text-secondary py-2.5 rounded-lg text-sm font-medium hover:border-foreground hover:text-foreground transition-colors"
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
              className="w-full bg-foreground text-background py-4 rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
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

      {/* Pricing Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white border border-gray-200 rounded-2xl p-6"
      >
        <h4 className="text-sm font-medium text-foreground mb-4">
          Plan Details
        </h4>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-secondary">Price:</span>
            <span className="text-foreground font-medium">$5.90/month</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary"></span>
            <span className="text-primary text-xs">☕ Less than a coffee</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Trial Period:</span>
            <span className="text-foreground font-medium">3 days free</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Billing:</span>
            <span className="text-foreground font-medium">Monthly</span>
          </div>
        </div>
      </motion.div>

      {/* Help Text */}
      <p className="text-sm text-secondary/60 text-center">
        Questions? Contact us at yourtrace.online@gmail.com
      </p>
    </div>
  );
}
