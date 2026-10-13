import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasPaidSubscription,
  toDateMaybe,
} from './subscription-access.ts';

test('recognizes a paid plan from either web or app subscriptions (billing UI only, never gates access)', () => {
  assert.equal(hasPaidSubscription({ subscriptionStatus: 'active' }), true);
  assert.equal(hasPaidSubscription({ appSubscriptionStatus: 'trial' }), true);
  assert.equal(hasPaidSubscription({ subscriptionStatus: 'cancelled' }), false);
  assert.equal(
    hasPaidSubscription(
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
    hasPaidSubscription(
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
