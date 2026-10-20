import assert from 'node:assert/strict';
import test from 'node:test';

import { selectBigThings } from './big-things.ts';

// One clock for every story: separate Date.now() calls can land a millisecond
// apart and flip the order of otherwise-equal stories.
const NOW = Date.now();

const story = (over) => ({
  id: over.id,
  title: over.title || over.id,
  cat: over.cat || 'ai',
  sources: over.sources || ['a.com'],
  ts: over.ts ?? NOW,
  tags: over.tags,
  body: over.body,
  sendWorthy: over.sendWorthy === undefined ? 1 : over.sendWorthy,
});

test('drops stories Jev judged worthless', () => {
  const picked = selectBigThings(
    [
      story({ id: 'filler', sendWorthy: 0 }),
      story({ id: 'keeper', sendWorthy: 2 }),
    ],
    { count: 10 },
  );
  assert.deepEqual(picked.map((s) => s.id), ['keeper']);
});

test('ten-story edition leads with launches then lane quotas', () => {
  const list = [
    story({ id: 'launch-a', cat: 'ai', title: 'OpenAI releases GPT-6', tags: ['ai', 'models'], sendWorthy: 2 }),
    story({ id: 'launch-b', cat: 'tech', title: 'Meta ships a 70B open-weights model', sendWorthy: 2 }),
    story({ id: 'ai-1', cat: 'ai', sendWorthy: 2 }),
    story({ id: 'ai-2', cat: 'ai', sendWorthy: 1 }),
    story({ id: 'ai-3', cat: 'ai', sendWorthy: 1 }),
    story({ id: 'ai-4', cat: 'ai', sendWorthy: 1 }),
    story({ id: 'mk-1', cat: 'markets', sendWorthy: 1 }),
    story({ id: 'mk-2', cat: 'markets', sendWorthy: 1 }),
    story({ id: 'mk-3', cat: 'markets', sendWorthy: 1 }),
    story({ id: 'tech-1', cat: 'tech', sendWorthy: 1 }),
    story({ id: 'tech-2', cat: 'tech', sendWorthy: 1 }),
    story({ id: 'design-1', cat: 'ux-design', sendWorthy: 1 }),
    story({ id: 'startup-1', cat: 'startups', sendWorthy: 1 }),
  ];
  const picked = selectBigThings(list, { count: 10 });
  assert.equal(picked.length, 10);
  assert.deepEqual(picked.slice(0, 2).map((s) => s.id), ['launch-a', 'launch-b']);
  // Release slots sit on top of the lane quotas, exactly like the email, so
  // an AI-lane launch makes AI's share larger than its quota.
  const lanes = picked.map((s) => s.cat);
  assert.ok(lanes.filter((c) => c === 'ai').length >= 3);
  assert.equal(lanes.filter((c) => c === 'markets').length, 2);
  assert.ok(lanes.filter((c) => c === 'tech').length >= 2);
  assert.equal(lanes.filter((c) => c === 'ux-design').length, 1);
});

test('five-story edition takes one launch and the leading lanes', () => {
  const list = [
    story({ id: 'launch-a', cat: 'ai', title: 'Anthropic unveils Claude Opus 5', tags: ['ai', 'models'], sendWorthy: 2 }),
    story({ id: 'ai-1', cat: 'ai', sendWorthy: 2 }),
    story({ id: 'ai-2', cat: 'ai', sendWorthy: 1 }),
    story({ id: 'mk-1', cat: 'markets', sendWorthy: 1 }),
    story({ id: 'tech-1', cat: 'tech', sendWorthy: 1 }),
    story({ id: 'design-1', cat: 'ux-design', sendWorthy: 1 }),
  ];
  const picked = selectBigThings(list, { count: 5 });
  assert.equal(picked.length, 5);
  assert.equal(picked[0].id, 'launch-a');
  assert.ok(picked.some((s) => s.cat === 'markets'));
  assert.ok(picked.some((s) => s.cat === 'tech'));
});

test('honours the reader lanes', () => {
  const list = [
    story({ id: 'ai-1', cat: 'ai' }),
    story({ id: 'mk-1', cat: 'markets' }),
    story({ id: 'design-1', cat: 'ux-design' }),
  ];
  const picked = selectBigThings(list, { count: 5, lanes: ['markets', 'ux-design'] });
  assert.deepEqual(picked.map((s) => s.id).sort(), ['design-1', 'mk-1']);
});

test('prefers broader coverage when verdicts tie', () => {
  const picked = selectBigThings(
    [
      story({ id: 'thin', cat: 'markets', sources: ['a.com'] }),
      story({ id: 'wide', cat: 'markets', sources: ['a.com', 'b.com', 'c.com'] }),
    ],
    { count: 1, lanes: ['markets'] },
  );
  assert.equal(picked[0].id, 'wide');
});

test('a launch whose newest coverage is over 36 hours old competes in its lane', () => {
  const now = Date.parse('2026-10-18T06:00:00Z');
  const hours = (h) => now - h * 3_600_000;
  const list = [
    story({ id: 'flux', cat: 'ai', title: 'Black Forest Labs unveils FLUX 3 Klein, a 5.6B open-weights image model',
      sources: ['a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com'], ts: hours(51), sendWorthy: 2 }),
    story({ id: 'nemotron', cat: 'ai', title: 'NVIDIA releases Nemotron 3.5, an open 120B vision model', ts: hours(6), sendWorthy: 2 }),
    story({ id: 'ai-1', cat: 'ai', sendWorthy: 1, ts: hours(2) }),
    story({ id: 'mk-1', cat: 'markets', sendWorthy: 1, ts: hours(2) }),
    story({ id: 'tech-1', cat: 'tech', sendWorthy: 1, ts: hours(2) }),
    story({ id: 'tech-2', cat: 'tech', sendWorthy: 1, ts: hours(2) }),
  ];
  const picked = selectBigThings(list, { count: 5, now });
  assert.equal(picked[0].id, 'nemotron');
  // Still in the edition, as the AI lane's strongest story.
  assert.equal(picked[1].id, 'flux');

  // Inside the window it still leads; an undated launch is never treated as stale.
  assert.equal(selectBigThings(list, { count: 5, now: hours(51 - 35) })[0].id, 'flux');
  const undated = list.map((s) => (s.id === 'flux' ? { ...s, ts: 0 } : s));
  assert.equal(selectBigThings(undated, { count: 5, now })[0].id, 'flux');
});
