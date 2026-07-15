import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySignupPlatform } from './analytics-platform.ts';

test('uses explicit signup platform before legacy signals', () => {
  assert.equal(classifySignupPlatform({ signupPlatform: 'web', pushToken: 'token' }), 'web');
  assert.equal(classifySignupPlatform({ signupPlatform: 'mobile' }), 'mobile');
});

test('classifies legacy mobile profiles and defaults remaining profiles to web', () => {
  assert.equal(classifySignupPlatform({ pushNotificationsEnabled: false }), 'mobile');
  assert.equal(classifySignupPlatform({ referralSource: 'friend' }), 'mobile');
  assert.equal(classifySignupPlatform({}), 'web');
});
