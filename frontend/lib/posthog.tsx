"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";
import { EMAIL_VISIT_PARAM } from "@/lib/email-visit";
import { beaconSignedIn, beaconTrack } from "@/lib/analytics/beacon";
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
    !window.location.pathname.startsWith("/admin") && Boolean(posthogKey) &&
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
  const lastUrl = useRef("");

  useEffect(() => {
    if (pathname && !pathname.startsWith("/admin")) {
      // The email visit id is the send's own id: never send it to analytics.
      // Dropping it from the address bar then repeats the same URL, which
      // is not a second page view.
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.delete(EMAIL_VISIT_PARAM);
      const query = params.toString();
      const url = window.origin + pathname + (query ? `?${query}` : "");
      if (url === lastUrl.current) return;
      lastUrl.current = url;
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

/**
 * Every tracked event goes to PostHog and to the first-party beacon (lib/analytics/beacon.ts), which keeps only
 * the key events /admin/analytics counts. Pageviews reach the beacon from components/admin-analytics/beacon.tsx.
 */
export function capture(event: string, properties?: Record<string, unknown>) {
  beaconTrack(event, properties);
  posthog.capture(event, properties);
}

// ============================================================================
// TRACKING HELPER FUNCTIONS
// ============================================================================

// Identify user after sign in (links anonymous events to user)
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  beaconSignedIn(true);
  posthog.identify(userId, properties);
}

// Reset user on sign out
export function resetUser() {
  beaconSignedIn(false);
  posthog.reset();
}

// ============================================================================
// EVENT TRACKING FUNCTIONS
// ============================================================================

// Auth events
/** The Google sign-in popup (or redirect) was opened. */
export function trackSignInStarted() {
  capture("signin_started", { surface: "web" });
}

export function trackSignIn(method: "google" | "email" = "google") {
  capture("user_signed_in", { method, surface: "web" });
}

export function trackSignUp(method: "google" | "email" = "google") {
  capture("user_signed_up", { method, surface: "web" });
}

export function trackSignOut() {
  capture("user_signed_out", { surface: "web" });
}

// Onboarding events
export function trackOnboardingStarted() {
  capture("onboarding_started", { surface: "web" });
}

export function trackOnboardingStepCompleted(step: number, stepName: string) {
  capture("onboarding_step_completed", { step, step_name: stepName, surface: "web" });
}

export function trackOnboardingCompleted(data: {
  interests_count: number;
  hobbies_count: number;
  role?: string;
  daily_brief_enabled?: boolean;
}) {
  capture("onboarding_completed", { ...data, surface: "web" });
}

// Feed events
export function trackFeedViewed(
  itemCount: number,
  isPreview = false,
  view: FeedView = "edition",
  tier: FeedTier = isPreview ? "free" : "pro",
  audience: "guest" | "authenticated" = "authenticated",
) {
  capture(
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
  capture(FEED_EVENTS.storyExpanded, storyInteractionProperties(input));
}

export function trackFeedSourceClicked(input: {
  itemId: string;
  itemType: string;
  source?: string;
  position: number;
  section: string;
  tier: FeedTier;
}) {
  capture(FEED_EVENTS.sourceClicked, storyInteractionProperties(input));
}

export function trackFeedFilterChanged(
  filter: string,
  previousFilter: string,
  props?: Record<string, unknown>,
) {
  capture(FEED_EVENTS.filterChanged, {
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
  capture(
    FEED_EVENTS.dailyBriefPreferenceChanged,
    dailyBriefPreferenceProperties({ enabled, location }),
  );
}

export function trackFeedOlderLoaded(addedCount: number, totalCount: number) {
  capture(FEED_EVENTS.olderLoaded, {
    surface: "web",
    added_count: Math.max(0, addedCount),
    total_count: Math.max(0, totalCount),
  });
}

export function trackFeedItemClicked(itemId: string, itemType: string, source: string) {
  capture("feed_item_clicked", {
    item_id: itemId,
    item_type: itemType,
    source,
    surface: "web",
  });
}

export function trackSponsoredToolClicked({
  sponsorId,
  title,
  domain,
  placement,
  position,
  feedDate,
}: {
  sponsorId: string;
  title: string;
  domain: string;
  placement: 'desktop_tools' | 'home_feed_end' | 'pulse_mobile' | 'brief_rail';
  position: number;
  feedDate?: string;
}) {
  capture("sponsored_tool_clicked", {
    sponsor_id: sponsorId,
    sponsor_title: title,
    sponsor_domain: domain,
    placement,
    position,
    feed_date: feedDate,
    surface: "web",
  });
}

export function trackFeedItemUpvoted(itemId: string, itemType: string) {
  capture("feed_item_upvoted", { item_id: itemId, item_type: itemType });
}

export function trackFeedItemDownvoted(itemId: string, itemType: string) {
  capture("feed_item_downvoted", { item_id: itemId, item_type: itemType });
}

export function trackFeedItemBookmarked(
  itemId: string,
  itemType: string,
  props?: Record<string, unknown>,
) {
  capture("feed_item_bookmarked", {
    item_id: itemId,
    item_type: itemType,
    surface: "web",
    ...props,
  });
}

export function trackShareInitiated(itemId: string, props?: Record<string, unknown>) {
  capture("share_initiated", { item_id: itemId, surface: "web", ...props });
}

export function trackPromoModalOpened(props?: Record<string, unknown>) {
  capture("promo_modal_opened", { surface: "web", ...props });
}

export function trackPromoCtaClicked(props?: Record<string, unknown>) {
  capture("promo_cta_clicked", { surface: "web", ...props });
}

export function trackPromoIntent(props?: Record<string, unknown>) {
  capture("promo_intent", { surface: "web", ...props });
}

export function trackPromoSubmitted(props?: Record<string, unknown>) {
  capture("promo_submitted", { surface: "web", ...props });
}

export function trackPurchaseCompleted(product: "tool_promo") {
  capture("purchase_completed", { surface: "web", product });
}

// Profile events
export function trackProfileViewed() {
  capture("profile_viewed");
}

export function trackProfileUpdated(fields: string[]) {
  capture("profile_updated", { fields_updated: fields });
}

export function trackSubscriptionCancelled(plan: string) {
  capture("subscription_cancelled", { plan });
}

// Conversion funnel events
// The feed's corner email card: shown, then dismissed or a signup (newsletter_signup, source feed_prompt).
export function trackNewsletterPrompt(action: "shown" | "dismissed") {
  capture("newsletter_prompt", { surface: "web", action });
}

export function trackNewsletterSignup(
  source: "landing" | "feed_prompt" | "daily_page" | "blog_inline" | "featured_page",
  props?: Record<string, unknown>,
) {
  capture("newsletter_signup", { ...props, surface: "web", source });
}

export function trackSummaryOpened(
  itemId: string,
  isPaidUser: boolean,
  props?: Record<string, unknown>,
) {
  capture("summary_opened", {
    item_id: itemId,
    is_paid_user: isPaidUser,
    surface: "web",
    ...props,
  });
}

export function trackCheckoutClicked(source: string, props?: Record<string, unknown>) {
  capture("checkout_clicked", {
    source,
    ...props,
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
  capture("landing_cta_exposure", {
    surface: "landing",
    experiment_id: LANDING_CTA_EXPERIMENT_ID,
    experiment_variant: assignment,
  });
}

export function trackBlogFeedWelcomeShown(props?: Record<string, unknown>) {
  capture("blog_feed_welcome_shown", { surface: "feed_v2", ...props });
}

export function trackBlogFeedWelcomeCta(source: string, campaign?: string) {
  capture("blog_feed_welcome_cta_clicked", {
    surface: "feed_v2",
    utm_source: source,
    utm_campaign: campaign || "",
  });
}

export function trackLandingCTAClicked(variant: string, location: string, props?: Record<string, unknown>) {
  capture("landing_cta_clicked", { variant, location, ...props });
}

export function trackBlogCtaClicked(postSlug: string, location: string, destination: string) {
  capture("blog_cta_clicked", {
    post_slug: postSlug,
    location,
    destination,
    surface: "web",
  });
}

export function trackRetentionMilestoneShown(days: number) {
  capture("retention_milestone_shown", { days, surface: "web" });
}

export function trackRetentionCaughtUpShare(streak: number, storiesRead: number) {
  capture("retention_caught_up_shared", { streak, stories_read: storiesRead, surface: "web" });
}

export function trackRetentionExtensionClicked(placement: string) {
  capture("retention_extension_clicked", { placement, surface: "web" });
}

export function trackRetentionThreadFollowed(input: {
  threadId: string;
  following: boolean;
  storyId?: string;
  title?: string;
  cat?: string;
  tab?: string;
}) {
  capture("retention_thread_followed", {
    thread_id: input.threadId,
    following: input.following,
    story_id: input.storyId || '',
    title: input.title || '',
    cat: input.cat || '',
    tab: input.tab || '',
    surface: "web",
  });
}
