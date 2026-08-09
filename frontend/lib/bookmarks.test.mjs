import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeBookmarkCursor,
  encodeBookmarkCursor,
  normalizeBookmarkPayload,
  searchTermsForBookmark,
} from './bookmarks.ts';

test('normalizes a safe bookmark snapshot for account sync', () => {
  assert.deepEqual(
    normalizeBookmarkPayload({
      item_id: 'story-1',
      item_metadata: {
        type: 'article',
        title: '  A useful story  ',
        description: '  Short context.  ',
        url: 'https://example.com/story',
        thumbnail: 'https://example.com/image.jpg',
        tags: [' AI ', 'AI', 'Engineering'],
        source: 'Example',
        timestamp: '2026-08-06T12:00:00.000Z',
      },
    }),
    {
      itemId: 'story-1',
      metadata: {
        type: 'article',
        title: 'A useful story',
        description: 'Short context.',
        url: 'https://example.com/story',
        thumbnail: 'https://example.com/image.jpg',
        tags: ['AI', 'Engineering'],
        source: 'Example',
        timestamp: '2026-08-06T12:00:00.000Z',
      },
    },
  );
});

test('rejects unsafe or unbounded bookmark input', () => {
  assert.throws(() => normalizeBookmarkPayload({ item_id: 'folder/story', item_metadata: { title: 'Story' } }), /item id/i);
  assert.throws(() => normalizeBookmarkPayload({ item_id: 'story', item_metadata: { title: '' } }), /title/i);
  assert.throws(() => normalizeBookmarkPayload({ item_id: 'story', item_metadata: { title: 'Story', url: 'javascript:alert(1)' } }), /url/i);
  assert.throws(() => normalizeBookmarkPayload({ item_id: 'story', item_metadata: { title: 'x'.repeat(301) } }), /title/i);
  assert.equal(normalizeBookmarkPayload({ item_id: 'story', item_metadata: { title: 'Story', description: 'x'.repeat(2200) } }).metadata.description?.length, 2200);
  assert.throws(() => normalizeBookmarkPayload({ item_id: 'story', item_metadata: { title: 'Story', description: 'x'.repeat(2201) } }), /description/i);
});

test('builds prefix terms for saved archive search', () => {
  const terms = searchTermsForBookmark({ title: 'OpenAI robotics', tags: ['AI'] });
  assert.equal(terms.includes('openai'), true);
  assert.equal(terms.includes('robot'), true);
  assert.equal(terms.includes('ai'), true);
  assert.equal(new Set(terms).size, terms.length);
});

test('bookmark cursors round-trip and reject malformed values', () => {
  const cursor = { bookmarkedAt: '2026-08-06T12:00:00.000Z', id: 'story-1' };
  assert.deepEqual(decodeBookmarkCursor(encodeBookmarkCursor(cursor)), cursor);
  assert.equal(decodeBookmarkCursor('broken'), null);
});
