import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickStoryOfDay,
  pickLatestStory,
  checkNewMilestone,
} from './retention.ts';

test('pickStoryOfDay prefers multi-source top rank', () => {
  const stories = [
    { id: 'a', rank: 1, sources: ['a.com'] },
    { id: 'b', rank: 2, sources: ['a.com', 'b.com'] },
    { id: 'c', rank: 3, sources: ['x.com', 'y.com', 'z.com'] },
  ];
  assert.equal(pickStoryOfDay(stories)?.id, 'b');
});

test('pickStoryOfDay leads with fresh coverage over a two-day-old story', () => {
  const now = Date.parse('2026-10-18T06:00:00Z');
  const hours = (h) => now - h * 3_600_000;
  const flux = { id: 'flux', rank: 1, sources: ['a.com', 'b.com', 'c.com'], ts: hours(51) };
  const single = { id: 'single', rank: 2, sources: ['a.com'], ts: hours(6) };
  const muse = { id: 'muse', rank: 3, sources: ['a.com', 'b.com'], ts: hours(10) };
  assert.equal(pickStoryOfDay([flux, single, muse], now)?.id, 'muse');
  // Fresh but single-source still beats stale.
  assert.equal(pickStoryOfDay([flux, single], now)?.id, 'single');
  // Nothing fresh (a stalled pipeline): fall back to the top multi-source story.
  assert.equal(pickStoryOfDay([flux, { ...muse, ts: hours(40) }], now)?.id, 'flux');
  // Undated stories are not treated as stale.
  assert.equal(pickStoryOfDay([{ ...flux, ts: 0 }, muse], now)?.id, 'flux');
});

test('pickLatestStory returns the newest by timestamp', () => {
  const stories = [
    { id: 'old', ts: 100 },
    { id: 'new', ts: 300 },
    { id: 'mid', ts: 200 },
  ];
  assert.equal(pickLatestStory(stories)?.id, 'new');
  assert.equal(pickLatestStory([]), null);
});

test('checkNewMilestone returns highest unseen milestone', () => {
  assert.equal(checkNewMilestone(7, 3), 7);
  assert.equal(checkNewMilestone(5, 3), null);
});
