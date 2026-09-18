import assert from 'node:assert/strict';
import test from 'node:test';
import { slotsFromRankedItems } from './feed-topic-order.ts';

test('ranked singleton leads even when it is missing from clustered topics', () => {
  const bonsai = { url: 'https://prismml.com/news/bonsai-2-27b' };
  const openai = { url: 'https://techcrunch.com/openai-misalignment' };
  const openaiTopic = {
    id: 'openai',
    articles: [{ url: openai.url }],
  };

  const slots = slotsFromRankedItems([bonsai, openai], [openaiTopic]);

  assert.equal(slots[0].kind, 'item');
  assert.equal(slots[0].item.url, bonsai.url);
  assert.equal(slots[1].kind, 'topic');
  assert.equal(slots[1].topic.id, 'openai');
  assert.equal(slots.length, 2);
});

test('a clustered topic is emitted once, at the rank of its first trending item', () => {
  const a = { url: 'https://a.example/1' };
  const b = { url: 'https://b.example/2' };
  const cluster = { id: 'cluster', articles: [{ url: a.url }, { url: b.url }] };
  const leftover = { id: 'markets', articles: [{ url: 'https://markets.example/x' }] };

  const slots = slotsFromRankedItems([a, b], [leftover, cluster]);

  assert.equal(slots[0].kind, 'topic');
  assert.equal(slots[0].topic.id, 'cluster');
  assert.equal(slots[1].kind, 'topic');
  assert.equal(slots[1].topic.id, 'markets');
  assert.equal(slots.length, 2);
});
