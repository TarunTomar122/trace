import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExtensionStories } from './extension-stories.ts';

const NOW = new Date('2026-11-24T12:00:00Z');
const story = (i, extra = {}) => ({
  id: `tr_${i}`, rank: i + 1, title: `Story ${i}`, body: `Body ${i}`, img: `https://img.example.com/${i}.jpg`,
  source: 'Example', sources: ['Example', 'Other'], sourceNames: ['Example', 'Other'],
  coverage: [{ title: `Story ${i}`, source: 'Example', url: `https://example.com/${i}`, time: '' },
    { title: `Other take ${i}`, source: 'Other', url: `https://other.com/${i}`, time: '' }],
  time: '', ts: NOW.getTime() - i * 3_600_000, firstTs: NOW.getTime() - i * 3_600_000, cat: i % 2 ? 'markets' : 'ai',
  url: `https://example.com/${i}`, ...extra,
});

test('stories: one per id, Trace links, outlets counted once, lead report not repeated in coverage', () => {
  const stories = Array.from({ length: 12 }, (_, i) => story(i));
  const out = buildExtensionStories({ stories: [...stories, story(3)], promoted: [], feedDate: '2026-11-24' },
    { origin: 'https://www.yourtrace.online', slots: 3, now: NOW });
  assert.equal(out.version, 6);
  assert.equal(new Set(out.stories.map((s) => s.id)).size, out.stories.length);
  const first = out.stories.find((s) => s.id === 'tr_0');
  assert.equal(first.trace_url, 'https://www.yourtrace.online/story/tr_0');
  assert.equal(first.source_count, 2);
  assert.deepEqual(first.coverage.map((c) => c.source), ['Other']);
  assert.equal(out.sponsor_url, 'https://www.yourtrace.online/feed?sponsor=open');
});

test('sponsors go through the click counter, capitalised; a full house closes the open slot', () => {
  const promoted = [1, 2, 3].map((n) => ({ id: `sponsor00${n}`, title: `Tool ${n}`, url: `https://tool${n}.com`, sub: 'does things' }));
  const out = buildExtensionStories({ stories: Array.from({ length: 10 }, (_, i) => story(i)), promoted, feedDate: 'd' },
    { origin: 'https://www.yourtrace.online', slots: 3, now: NOW });
  assert.equal(out.sponsors.length, 3);
  assert.equal(out.sponsors[0].href, 'https://www.yourtrace.online/api/tools/go?id=sponsor001&p=extension');
  assert.equal(out.sponsors[0].sub, 'Does things');
  assert.equal(out.sponsor_url, null);
});

test('no-value stories (sendWorthy 0) stay out', () => {
  const stories = Array.from({ length: 10 }, (_, i) => story(i, i === 4 ? { sendWorthy: 0 } : {}));
  const out = buildExtensionStories({ stories, promoted: [], feedDate: 'd' }, { origin: 'https://www.yourtrace.online', slots: 3, now: NOW });
  assert.equal(out.stories.some((s) => s.id === 'tr_4'), false);
});
