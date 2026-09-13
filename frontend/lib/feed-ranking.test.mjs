import assert from 'node:assert/strict';
import test from 'node:test';
import {
  rankStoriesForProfile,
  rolePrimaryInterests,
  storyBoost,
} from './feed-ranking.ts';

function story(overrides = {}) {
  return {
    cat: 'tech',
    ts: 1_700_000_000_000,
    sources: ['a.com'],
    ...overrides,
  };
}

test('interest matches outrank wider coverage', () => {
  const ranked = rankStoriesForProfile(
    [
      story({ cat: 'markets', sources: ['a', 'b', 'c', 'd'] }),
      story({ cat: 'ai', sources: ['a'] }),
    ],
    { interests: ['ai'], role: 'engineer' },
  );
  assert.equal(ranked[0].cat, 'ai');
});

test('coverage breaks ties between equally matched interests', () => {
  const ranked = rankStoriesForProfile(
    [
      story({ cat: 'ai', sources: ['a'] }),
      story({ cat: 'ai', sources: ['a', 'b', 'c'] }),
    ],
    { interests: ['ai'], role: 'engineer' },
  );
  assert.deepEqual(ranked[0].sources, ['a', 'b', 'c']);
});

test('role-primary topics get a smaller boost than explicit interests', () => {
  assert.equal(storyBoost('engineering', [], rolePrimaryInterests('engineer')), 2);
  assert.equal(storyBoost('ai', ['ai'], rolePrimaryInterests('engineer')), 5);
  assert.equal(storyBoost('markets', ['ai'], rolePrimaryInterests('engineer')), 0);
});

test('recency breaks score ties', () => {
  const ranked = rankStoriesForProfile(
    [
      story({ cat: 'tech', ts: 100 }),
      story({ cat: 'tech', ts: 200 }),
    ],
    { interests: [], role: 'engineer' },
  );
  assert.equal(ranked[0].ts, 200);
});

test('empty profile keeps coverage ordering and does not mutate input', () => {
  const input = [
    story({ cat: 'tech', sources: ['a'] }),
    story({ cat: 'ai', sources: ['a', 'b'] }),
  ];
  const ranked = rankStoriesForProfile(input, { interests: [], role: null });
  assert.equal(ranked[0].cat, 'ai');
  assert.equal(input[0].cat, 'tech');
});

test('for you interleaves the chosen lanes instead of stacking one', () => {
  const ranked = rankStoriesForProfile(
    [
      story({ cat: 'ai', sources: ['a', 'b', 'c'], ts: 3 }),
      story({ cat: 'ai', sources: ['a', 'b'], ts: 2 }),
      story({ cat: 'markets', sources: ['a'], ts: 2 }),
      story({ cat: 'tech', sources: ['a'], ts: 1 }),
    ],
    { interests: ['ai', 'markets', 'tech'] },
  );
  assert.deepEqual(
    ranked.slice(0, 3).map((s) => s.cat),
    ['ai', 'markets', 'tech'],
  );
  assert.equal(ranked[3].cat, 'ai');
});

test('unselected lanes are interleaved too, not appended in one block', () => {
  const ranked = rankStoriesForProfile(
    [
      story({ cat: 'ai', sources: ['a', 'b'] }),
      story({ cat: 'ai', sources: ['a'] }),
      story({ cat: 'markets', sources: ['a', 'b'] }),
      story({ cat: 'markets', sources: ['a'] }),
    ],
    { interests: ['ai'] },
  );
  assert.deepEqual(
    ranked.map((s) => s.cat),
    ['ai', 'markets', 'ai', 'markets'],
  );
});

test('the seed varies lane order but stays stable for the same seed', () => {
  const input = [
    story({ cat: 'ai', sources: ['a'] }),
    story({ cat: 'markets', sources: ['a'] }),
    story({ cat: 'tech', sources: ['a'] }),
    story({ cat: 'ux-design', sources: ['a'] }),
    story({ cat: 'startups', sources: ['a'] }),
  ];
  const profile = { interests: ['ai', 'markets', 'tech', 'ux-design', 'startups'] };
  const a1 = rankStoriesForProfile(input, profile, { seed: 'u1:2026-09-13' });
  const a2 = rankStoriesForProfile(input, profile, { seed: 'u1:2026-09-13' });
  assert.deepEqual(a1.map((s) => s.cat), a2.map((s) => s.cat));
  const seeds = new Set(
    ['a', 'b', 'c', 'd', 'e', 'f'].map((seed) =>
      rankStoriesForProfile(input, profile, { seed }).map((s) => s.cat).join(','),
    ),
  );
  assert.ok(seeds.size > 1);
});

test('diversify:false keeps the legacy pure score order', () => {
  const ranked = rankStoriesForProfile(
    [
      story({ cat: 'markets', sources: ['a', 'b', 'c', 'd'] }),
      story({ cat: 'ai', sources: ['a'] }),
    ],
    { interests: ['ai'] },
    { diversify: false },
  );
  assert.equal(ranked[0].cat, 'ai');
});
