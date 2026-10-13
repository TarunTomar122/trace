import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FREE_SUMMARY_LIMIT,
  addSummaryRead,
  canOpenSummary,
  filterArticlesByTag,
  isCacheFresh,
  normalizeArticlePool,
  normalizeBookmarks,
  normalizeRemoteBookmarks,
  normalizeSummaryReads,
  selectRandomArticles,
} from '../lib/brief.js';

function article(id, channel = 'edition') {
  return {
    id,
    channel,
    title: `Article ${id}`,
    summary: `Summary ${id}`,
    content: [{ type: 'paragraph', text: `Body ${id}` }],
    tag: 'AI',
    source_url: `https://example.com/${id}`,
    source: 'Example',
    key_takeaways: [],
  };
}

const validPayload = {
  version: 5,
  feed_date: '2026-08-05',
  generated_at: '2026-08-05T06:05:00.000Z',
  articles: Array.from({ length: 30 }, (_, index) => article(`edition-${index}`)),
};

test('normalizeArticlePool accepts safe Edition articles', () => {
  const pool = normalizeArticlePool(validPayload);

  assert.equal(pool.feedDate, '2026-08-05');
  assert.equal(pool.articles.length, 30);
  assert.equal(pool.articles.every(({ channel }) => channel === 'edition'), true);
  assert.equal(pool.articles.every(({ tag }) => tag === 'AI'), true);
});

test('normalizeArticlePool upgrades the deployed version 4 response', () => {
  const pool = normalizeArticlePool({
    ...validPayload,
    version: 4,
    articles: validPayload.articles.map((item, index) => ({
      ...item,
      id: `edition:tr_${index}`,
    })),
  });

  assert.equal(pool.version, 5);
  assert.equal(pool.articles[0].id, 'tr_0');
  assert.equal(pool.articles[0].shareUrl, 'https://www.yourtrace.online/articles/tr_0');
});

test('normalizeArticlePool rejects malformed or unsafe responses', () => {
  assert.throws(() => normalizeArticlePool(null), /article response/i);
  assert.throws(() => normalizeArticlePool({ ...validPayload, version: 1 }), /version/i);
  assert.throws(
    () => normalizeArticlePool({
      ...validPayload,
      articles: [{ ...article('bad'), source_url: 'javascript:alert(1)' }, ...validPayload.articles.slice(1)],
    }),
    /http or https/i,
  );
  assert.throws(
    () => normalizeArticlePool({
      ...validPayload,
      articles: [{ ...article('empty'), content: [] }, ...validPayload.articles.slice(1)],
    }),
    /full-read content/i,
  );
  assert.throws(
    () => normalizeArticlePool({
      ...validPayload,
      articles: [article('pulse', 'pulse'), ...validPayload.articles.slice(1)],
    }),
    /edition article channel/i,
  );
  assert.throws(
    () => normalizeArticlePool({
      ...validPayload,
      articles: [{ ...article('untagged'), tag: '' }, ...validPayload.articles.slice(1)],
    }),
    /story tag/i,
  );
});

test('selectRandomArticles returns 31 unique Edition articles by default', () => {
  const articles = normalizeArticlePool({
    ...validPayload,
    articles: Array.from({ length: 40 }, (_, index) => article(`edition-${index}`)),
  }).articles;
  const selected = selectRandomArticles(articles, undefined, () => 0.42);

  assert.equal(selected.length, 31);
  assert.equal(new Set(selected.map(({ id }) => id)).size, 31);
  assert.equal(selected.every(({ channel }) => channel === 'edition'), true);
});

test('filterArticlesByTag reuses the loaded pool', () => {
  const articles = [
    { id: 'ai', tag: 'AI' },
    { id: 'markets', tag: 'Markets' },
    { id: 'all', tag: 'AI' },
  ];

  assert.deepEqual(filterArticlesByTag(articles, 'AI').map(({ id }) => id), ['ai', 'all']);
  assert.equal(filterArticlesByTag(articles, ''), articles);
});

test('normalizeArticlePool rejects an incomplete pool', () => {
  assert.throws(
    () => normalizeArticlePool({ ...validPayload, articles: validPayload.articles.slice(0, 29) }),
    /at least 30/i,
  );
});

test('normalizeArticlePool preserves every full-read content block', () => {
  const content = Array.from({ length: 35 }, (_, index) => ({
    type: 'paragraph',
    text: `Paragraph ${index + 1}`,
  }));
  const pool = normalizeArticlePool({
    ...validPayload,
    articles: validPayload.articles.map((item, index) => (
      index === 0 ? { ...item, content } : item
    )),
  });

  assert.equal(pool.articles[0].content.length, 35);
  assert.equal(pool.articles[0].content.at(-1).text, 'Paragraph 35');
});

test('saved bookmarks retain the full normalized story outside the current pool', () => {
  const saved = normalizeArticlePool(validPayload).articles[0];

  assert.deepEqual(normalizeBookmarks([saved]), [saved]);
  assert.throws(() => normalizeBookmarks([{ id: 'broken' }]), /edition article channel/i);
});

test('web bookmarks become extension stories with canonical share links', () => {
  const [saved] = normalizeRemoteBookmarks([{
    item_id: 'tr_story-1',
    item_metadata: {
      title: 'Saved story',
      description: 'The complete saved summary.',
      url: 'https://example.com/story',
      tags: ['AI'],
      source: 'Example',
    },
  }]);
  assert.equal(saved.id, 'tr_story-1');
  assert.equal(saved.content[0].text, 'The complete saved summary.');
  assert.equal(saved.shareUrl, 'https://www.yourtrace.online/articles/tr_story-1');
});

test('isCacheFresh applies the local 15 minute request window', () => {
  const now = Date.parse('2026-08-05T12:00:00.000Z');

  assert.equal(isCacheFresh('2026-08-05T11:45:01.000Z', now), true);
  assert.equal(isCacheFresh('2026-08-05T11:45:00.000Z', now), false);
  assert.equal(isCacheFresh('invalid', now), false);
});

test('every summary is open to everyone (Trace is free)', () => {
  const date = '2026-08-05';
  let reads = normalizeSummaryReads(null, date);

  for (let index = 0; index < FREE_SUMMARY_LIMIT; index += 1) {
    const id = `story-${index}`;
    assert.equal(canOpenSummary(reads, id), true);
    reads = addSummaryRead(reads, id);
  }

  assert.equal(canOpenSummary(reads, 'story-0'), true);
  assert.equal(addSummaryRead(reads, 'story-0'), reads);
  assert.equal(canOpenSummary(reads, 'story-6'), true);
});

test('summary reads reset on a new date', () => {
  const full = { date: '2026-08-04', ids: ['1', '2', '3', '4', '5'] };
  const reset = normalizeSummaryReads(full, '2026-08-05');

  assert.deepEqual(reset, { date: '2026-08-05', ids: [] });
  assert.equal(canOpenSummary(full, '6', true), true);
});
