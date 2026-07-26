import assert from 'node:assert/strict';
import test from 'node:test';
import {
  personalizedFeedRefreshKey,
  shouldRefreshPersonalizedFeed,
} from './feed-bootstrap.ts';

const profile = {
  uid: 'user-1',
  role: 'founder',
  onboarded: true,
  interests: ['ai', 'startups'],
};

const matchingFeed = {
  viewer_profile: {
    role: 'founder',
    onboarded: true,
    interests: ['startups', 'ai'],
  },
};

test('reconciles a public or mismatched streamed feed after auth resolves', () => {
  assert.equal(
    shouldRefreshPersonalizedFeed({
      feed: matchingFeed,
      initialFeedAuthenticated: false,
      profile,
      profileFresh: true,
    }),
    true,
  );
  assert.equal(
    shouldRefreshPersonalizedFeed({
      feed: { viewer_profile: { ...matchingFeed.viewer_profile, role: 'developer' } },
      initialFeedAuthenticated: true,
      profile,
      profileFresh: true,
    }),
    true,
  );
});

test('keeps a matching authenticated bootstrap and waits for a fresh profile', () => {
  assert.equal(
    shouldRefreshPersonalizedFeed({
      feed: matchingFeed,
      initialFeedAuthenticated: true,
      profile,
      profileFresh: true,
    }),
    false,
  );
  assert.equal(
    shouldRefreshPersonalizedFeed({
      feed: null,
      initialFeedAuthenticated: false,
      profile,
      profileFresh: false,
    }),
    false,
  );
});

test('uses a stable refresh key for equivalent interest ordering', () => {
  assert.equal(
    personalizedFeedRefreshKey(profile),
    personalizedFeedRefreshKey({ ...profile, interests: ['startups', 'ai'] }),
  );
});
