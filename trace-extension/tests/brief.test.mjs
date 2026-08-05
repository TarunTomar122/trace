import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isCacheFresh,
  normalizeArticlePool,
  selectRandomArticles,
} from '../lib/brief.js';

function article(id, channel = 'edition') {
  return {
    id,
    channel,
    title: `Article ${id}`,
    summary: `Summary ${id}`,
    content: [{ type: 'paragraph', text: `Body ${id}` }],
    source_url: `https://example.com/${id}`,
    source: 'Example',
    key_takeaways: [],
  };
}

const validPayload = {
  version: 3,
  feed_date: '2026-08-05',
  generated_at: '2026-08-05T06:05:00.000Z',
  articles: Array.from({ length: 15 }, (_, index) => (
    index < 8 ? article(`edition-${index}`) : article(`pulse-${index}`, 'pulse')
  )),
};

test('normalizeArticlePool accepts safe Edition and Pulse articles', () => {
  const pool = normalizeArticlePool(validPayload);

  assert.equal(pool.feedDate, '2026-08-05');
  assert.equal(pool.articles.length, 15);
  assert.equal(pool.articles.some(({ channel }) => channel === 'edition'), true);
  assert.equal(pool.articles.some(({ channel }) => channel === 'pulse'), true);
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
});

test('selectRandomArticles returns 15 unique mixed articles', () => {
  const articles = normalizeArticlePool({
    ...validPayload,
    articles: [
      ...Array.from({ length: 20 }, (_, index) => article(`edition-${index}`)),
      ...Array.from({ length: 20 }, (_, index) => article(`pulse-${index}`, 'pulse')),
    ],
  }).articles;
  const selected = selectRandomArticles(articles, 15, () => 0.42);

  assert.equal(selected.length, 15);
  assert.equal(new Set(selected.map(({ id }) => id)).size, 15);
  assert.equal(selected.some(({ channel }) => channel === 'edition'), true);
  assert.equal(selected.some(({ channel }) => channel === 'pulse'), true);
});

test('normalizeArticlePool rejects an incomplete pool', () => {
  assert.throws(
    () => normalizeArticlePool({ ...validPayload, articles: validPayload.articles.slice(0, 14) }),
    /at least 15/i,
  );
});

test('normalizeArticlePool rejects a single-channel pool', () => {
  assert.throws(
    () => normalizeArticlePool({
      ...validPayload,
      articles: Array.from({ length: 15 }, (_, index) => article(`edition-${index}`)),
    }),
    /edition and pulse/i,
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

test('isCacheFresh applies the local 15 minute request window', () => {
  const now = Date.parse('2026-08-05T12:00:00.000Z');

  assert.equal(isCacheFresh('2026-08-05T11:45:01.000Z', now), true);
  assert.equal(isCacheFresh('2026-08-05T11:45:00.000Z', now), false);
  assert.equal(isCacheFresh('invalid', now), false);
});
