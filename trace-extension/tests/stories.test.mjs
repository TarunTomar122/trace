import assert from 'node:assert/strict';
import test from 'node:test';

import {
  agoLabel,
  bookmarkPayload,
  filterStories,
  insertAt,
  isCacheFresh,
  normalizeBookmarks,
  normalizeRemoteBookmarks,
  normalizeStoryPool,
  storyTopics,
} from '../lib/stories.js';

function story(i, cat = 'ai') {
  return {
    id: `topic-${i}`,
    title: `Story ${i}`,
    body: `Body ${i}`,
    detail: `First ${i}\n\nSecond ${i}`,
    cat,
    cat_label: cat === 'ai' ? 'AI' : 'Markets',
    img: `https://img.example.com/${i}.jpg`,
    source: 'Example',
    source_count: 3,
    url: `https://example.com/${i}`,
    trace_url: `https://www.yourtrace.online/story/topic-${i}`,
    coverage: [{ title: `Other ${i}`, source: 'Other', url: `https://other.com/${i}` }],
    ts: 1_700_000_000_000,
  };
}

const payload = {
  version: 6,
  feed_date: '2026-11-24',
  stories: Array.from({ length: 10 }, (_, i) => story(i, i % 2 ? 'markets' : 'ai')),
  sponsors: [{ id: 'sponsor123', title: 'Calenteri', sub: 'Booking links', host: 'calenteri.com', href: 'https://www.yourtrace.online/api/tools/go?id=sponsor123&p=extension' }],
  sponsor_url: 'https://www.yourtrace.online/feed?sponsor=open',
};

test('normalizeStoryPool keeps one card per story and splits the detail into paragraphs', () => {
  const pool = normalizeStoryPool({ ...payload, stories: [...payload.stories, story(0), { ...story(99), url: 'https://example.com/1' }] });
  assert.equal(pool.stories.length, 10);
  assert.deepEqual(pool.stories[0].detail, ['First 0', 'Second 0']);
  assert.equal(pool.stories[0].sourceCount, 3);
  assert.equal(pool.sponsors.length, 1);
  assert.equal(pool.sponsorUrl, 'https://www.yourtrace.online/feed?sponsor=open');
});

test('normalizeStoryPool rejects old payloads, thin pools, unsafe links and sponsors not routed through Trace', () => {
  assert.throws(() => normalizeStoryPool({ ...payload, version: 5 }));
  assert.throws(() => normalizeStoryPool({ ...payload, stories: payload.stories.slice(0, 7) }));
  const pool = normalizeStoryPool({
    ...payload,
    stories: [...payload.stories, { ...story(50), url: 'javascript:alert(1)' }],
    sponsors: [{ id: 'x1234567', title: 'Bad', href: 'https://evil.example/' }],
    sponsor_url: 'https://evil.example/',
  });
  assert.equal(pool.stories.length, 10);
  assert.equal(pool.sponsors.length, 0);
  assert.equal(pool.sponsorUrl, '');
});

test('topics come in the site order and filter by category', () => {
  const pool = normalizeStoryPool(payload);
  assert.deepEqual(storyTopics(pool.stories).map((t) => t.label), ['AI', 'Markets']);
  assert.equal(filterStories(pool.stories, 'markets').length, 5);
  assert.equal(filterStories(pool.stories, '').length, 10);
});

test('cache freshness and time labels', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  assert.equal(isCacheFresh('2026-11-24T11:55:00Z', now), true);
  assert.equal(isCacheFresh('2026-11-24T11:40:00Z', now), false);
  assert.equal(isCacheFresh('nope', now), false);
  assert.equal(agoLabel(now - 5 * 60_000, now), '5m ago');
  assert.equal(agoLabel(now - 3 * 3600_000, now), '3h ago');
  assert.equal(agoLabel(0, now), '');
});

test('bookmarks round-trip through the site record and local storage', () => {
  const [first] = normalizeStoryPool(payload).stories;
  const record = bookmarkPayload(first);
  assert.equal(record.item_id, 'topic-0');
  const [back] = normalizeRemoteBookmarks([record]);
  assert.equal(back.title, 'Story 0');
  assert.equal(back.traceUrl, 'https://www.yourtrace.online/story/topic-0');
  const [old] = normalizeRemoteBookmarks([{ item_id: 'fy_abc', item_metadata: { title: 'Old', url: 'https://x.com/a' } }]);
  assert.equal(old.traceUrl, 'https://www.yourtrace.online/articles/fy_abc');
  assert.equal(normalizeBookmarks([first, first]).length, 1);
});

test('sponsor cards land on their final spots (3rd, 9th, 11th, 19th)', () => {
  const cards = Array.from({ length: 30 }, (_, i) => `s${i}`);
  const out = insertAt(cards, [[2, 'A'], [10, 'B'], [18, 'C'], [8, 'H']]);
  assert.equal(out.indexOf('A'), 2);
  assert.equal(out.indexOf('H'), 8);
  assert.equal(out.indexOf('B'), 10);
  assert.equal(out.indexOf('C'), 18);
  assert.equal(out.length, 34);
  assert.deepEqual(insertAt(['a'], [[5, 'X']]), ['a']);
});

test('synced story bookmarks (tr_ ids too) open as stories; descriptions stay valid for the site', () => {
  const [story] = normalizeRemoteBookmarks([{ item_id: 'tr_abc', item_metadata: { title: 'S', url: 'https://x.com/s', tags: ['markets'] } }]);
  assert.equal(story.traceUrl, 'https://www.yourtrace.online/story/tr_abc');
  assert.equal(story.catLabel, 'Markets');
  const empty = bookmarkPayload({ ...story, body: '', detail: [] });
  assert.equal('description' in empty.item_metadata, false);
  const long = bookmarkPayload({ ...story, body: 'x'.repeat(5000) });
  assert.equal(long.item_metadata.description.length, 2000);
});

test('markdown bold from the site shows as plain text', () => {
  const pool = normalizeStoryPool({ ...payload, stories: payload.stories.map((s, i) => (i ? s : { ...s, body: 'A **big** day', detail: 'One **two**\n\nThree' })) });
  assert.equal(pool.stories[0].body, 'A big day');
  assert.deepEqual(pool.stories[0].detail, ['One two', 'Three']);
});
