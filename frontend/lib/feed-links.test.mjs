import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalLane, feedTabLabel, normalizeFeedTab, partitionFeedCats } from './feed-links.ts';

const CATS = ['ai', 'markets', 'tech', 'ux-design', 'startups', 'robotics'];

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
  assert.equal(normalizeFeedTab('security'), 'security');
});

test('robotics links accept friendly aliases', () => {
  for (const alias of ['robotics', 'robot', 'robots', 'humanoid', 'humanoids', 'physical-ai', 'self-driving',
    'robotaxi', 'robotaxis', 'autonomous-vehicles', 'drones', 'embodied-ai']) {
    assert.equal(normalizeFeedTab(alias, CATS), 'robotics', alias);
  }
  // A day with no robotics stories sends the link Home rather than to an empty tab.
  assert.equal(normalizeFeedTab('robotics', ['ai', 'tech']), 'all');
});

test('retired engineering lane links and stories land in tech', () => {
  assert.equal(normalizeFeedTab('engineering'), 'tech');
  assert.equal(normalizeFeedTab('engineering', CATS), 'tech');
  assert.equal(feedTabLabel(normalizeFeedTab('engineering')), 'Tech');
  assert.equal(canonicalLane('engineering'), 'tech');
  assert.equal(canonicalLane('robotics'), 'robotics');
  assert.equal(canonicalLane(''), 'tech');
  assert.equal(canonicalLane(undefined), 'tech');
  assert.equal(canonicalLane('Engineering'), 'tech');
});

test('object built-ins are not lanes or labels', () => {
  assert.equal(canonicalLane('constructor'), 'constructor');
  assert.equal(normalizeFeedTab('constructor', CATS), 'all');
  assert.equal(normalizeFeedTab('toString'), 'tostring');
  assert.equal(feedTabLabel('constructor'), 'Top');
});

test('labels for metadata', () => {
  assert.equal(feedTabLabel('markets'), 'Markets');
  assert.equal(feedTabLabel('ux-design'), 'Design');
  assert.equal(feedTabLabel('robotics'), 'Robotics');
  assert.equal(feedTabLabel('conversations'), 'Top articles');
  assert.equal(normalizeFeedTab('top-articles'), 'conversations');
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
