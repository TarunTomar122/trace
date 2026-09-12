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
