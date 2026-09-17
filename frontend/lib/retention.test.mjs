import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editionNumber,
  pickStoryOfDay,
  computeSinceLastVisit,
  checkNewMilestone,
  formatEditionCountdown,
  msUntilNextEdition,
} from './retention.ts';

test('editionNumber increments from epoch', () => {
  assert.equal(editionNumber('2025-01-01'), 1);
  assert.equal(editionNumber('2025-01-02'), 2);
});

test('pickStoryOfDay prefers multi-source top rank', () => {
  const stories = [
    { id: 'a', rank: 1, sources: ['a.com'] },
    { id: 'b', rank: 2, sources: ['a.com', 'b.com'] },
    { id: 'c', rank: 3, sources: ['x.com', 'y.com', 'z.com'] },
  ];
  assert.equal(pickStoryOfDay(stories)?.id, 'b');
});

test('computeSinceLastVisit counts unseen stories on same edition day', () => {
  const stories = [
    { id: '1', cat: 'ai' },
    { id: '2', cat: 'ai' },
    { id: '3', cat: 'tech' },
  ];
  const last = { visitedAt: '2026-01-01', feedDate: '2026-09-17', storyIds: ['1'] };
  const summary = computeSinceLastVisit(stories, last, '2026-09-17', ['ai']);
  assert.equal(summary.totalNew, 1);
  assert.equal(summary.isFirstVisit, false);
});

test('checkNewMilestone returns highest unseen milestone', () => {
  assert.equal(checkNewMilestone(7, 3), 7);
  assert.equal(checkNewMilestone(5, 3), null);
});

test('formatEditionCountdown renders hours and minutes', () => {
  const text = formatEditionCountdown(90 * 60000);
  assert.match(text, /1h 30m/);
});

test('msUntilNextEdition is positive', () => {
  assert.ok(msUntilNextEdition() > 0);
});
