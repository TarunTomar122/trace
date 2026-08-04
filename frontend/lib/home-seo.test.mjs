import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HOME_COMPARISON_ROWS,
  HOME_FAQ_ITEMS,
  HOME_INTENT_LINKS,
  generateHomeApplicationSchema,
} from './home-seo.ts';

test('homepage application schema contains only truthful product facts', () => {
  const application = generateHomeApplicationSchema();

  assert.equal(application['@type'], 'SoftwareApplication');
  assert.equal(application.applicationCategory, 'DeveloperApplication');
  assert.equal(application.operatingSystem, 'Web, Android');
  assert.match(application.description, /AI and developer news aggregator/);
  assert.equal('aggregateRating' in application, false);
  assert.equal('offers' in application, false);
  assert.equal('softwareVersion' in application, false);
});

test('homepage FAQs are complete and unique for visible content and schema', () => {
  const questions = HOME_FAQ_ITEMS.map((item) => item.q);
  const publicAccessFaq = HOME_FAQ_ITEMS.find(
    (item) => item.q === 'Can I explore Trace without an account?',
  );

  assert.equal(new Set(questions).size, questions.length);
  assert.ok(HOME_FAQ_ITEMS.every((item) => item.a.length > 40));
  assert.match(publicAccessFaq.a, /Sign in to open the live feed/);
});

test('homepage comparison and intent links cover distinct high-intent paths', () => {
  assert.equal(HOME_COMPARISON_ROWS.length, 4);
  assert.equal(new Set(HOME_COMPARISON_ROWS.map((row) => row.label)).size, 4);
  assert.equal(new Set(HOME_INTENT_LINKS.map((link) => link.href)).size, HOME_INTENT_LINKS.length);
  assert.ok(HOME_INTENT_LINKS.every((link) => link.href.startsWith('/')));
});
