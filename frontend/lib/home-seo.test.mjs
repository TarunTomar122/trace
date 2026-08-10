import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HOME_FAQ_ITEMS,
  generateHomeApplicationSchema,
} from './home-seo.ts';

test('homepage application schema contains only truthful product facts', () => {
  const application = generateHomeApplicationSchema();

  assert.equal(application['@type'], 'SoftwareApplication');
  assert.equal(application.applicationCategory, 'NewsApplication');
  assert.equal(application.operatingSystem, 'Web, Chrome, Android');
  assert.equal(
    application.downloadUrl,
    'https://chromewebstore.google.com/detail/cblkklekbejbbpcaihfogdmaoofmikbk?utm_source=item-share-cb',
  );
  assert.match(application.description, /AI and technology news/);
  assert.equal('aggregateRating' in application, false);
  assert.equal('offers' in application, false);
  assert.equal('softwareVersion' in application, false);
});

test('homepage FAQs explain the free plan, sources, products, and Pro', () => {
  const questions = HOME_FAQ_ITEMS.map((item) => item.q);
  const freeFaq = HOME_FAQ_ITEMS.find(
    (item) => item.q === 'Is Trace free?',
  );

  assert.equal(new Set(questions).size, questions.length);
  assert.ok(HOME_FAQ_ITEMS.every((item) => item.a.length > 40));
  assert.match(freeFaq.a, /five unique AI summaries/i);
  assert.ok(questions.includes('Where can I use Trace?'));
  assert.ok(questions.includes('What does Trace Pro include?'));
});
