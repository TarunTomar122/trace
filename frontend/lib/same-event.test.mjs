import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameEvent } from './same-event.ts';

test('one event reported under different headlines merges', () => {
  assert.equal(sameEvent('Meta Unveils Muse Wonder AI Models', 'Meta Unveils Muse Wonder AI Model'), true);
  assert.equal(sameEvent('Meta Unveils Muse Wonder AI Models', 'Meta Introduces Muse Wonder AI Model'), true);
  assert.equal(sameEvent('Meta Launches Muse Wonder AI Models to Play Catch-Up With Rivals', 'Meta Unveils Muse Wonder AI Models'), true);
});

test('different events that share Title Case words stay apart', () => {
  assert.equal(sameEvent('OpenAI Raises $40 Billion in New Funding', 'Anthropic Raises $13 Billion in New Funding'), false);
  assert.equal(sameEvent('Apple Announces iPhone 17 Pro With New Camera', 'Apple Announces M5 MacBook Pro'), false);
  assert.equal(sameEvent('Google Gemini 3 Now Available To All Users', 'Microsoft Copilot Now Available To Enterprise Users'), false);
  assert.equal(sameEvent('Nvidia Stock Falls After Earnings', 'Tesla Stock Falls After Earnings'), false);
});
