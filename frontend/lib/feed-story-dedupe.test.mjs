import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSameHeadline, isSameReleaseLine, isSameStoryTitle } from './feed-story-dedupe.ts';

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

test('the same headline word for word is one story, look-alikes are not', () => {
  assert.equal(isSameHeadline('Plural raises €1 billion to back European startups',
    'Plural raises €1 billion to back European startups.'), true);
  assert.equal(isSameHeadline('OpenAI releases GPT-5.1', 'OpenAI releases GPT-5.2'), false);
  assert.equal(isSameHeadline('Microsoft cuts 6,000 jobs', 'Microsoft cuts 9,000 jobs'), false);
  assert.equal(isSameHeadline('', ''), false);
});

test('releases of one model line are one story, other versions are not', () => {
  assert.equal(isSameReleaseLine('tencent-hy4-weights', 'tencent-hy4-flash-weights-release'), true);
  assert.equal(isSameReleaseLine('openai-gpt-5-1-release', 'openai-gpt-5-2-release'), false);
  assert.equal(isSameReleaseLine('google-gemini-4-neon-launch', 'google-gemini-4-argon-launch'), false);
  assert.equal(isSameReleaseLine('meta-llama-launch', 'meta-llama-open-weights'), false);
  assert.equal(isSameReleaseLine('openai-devday-2026', 'openai-devday-2026-agents'), false);
  assert.equal(isSameReleaseLine('openai-gpt-5-launch', 'openai-gpt-5-release'), true);
  assert.equal(isSameReleaseLine('openai-gpt-5', 'openai-gpt-5-1'), false);
  assert.equal(isSameReleaseLine('deepseek-v3', 'deepseek-v3-2'), false);
});
