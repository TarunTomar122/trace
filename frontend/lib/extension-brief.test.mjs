import assert from 'node:assert/strict';
import test from 'node:test';

import { buildExtensionBrief, hasCompleteExtensionPool } from './extension-brief.ts';

function feedItem(id, title, overrides = {}) {
  return {
    id,
    title,
    url: `https://example.com/${id}`,
    source_name: 'Example',
    thumbnail: `https://images.example.com/${id}.jpg`,
    published_date: '2026-08-05T08:00:00.000Z',
    summary: {
      short_article: {
        subtitle: `${title} summary`,
        body: `${title} full Trace read`,
        key_takeaways: [`${title} takeaway`],
      },
    },
    ...overrides,
  };
}

test('buildExtensionBrief returns one public pool mixing Edition and Pulse articles', () => {
  const brief = buildExtensionBrief({
    date: '2026-08-05',
    assembled_at: '2026-08-05T06:00:00.000Z',
    for_you: [feedItem('edition-1', 'Edition one')],
    trending: [feedItem('edition-2', 'Edition two')],
    pulse: [feedItem('pulse-1', 'Pulse one')],
    build_pulse: [feedItem('pulse-2', 'Pulse two')],
  });

  assert.equal(brief.version, 3);
  assert.equal(brief.feed_date, '2026-08-05');
  assert.equal(brief.assembled_at, '2026-08-05T06:00:00.000Z');
  assert.deepEqual(brief.articles.map(({ channel }) => channel), [
    'edition',
    'edition',
    'pulse',
    'pulse',
  ]);
  assert.deepEqual(brief.articles[0].content, [{ type: 'paragraph', text: 'Edition one full Trace read' }]);
});

test('buildExtensionBrief cleans display text and rejects unsafe links', () => {
  const brief = buildExtensionBrief({
    date: '2026-08-05',
    for_you: [
      feedItem('clean', '**News &amp; analysis**', {
        summary: {
          short_article: {
            subtitle: 'A **clear** summary',
            body: '## Context\n\nThe \u2014 *full* read\n\n- First point',
            key_takeaways: ['*Useful* &amp; specific'],
          },
        },
      }),
      feedItem('unsafe', 'Unsafe', { url: 'javascript:alert(1)' }),
    ],
    trending: [],
  });

  assert.deepEqual(brief.articles.map(({ title }) => title), ['News & analysis']);
  assert.equal(brief.articles[0].summary, 'A clear summary');
  assert.deepEqual(brief.articles[0].content, [
    { type: 'heading', text: 'Context' },
    { type: 'paragraph', text: 'The - full read' },
    { type: 'list_item', text: 'First point' },
  ]);
  assert.deepEqual(brief.articles[0].key_takeaways, ['Useful & specific']);
});

test('buildExtensionBrief deduplicates the same source across channels', () => {
  const duplicate = feedItem('same', 'Same article');
  const brief = buildExtensionBrief({
    date: '2026-08-05',
    for_you: [duplicate],
    trending: [],
    pulse: [duplicate],
  });

  assert.equal(brief.articles.length, 1);
  assert.equal(brief.articles[0].channel, 'edition');
});

test('hasCompleteExtensionPool requires enough articles from both channels', () => {
  const edition = Array.from({ length: 15 }, (_, index) => ({
    id: `edition:${index}`,
    channel: 'edition',
  }));
  const mixed = [...edition.slice(0, 14), { id: 'pulse:1', channel: 'pulse' }];

  assert.equal(hasCompleteExtensionPool(edition), false);
  assert.equal(hasCompleteExtensionPool(mixed), true);
  assert.equal(hasCompleteExtensionPool(mixed.slice(0, 14)), false);
});

test('buildExtensionBrief deduplicates final article ids before validating the pool', () => {
  const brief = buildExtensionBrief({
    date: '2026-08-05',
    for_you: [
      feedItem('duplicate-id', 'First URL'),
      feedItem('duplicate-id', 'Second URL', { url: 'https://example.com/second-url' }),
    ],
    trending: [],
  });

  assert.equal(brief.articles.length, 1);
  assert.equal(brief.articles[0].title, 'First URL');
});

test('buildExtensionBrief skips articles without readable full content', () => {
  const brief = buildExtensionBrief({
    date: '2026-08-05',
    for_you: [feedItem('empty', 'Title only', { summary: undefined, description: undefined })],
    trending: [],
  });

  assert.equal(brief.articles.length, 0);
});

test('buildExtensionBrief preserves every full-read content block', () => {
  const body = Array.from({ length: 35 }, (_, index) => `Paragraph ${index + 1}`).join('\n\n');
  const brief = buildExtensionBrief({
    date: '2026-08-05',
    for_you: [feedItem('long-read', 'Long read', {
      summary: { short_article: { subtitle: 'Summary', body, key_takeaways: [] } },
    })],
    trending: [],
  });

  assert.equal(brief.articles[0].content.length, 35);
  assert.equal(brief.articles[0].content.at(-1).text, 'Paragraph 35');
});
