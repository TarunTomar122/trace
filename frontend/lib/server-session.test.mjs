import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTraceSession,
  isTraceSessionProfileFresh,
  looksSignedIn,
  TRACE_SESSION_MAX_AGE_MS,
  TRACE_SIGNED_IN_MAX_AGE_MS,
  verifyTraceSession,
} from './server-session.ts';

const HOUR = 60 * 60 * 1000;

test('bounds trust in the profile embedded in a signed session to 36h', () => {
  const now = Date.parse('2026-07-24T00:02:00.000Z');
  assert.equal(isTraceSessionProfileFresh({ iat: (now - 35 * HOUR) / 1000, profile: { hasAccess: true } }, now), true);
  assert.equal(isTraceSessionProfileFresh({ iat: (now - 37 * HOUR) / 1000, profile: { hasAccess: true } }, now), false);
  assert.equal(isTraceSessionProfileFresh({ iat: now / 1000, profile: null }, now), false);
});

test('the session itself stays short, since API routes take it as proof of identity', () => {
  assert.equal(verifyTraceSession(createTraceSession('uid-1', null, Date.now() - 37 * HOUR)), null);
  assert.equal(verifyTraceSession(createTraceSession('uid-1', null, Date.now() - 35 * HOUR))?.uid, 'uid-1');
  const [header, , signature] = createTraceSession('uid-1').split('.');
  const forged = Buffer.from(JSON.stringify({ uid: 'someone-else', iat: 1, exp: 9999999999 })).toString('base64url');
  assert.equal(verifyTraceSession(`${header}.${forged}.${signature}`), null);
});

test('the homepage hint outlives the session but only counts when set', () => {
  assert.ok(TRACE_SIGNED_IN_MAX_AGE_MS >= 7 * TRACE_SESSION_MAX_AGE_MS);
  assert.equal(looksSignedIn(undefined, '1'), true);
  assert.equal(looksSignedIn(undefined, ''), false);
  assert.equal(looksSignedIn('garbage', undefined), false);
  assert.equal(looksSignedIn(createTraceSession('uid-1'), undefined), true);
});
