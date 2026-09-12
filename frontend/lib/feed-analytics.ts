export type FeedView = 'edition' | 'pulse';
export type FeedTier = 'free' | 'pro';

export const FEED_EVENTS = {
  viewed: 'feed_viewed',
  storyExpanded: 'feed_story_expanded',
  sourceClicked: 'feed_source_clicked',
  filterChanged: 'feed_filter_changed',
  dailyBriefPreferenceChanged: 'daily_brief_preference_changed',
  olderLoaded: 'feed_older_loaded',
} as const;

const WEB_SURFACE = 'web' as const;

export function feedViewedProperties(input: {
  itemCount: number;
  isPreview: boolean;
  view: FeedView;
  tier: FeedTier;
  audience: 'guest' | 'authenticated';
}) {
  return {
    surface: WEB_SURFACE,
    item_count: Math.max(0, input.itemCount),
    is_preview: input.isPreview,
    view: input.view,
    tier: input.tier,
    audience: input.audience,
  };
}

export function storyInteractionProperties(input: {
  itemId: string;
  itemType: string;
  source?: string;
  position: number;
  section: string;
  tier: FeedTier;
}) {
  return {
    surface: WEB_SURFACE,
    item_id: input.itemId,
    item_type: input.itemType,
    source: input.source || 'unknown',
    position: Math.max(1, input.position),
    section: input.section,
    tier: input.tier,
  };
}

export function dailyBriefPreferenceProperties(input: {
  enabled: boolean;
  location: 'onboarding' | 'feed' | 'profile';
}) {
  return {
    surface: WEB_SURFACE,
    enabled: input.enabled,
    location: input.location,
  };
}
