import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasActiveSubscription,
  resolveFeedAccess,
  toDateMaybe,
} from './subscription-access.ts';

test('recognizes active access from either web or app subscriptions', () => {
  assert.equal(hasActiveSubscription({ subscriptionStatus: 'active' }), true);
  assert.equal(hasActiveSubscription({ appSubscriptionStatus: 'trial' }), true);
  assert.equal(hasActiveSubscription({ subscriptionStatus: 'cancelled' }), false);
  assert.equal(
    hasActiveSubscription(
      {
        subscriptionStatus: 'active',
        cancelledAt: '2026-01-01T00:00:00.000Z',
        willCancelAt: '2026-02-01T00:00:00.000Z',
      },
      new Date('2026-03-01T00:00:00.000Z'),
    ),
    false,
  );
  assert.equal(
    hasActiveSubscription(
      {
        subscriptionStatus: 'active',
        appSubscriptionStatus: 'active',
        cancelledAt: '2026-01-01T00:00:00.000Z',
        willCancelAt: '2026-02-01T00:00:00.000Z',
      },
      new Date('2026-03-01T00:00:00.000Z'),
    ),
    true,
  );
});

test('active access from either fresh profile source wins', () => {
  assert.deepEqual(
    resolveFeedAccess({
      serverHasAccess: false,
      clientProfile: { subscriptionStatus: 'active' },
      clientProfileFresh: true,
      clientProfileRefreshFailed: false,
      authLoading: false,
      signedIn: true,
    }),
    { hasAccess: true, pending: false, verificationFailed: false },
  );

  assert.deepEqual(
    resolveFeedAccess({
      serverHasAccess: true,
      clientProfile: { subscriptionStatus: 'expired' },
      clientProfileFresh: true,
      clientProfileRefreshFailed: false,
      authLoading: false,
      signedIn: true,
    }),
    { hasAccess: true, pending: false, verificationFailed: false },
  );
});

test('does not show a false paywall while a signed-in profile is being refreshed', () => {
  assert.deepEqual(
    resolveFeedAccess({
      serverHasAccess: false,
      clientProfile: { subscriptionStatus: 'none' },
      clientProfileFresh: false,
      clientProfileRefreshFailed: false,
      authLoading: false,
      signedIn: true,
    }),
    { hasAccess: false, pending: true, verificationFailed: false },
  );
});

test('does not trust an arbitrarily old active client snapshot', () => {
  assert.deepEqual(
    resolveFeedAccess({
      serverHasAccess: false,
      clientProfile: { subscriptionStatus: 'active' },
      clientProfileFresh: false,
      clientProfileRefreshFailed: false,
      authLoading: false,
      signedIn: true,
    }),
    { hasAccess: false, pending: true, verificationFailed: false },
  );
});

test('keeps the paywall hidden and exposes a retry state when verification fails', () => {
  assert.deepEqual(
    resolveFeedAccess({
      serverHasAccess: false,
      clientProfile: { subscriptionStatus: 'none' },
      clientProfileFresh: false,
      clientProfileRefreshFailed: true,
      authLoading: false,
      signedIn: true,
    }),
    { hasAccess: false, pending: true, verificationFailed: true },
  );
});

test('guests resolve to free access after auth finishes', () => {
  assert.deepEqual(
    resolveFeedAccess({
      serverHasAccess: false,
      clientProfile: null,
      clientProfileFresh: true,
      clientProfileRefreshFailed: false,
      authLoading: false,
      signedIn: false,
    }),
    { hasAccess: false, pending: false, verificationFailed: false },
  );
});

test('auth hydration stays pending before the current user resolves', () => {
  assert.deepEqual(
    resolveFeedAccess({
      serverHasAccess: false,
      clientProfile: null,
      clientProfileFresh: false,
      clientProfileRefreshFailed: false,
      authLoading: true,
      signedIn: false,
    }),
    { hasAccess: false, pending: true, verificationFailed: false },
  );
});

test('parses checkout timestamps from Date, ISO, and Firestore-like values without throwing', () => {
  const iso = '2026-09-17T18:00:00.000Z';
  assert.equal(toDateMaybe(new Date(iso))?.toISOString(), iso);
  assert.equal(toDateMaybe(iso)?.toISOString(), iso);
  assert.equal(toDateMaybe({ seconds: Date.parse(iso) / 1000 })?.toISOString(), iso);
  assert.equal(toDateMaybe({ _seconds: Date.parse(iso) / 1000 })?.toISOString(), iso);
  assert.equal(toDateMaybe({ toDate: () => new Date(iso) })?.toISOString(), iso);
  assert.equal(toDateMaybe({}), null);
  assert.equal(toDateMaybe('not-a-date'), null);
});
