import assert from 'node:assert/strict';
import test from 'node:test';
import { isTraceSessionProfileFresh } from './server-session.ts';

test('bounds trust in the entitlement embedded in a signed session', () => {
  const now = Date.parse('2026-07-24T00:02:00.000Z');
  assert.equal(
    isTraceSessionProfileFresh({ iat: now / 1000 - 30, profile: { hasAccess: true } }, now),
    true,
  );
  assert.equal(
    isTraceSessionProfileFresh({ iat: now / 1000 - 61, profile: { hasAccess: true } }, now),
    false,
  );
  assert.equal(
    isTraceSessionProfileFresh({ iat: now / 1000, profile: null }, now),
    false,
  );
});
