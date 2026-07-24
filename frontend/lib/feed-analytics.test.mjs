import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FEED_EVENTS,
  dailyBriefPreferenceProperties,
  feedViewedProperties,
  storyInteractionProperties,
} from './feed-analytics.ts';

test('feed activation events are stable and web-scoped', () => {
  assert.deepEqual(FEED_EVENTS, {
    viewed: 'feed_viewed',
    storyExpanded: 'feed_story_expanded',
    sourceClicked: 'feed_source_clicked',
    filterChanged: 'feed_filter_changed',
    dailyBriefPreferenceChanged: 'daily_brief_preference_changed',
  });

  assert.deepEqual(
    feedViewedProperties({
      itemCount: 12,
      isPreview: true,
      view: 'edition',
      tier: 'free',
      audience: 'authenticated',
    }),
    {
      surface: 'web',
      item_count: 12,
      is_preview: true,
      view: 'edition',
      tier: 'free',
      audience: 'authenticated',
    },
  );
});

test('story interactions preserve the fields needed for activation analysis', () => {
  assert.deepEqual(
    storyInteractionProperties({
      itemId: 'story-1',
      itemType: 'topic',
      source: '',
      position: 0,
      section: 'ai',
      tier: 'pro',
    }),
    {
      surface: 'web',
      item_id: 'story-1',
      item_type: 'topic',
      source: 'unknown',
      position: 1,
      section: 'ai',
      tier: 'pro',
    },
  );
});

test('daily brief preference records explicit consent location', () => {
  assert.deepEqual(
    dailyBriefPreferenceProperties({ enabled: true, location: 'onboarding' }),
    {
      surface: 'web',
      enabled: true,
      location: 'onboarding',
    },
  );
});
