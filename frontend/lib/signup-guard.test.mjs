import assert from 'node:assert/strict';
import test from 'node:test';
import { busyMessage, createSignupGuard, tooManyTriesMessage, trapFilled, TRAP_FIELD, visitorKey } from './signup-guard.ts';

test('trapFilled: empty or missing trap passes, anything typed in it is a bot', () => {
  assert.equal(TRAP_FIELD, 'hp_note');
  assert.equal(trapFilled({ email: 'a@b.co' }), false);
  assert.equal(trapFilled({ [TRAP_FIELD]: '' }), false);
  assert.equal(trapFilled({ [TRAP_FIELD]: '   ' }), false);
  assert.equal(trapFilled(null), false);
  assert.equal(trapFilled({ [TRAP_FIELD]: 'https://spam.example' }), true);
  assert.equal(trapFilled({ [TRAP_FIELD]: 1 }), true);
});

test('one visitor gets a few attempts per window, then a retry time and a message', () => {
  const guard = createSignupGuard({ limit: 3, windowMs: 60_000 }, { limit: 100, windowMs: 60_000 });
  const t = 1_000_000;
  for (let i = 0; i < 3; i += 1) assert.deepEqual(guard.visitor('1.2.3.4', t + i), { ok: true });
  const blocked = guard.visitor('1.2.3.4', t + 10);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec > 0 && blocked.retryAfterSec <= 60);
  assert.equal(blocked.message, 'Too many tries. Try again in 1 minute.');
  // another visitor is unaffected, and the first is let back in after the window
  assert.deepEqual(guard.visitor('5.6.7.8', t + 10), { ok: true });
  assert.deepEqual(guard.visitor('1.2.3.4', t + 60_000), { ok: true });
});

test('site-wide cap stops a burst of new entries from many addresses (the 23 Nov pattern)', () => {
  const guard = createSignupGuard();
  const t = 2_000_000;
  // 12 new addresses about 5 s apart, each from a different visitor
  const results = Array.from({ length: 12 }, (_, i) => guard.newEntry(`10.0.0.${i}`, t + i * 5_000));
  assert.equal(results.filter((r) => r.ok).length, 4);
  assert.match(results[11].message, /^Lots of signups at once right now\. Try again in \d+ minutes?\.$/);
  // an ordinary signup later still goes through
  assert.deepEqual(guard.newEntry('10.0.1.1', t + 5 * 60_000 + 1), { ok: true });
});

test('one visitor cannot fill the site-wide cap and lock real people out', () => {
  const guard = createSignupGuard();
  const t = 3_000_000;
  assert.equal(guard.newEntry('9.9.9.9', t).ok, true);
  assert.equal(guard.newEntry('9.9.9.9', t + 1).ok, true);
  const third = guard.newEntry('9.9.9.9', t + 2);
  assert.equal(third.ok, false);
  assert.equal(third.message, 'Too many signups from your connection today. Try again tomorrow.');
  // the site-wide cap still has room for two real people
  assert.equal(guard.newEntry('1.1.1.1', t + 3).ok, true);
  assert.equal(guard.newEntry('2.2.2.2', t + 4).ok, true);
});

test('IPv6 visitors are counted by their /64', () => {
  assert.equal(visitorKey('2001:db8:aa:bb:1::1'), '2001:db8:aa:bb::/64');
  assert.equal(visitorKey('2001:0db8:00aa:00bb:ffff:1:2:3'), '2001:db8:aa:bb::/64');
  assert.equal(visitorKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(visitorKey('203.0.113.9'), '203.0.113.9');
  assert.equal(visitorKey('unknown'), 'unknown');
  const guard = createSignupGuard();
  assert.equal(guard.newEntry('2001:db8:aa:bb::1', 0).ok, true);
  assert.equal(guard.newEntry('2001:db8:aa:bb::2', 1).ok, true);
  assert.equal(guard.newEntry('2001:db8:aa:bb:ffff::3', 2).ok, false);
});

test('messages round the wait up to whole minutes', () => {
  assert.equal(tooManyTriesMessage(1), 'Too many tries. Try again in 1 minute.');
  assert.equal(tooManyTriesMessage(599), 'Too many tries. Try again in 10 minutes.');
  assert.equal(busyMessage(61), 'Lots of signups at once right now. Try again in 2 minutes.');
});
