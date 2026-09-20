import assert from 'node:assert/strict';
import test from 'node:test';

import { filterSendWorthyTopics, rejectedStoryUrls } from './feed-value.ts';

test('drops topics Jev scored 0 and keeps the rest', () => {
  const topics = [
    { id: 'a', title: 'Puzzle answers', jev_send_worthy: 0 },
    { id: 'b', title: 'Model launch', jev_send_worthy: 2 },
    { id: 'c', title: 'Unscored legacy story' },
  ];
  assert.deepEqual(
    filterSendWorthyTopics(topics).map((t) => t.id),
    ['b', 'c'],
  );
});

test('handles undefined and empty input', () => {
  assert.deepEqual(filterSendWorthyTopics(undefined), []);
  assert.deepEqual(filterSendWorthyTopics([]), []);
});

test('rejectedStoryUrls collects article urls only from rejected topics', () => {
  const urls = rejectedStoryUrls([
    {
      id: 'a',
      jev_send_worthy: 0,
      articles: [{ url: 'https://cnet.com/connections' }, { url: ' ' }],
    },
    { id: 'b', jev_send_worthy: 2, articles: [{ url: 'https://theverge.com/keep' }] },
  ]);
  assert.deepEqual([...urls], ['https://cnet.com/connections']);
});

test('a null verdict is not a rejection', () => {
  assert.equal(filterSendWorthyTopics([{ id: 'a', jev_send_worthy: null }]).length, 1);
});
