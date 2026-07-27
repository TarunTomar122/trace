import assert from 'node:assert/strict';
import test from 'node:test';
import { getSignedInLandingDestination } from './landing-routing.ts';

test('routes returning readers immediately without consuming unresolved checkout intent', () => {
  assert.equal(getSignedInLandingDestination(null, false, null), '/feed?view=pulse');
  assert.equal(getSignedInLandingDestination(null, false, 'read'), '/feed?view=pulse');
  assert.equal(getSignedInLandingDestination(null, false, 'checkout'), null);
  assert.equal(
    getSignedInLandingDestination({ onboarded: true }, true, 'checkout'),
    '/profile?tab=subscription&intent=checkout',
  );
});
