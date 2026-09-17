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
