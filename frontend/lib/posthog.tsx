"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

// Initialize PostHog only on client side
if (typeof window !== "undefined") {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // We capture manually for better control
    capture_pageleave: true,
  });
}

// Track page views on route change
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname;
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}

// Export posthog instance for manual event tracking
export { posthog };

// ============================================================================
// TRACKING HELPER FUNCTIONS
// ============================================================================

// Identify user after sign in (links anonymous events to user)
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  posthog.identify(userId, properties);
}

// Reset user on sign out
export function resetUser() {
  posthog.reset();
}

// ============================================================================
// EVENT TRACKING FUNCTIONS
// ============================================================================

// Auth events
export function trackSignIn(method: "google" | "email" = "google") {
  posthog.capture("user_signed_in", { method });
}

export function trackSignOut() {
  posthog.capture("user_signed_out");
}

// Onboarding events
export function trackOnboardingStarted() {
  posthog.capture("onboarding_started");
}

export function trackOnboardingStepCompleted(step: number, stepName: string) {
  posthog.capture("onboarding_step_completed", { step, step_name: stepName });
}

export function trackOnboardingCompleted(data: {
  interests_count: number;
  hobbies_count: number;
  role?: string;
}) {
  posthog.capture("onboarding_completed", data);
}

// Feed events
export function trackFeedViewed(itemCount: number, isPreview?: boolean) {
  posthog.capture("feed_viewed", { item_count: itemCount, is_preview: isPreview });
}

export function trackFeedItemClicked(itemId: string, itemType: string, source: string) {
  posthog.capture("feed_item_clicked", { item_id: itemId, item_type: itemType, source });
}

export function trackFeedItemUpvoted(itemId: string, itemType: string) {
  posthog.capture("feed_item_upvoted", { item_id: itemId, item_type: itemType });
}

export function trackFeedItemDownvoted(itemId: string, itemType: string) {
  posthog.capture("feed_item_downvoted", { item_id: itemId, item_type: itemType });
}

export function trackFeedItemBookmarked(itemId: string, itemType: string) {
  posthog.capture("feed_item_bookmarked", { item_id: itemId, item_type: itemType });
}

export function trackFeedItemSeen(itemId: string) {
  posthog.capture("feed_item_seen", { item_id: itemId });
}

// Profile events
export function trackProfileViewed() {
  posthog.capture("profile_viewed");
}

export function trackProfileUpdated(fields: string[]) {
  posthog.capture("profile_updated", { fields_updated: fields });
}

// Subscription events
export function trackSubscriptionStarted(plan: string) {
  posthog.capture("subscription_started", { plan });
}

export function trackSubscriptionCancelled(plan: string) {
  posthog.capture("subscription_cancelled", { plan });
}

// Conversion funnel events
export function trackSummaryOpened(itemId: string, isPaidUser: boolean) {
  posthog.capture("summary_opened", {
    item_id: itemId,
    is_paid_user: isPaidUser,
  });
}

export function trackPaywallShown(source: string, props?: Record<string, unknown>) {
  posthog.capture("paywall_shown", {
    source,
    ...props,
  });
}

export function trackCheckoutClicked(source: string, props?: Record<string, unknown>) {
  posthog.capture("checkout_clicked", {
    source,
    ...props,
  });
}

