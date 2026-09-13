"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import {
  FEED_EVENTS,
  dailyBriefPreferenceProperties,
  feedViewedProperties,
  storyInteractionProperties,
  type FeedTier,
  type FeedView,
} from "@/lib/feed-analytics";

// Initialize PostHog only on client side
if (typeof window !== "undefined") {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const shouldInitPosthog =
    Boolean(posthogKey) &&
    posthogKey!.startsWith("phc_") &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  if (shouldInitPosthog) {
    posthog.init(posthogKey!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false,
      capture_pageleave: true,
    });
  } else if (process.env.NODE_ENV === "development") {
    console.info("[PostHog] Skipping client init on localhost or with a non-project key.");
  }
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
  posthog.capture("user_signed_in", { method, surface: "web" });
}

export function trackSignUp(method: "google" | "email" = "google") {
  posthog.capture("user_signed_up", { method, surface: "web" });
}

export function trackSignOut() {
  posthog.capture("user_signed_out", { surface: "web" });
}

// Onboarding events
export function trackOnboardingStarted() {
  posthog.capture("onboarding_started", { surface: "web" });
}

export function trackOnboardingStepCompleted(step: number, stepName: string) {
  posthog.capture("onboarding_step_completed", { step, step_name: stepName, surface: "web" });
}

export function trackOnboardingCompleted(data: {
  interests_count: number;
  hobbies_count: number;
  role?: string;
  daily_brief_enabled?: boolean;
}) {
  posthog.capture("onboarding_completed", { ...data, surface: "web" });
}

// Feed events
export function trackFeedViewed(
  itemCount: number,
  isPreview = false,
  view: FeedView = "edition",
  tier: FeedTier = isPreview ? "free" : "pro",
  audience: "guest" | "authenticated" = "authenticated",
) {
  posthog.capture(
    FEED_EVENTS.viewed,
    feedViewedProperties({ itemCount, isPreview, view, tier, audience }),
  );
}

export function trackFeedStoryExpanded(input: {
  itemId: string;
  itemType: string;
  source?: string;
  position: number;
  section: string;
  tier: FeedTier;
}) {
  posthog.capture(FEED_EVENTS.storyExpanded, storyInteractionProperties(input));
}

export function trackFeedSourceClicked(input: {
  itemId: string;
  itemType: string;
  source?: string;
  position: number;
  section: string;
  tier: FeedTier;
}) {
  posthog.capture(FEED_EVENTS.sourceClicked, storyInteractionProperties(input));
}

export function trackFeedFilterChanged(
  filter: string,
  previousFilter: string,
  props?: Record<string, unknown>,
) {
  posthog.capture(FEED_EVENTS.filterChanged, {
    surface: "web",
    filter,
    previous_filter: previousFilter,
    ...props,
  });
}

export function trackDailyBriefPreferenceChanged(
  enabled: boolean,
  location: "onboarding" | "feed" | "profile",
) {
  posthog.capture(
    FEED_EVENTS.dailyBriefPreferenceChanged,
    dailyBriefPreferenceProperties({ enabled, location }),
  );
}

export function trackFeedOlderLoaded(addedCount: number, totalCount: number) {
  posthog.capture(FEED_EVENTS.olderLoaded, {
    surface: "web",
    added_count: Math.max(0, addedCount),
    total_count: Math.max(0, totalCount),
  });
}

export function trackFeedItemClicked(itemId: string, itemType: string, source: string) {
  posthog.capture("feed_item_clicked", {
    item_id: itemId,
    item_type: itemType,
    source,
    surface: "web",
  });
}

export function trackFeedItemUpvoted(itemId: string, itemType: string) {
  posthog.capture("feed_item_upvoted", { item_id: itemId, item_type: itemType });
}

export function trackFeedItemDownvoted(itemId: string, itemType: string) {
  posthog.capture("feed_item_downvoted", { item_id: itemId, item_type: itemType });
}

export function trackFeedItemBookmarked(
  itemId: string,
  itemType: string,
  props?: Record<string, unknown>,
) {
  posthog.capture("feed_item_bookmarked", {
    item_id: itemId,
    item_type: itemType,
    surface: "web",
    ...props,
  });
}

export function trackShareInitiated(itemId: string, props?: Record<string, unknown>) {
  posthog.capture("share_initiated", { item_id: itemId, surface: "web", ...props });
}

export function trackPromoModalOpened(props?: Record<string, unknown>) {
  posthog.capture("promo_modal_opened", { surface: "web", ...props });
}

export function trackPromoSubmitted(props?: Record<string, unknown>) {
  posthog.capture("promo_submitted", { surface: "web", ...props });
}

export function trackPurchaseCompleted(product: "pro" | "tool_promo") {
  posthog.capture("purchase_completed", { surface: "web", product });
}

// Profile events
export function trackProfileViewed() {
  posthog.capture("profile_viewed");
}

export function trackProfileUpdated(fields: string[]) {
  posthog.capture("profile_updated", { fields_updated: fields });
}

export function trackSubscriptionCancelled(plan: string) {
  posthog.capture("subscription_cancelled", { plan });
}

// Conversion funnel events
export function trackSummaryOpened(
  itemId: string,
  isPaidUser: boolean,
  props?: Record<string, unknown>,
) {
  posthog.capture("summary_opened", {
    item_id: itemId,
    is_paid_user: isPaidUser,
    surface: "web",
    ...props,
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

/** Feed full-screen subscribe modal (logged-out-of-content click lock on /feed). */
export function trackFeedSubscribeDialogShown(properties?: Record<string, unknown>) {
  posthog.capture("feed_subscribe_dialog_shown", {
    surface: "feed_click_lock",
    ...properties,
  });
}

export const LANDING_CTA_EXPERIMENT_ID = "landing_cta_copy_20260911";

export type LandingCtaAssignment = "control" | "variant";

function stableBucket(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function getLandingCtaAssignment(): LandingCtaAssignment {
  if (typeof window === "undefined") return "control";
  const key = `trace_experiment_${LANDING_CTA_EXPERIMENT_ID}`;
  const existing = window.localStorage.getItem(key);
  if (existing === "control" || existing === "variant") return existing;
  const distinctId = posthog.get_distinct_id() || window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const assignment: LandingCtaAssignment = stableBucket(distinctId) < 50 ? "control" : "variant";
  window.localStorage.setItem(key, assignment);
  return assignment;
}

export function trackLandingCtaExposure(assignment: LandingCtaAssignment) {
  if (typeof window !== "undefined") {
    const exposureKey = `trace_exposure_${LANDING_CTA_EXPERIMENT_ID}`;
    if (window.localStorage.getItem(exposureKey) === "1") return;
    window.localStorage.setItem(exposureKey, "1");
  }
  posthog.capture("landing_cta_exposure", {
    surface: "landing",
    experiment_id: LANDING_CTA_EXPERIMENT_ID,
    experiment_variant: assignment,
  });
}

export function trackBlogFeedWelcomeShown(props?: Record<string, unknown>) {
  posthog.capture("blog_feed_welcome_shown", { surface: "feed_v2", ...props });
}

export function trackBlogFeedWelcomeCta(source: string, campaign?: string) {
  posthog.capture("blog_feed_welcome_cta_clicked", {
    surface: "feed_v2",
    utm_source: source,
    utm_campaign: campaign || "",
  });
}

export function trackLandingCTAClicked(variant: string, location: string, props?: Record<string, unknown>) {
  posthog.capture("landing_cta_clicked", { variant, location, ...props });
}

export function trackBlogCtaClicked(postSlug: string, location: string, destination: string) {
  posthog.capture("blog_cta_clicked", {
    post_slug: postSlug,
    location,
    destination,
    surface: "web",
  });
}

/** Pro welcome modal auto-shown on /feed after a new user completes onboarding. */
export function trackFeedProWelcomeShown(props?: Record<string, unknown>) {
  posthog.capture("feed_pro_welcome_shown", {
    surface: "feed_pro_welcome",
    ...props,
  });
}
