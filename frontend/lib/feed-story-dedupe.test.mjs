import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSameStoryTitle } from './feed-story-dedupe.ts';

test('one story under different headlines matches', () => {
  assert.equal(isSameStoryTitle('Meta Unveils Muse Wonder AI Models', 'Meta Unveils Muse Wonder AI Model'), true);
  assert.equal(
    isSameStoryTitle(
      'Anthropic says small AI models may soon copy themselves onto smart devices',
      'Anthropic: Small AI Models May Soon Self-Replicate on Smart TV Boxes',
    ),
    true,
  );
  assert.equal(isSameStoryTitle('OpenAI launches GPT-6', 'OpenAI launches GPT-6 model'), true);
  assert.equal(isSameStoryTitle('AI', 'ai'), true);
});

test('titles that only share filler words stay apart', () => {
  // The two cards that merged into "Soon and Anthropic" on 2026-10-13.
  assert.equal(isSameStoryTitle('Soon and Anthropic', 'Seed and Bytedance'), false);
  assert.equal(isSameStoryTitle('Seed and Bytedance', 'Reebuild and Raises'), false);
  assert.equal(isSameStoryTitle('Apple updates', 'Google updates'), false);
  assert.equal(isSameStoryTitle('OpenAI and Microsoft', 'Nvidia and AMD'), false);
});

test('short headlines that only share the company stay apart', () => {
  assert.equal(isSameStoryTitle('OpenAI Raises $40B', 'OpenAI Releases GPT-6'), false);
  assert.equal(isSameStoryTitle('Anthropic Sues Perplexity', 'Anthropic Raises $13B'), false);
  assert.equal(isSameStoryTitle('Microsoft Buys Discord', 'Microsoft Cuts Xbox Prices'), false);
  assert.equal(isSameStoryTitle('Amazon launches new Kindle', 'Amazon raises Prime price'), false);
});
