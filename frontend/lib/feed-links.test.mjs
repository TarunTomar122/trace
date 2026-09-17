import assert from 'node:assert/strict';
import test from 'node:test';
import { feedTabLabel, normalizeFeedTab, partitionFeedCats } from './feed-links.ts';

const CATS = ['ai', 'markets', 'tech', 'ux-design', 'startups'];

test('lane links accept slugs and friendly aliases', () => {
  assert.equal(normalizeFeedTab('markets', CATS), 'markets');
  assert.equal(normalizeFeedTab('market', CATS), 'markets');
  assert.equal(normalizeFeedTab('Market', CATS), 'markets');
  assert.equal(normalizeFeedTab('stocks', CATS), 'markets');
  assert.equal(normalizeFeedTab('design', CATS), 'ux-design');
  assert.equal(normalizeFeedTab('product-design', CATS), 'ux-design');
  assert.equal(normalizeFeedTab('startup', CATS), 'startups');
  assert.equal(normalizeFeedTab('technology', CATS), 'tech');
  assert.equal(normalizeFeedTab('ai', CATS), 'ai');
});

test('home, bookmarks, profile and conversations keep working', () => {
  assert.equal(normalizeFeedTab('all', CATS), 'all');
  assert.equal(normalizeFeedTab('home', CATS), 'all');
  assert.equal(normalizeFeedTab('', CATS), 'all');
  assert.equal(normalizeFeedTab(null, CATS), 'all');
  assert.equal(normalizeFeedTab('bookmarks', CATS), 'bookmarks');
  assert.equal(normalizeFeedTab('saved', CATS), 'bookmarks');
  assert.equal(normalizeFeedTab('profile', CATS), 'profile');
  assert.equal(normalizeFeedTab('conversations', CATS), 'conversations');
  assert.equal(normalizeFeedTab('pulse', CATS), 'conversations');
  assert.equal(normalizeFeedTab('reading', CATS), 'conversations');
  assert.equal(normalizeFeedTab('worth-reading', CATS), 'conversations');
  assert.equal(normalizeFeedTab('hn', CATS), 'conversations');
  assert.equal(normalizeFeedTab('top-hn', CATS), 'conversations');
});

test('stale links for missing categories fall back to home', () => {
  assert.equal(normalizeFeedTab('markets', ['ai', 'tech']), 'all');
  assert.equal(normalizeFeedTab('nonsense', CATS), 'all');
});

test('unknown categories are trusted when no catalog is provided', () => {
  assert.equal(normalizeFeedTab('engineering'), 'engineering');
});

test('labels for metadata', () => {
  assert.equal(feedTabLabel('markets'), 'Markets');
  assert.equal(feedTabLabel('ux-design'), 'Design');
  assert.equal(feedTabLabel('conversations'), 'Top HN');
  assert.equal(feedTabLabel('other'), 'Top');
});

test('chosen lanes come first and keep profile order', () => {
  const { mine, others } = partitionFeedCats(
    ['ai', 'markets', 'tech', 'ux-design', 'startups'],
    ['startups', 'ai', 'markets'],
  );
  assert.deepEqual(mine, ['startups', 'ai', 'markets']);
  assert.deepEqual(others, ['tech', 'ux-design']);
});

test('no interests means everything is "others"', () => {
  const { mine, others } = partitionFeedCats(['ai', 'tech'], []);
  assert.deepEqual(mine, []);
  assert.deepEqual(others, ['ai', 'tech']);
});
