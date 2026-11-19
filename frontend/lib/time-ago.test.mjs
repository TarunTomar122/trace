import test from 'node:test';
import assert from 'node:assert/strict';
import { agoLabel, timeAgo } from './time-ago.ts';

test('timeAgo formats minutes, hours and days', () => {
  const now = Date.now();
  assert.equal(timeAgo(new Date(now - 5 * 60000).toISOString()), '5m ago');
  assert.equal(timeAgo(new Date(now - 3 * 3600000).toISOString()), '3h ago');
  assert.equal(timeAgo(new Date(now - 2 * 86400000).toISOString()), '2d ago');
  assert.equal(timeAgo(''), '');
  assert.equal(timeAgo('not a date'), '');
});

test('agoLabel prefers the raw time over a cached label', () => {
  const ts = Date.now() - 2 * 3600000;
  assert.equal(agoLabel({ time: '', ts }), '2h ago');
  assert.equal(agoLabel({ time: '9m ago', at: new Date(ts).toISOString() }), '2h ago');
  assert.equal(agoLabel({ time: '9m ago' }), '9m ago');
  assert.equal(agoLabel({ time: '', ts: 0 }), '');
});
