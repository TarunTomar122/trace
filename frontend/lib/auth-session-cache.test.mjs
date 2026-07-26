import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTH_SESSION_CACHE_FRESH_MS,
  isAuthSessionCacheFresh,
} from './auth-session-cache.ts';

test('treats only recent, valid profile snapshots as fresh', () => {
  const now = Date.parse('2026-07-24T00:01:00.000Z');
  assert.equal(
    isAuthSessionCacheFresh({ updatedAt: '2026-07-24T00:00:30.000Z' }, now),
    true,
  );
  assert.equal(
    isAuthSessionCacheFresh(
      { updatedAt: '2026-07-24T00:00:00.000Z' },
      now + AUTH_SESSION_CACHE_FRESH_MS,
    ),
    false,
  );
  assert.equal(isAuthSessionCacheFresh({ updatedAt: 'invalid' }, now), false);
  assert.equal(
    isAuthSessionCacheFresh({ updatedAt: '2026-07-24T00:02:00.000Z' }, now),
    false,
  );
});
