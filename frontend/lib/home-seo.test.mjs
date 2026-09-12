import assert from 'node:assert/strict';
import test from 'node:test';

import { generateHomeApplicationSchema } from './home-seo.ts';

test('homepage application schema contains only truthful product facts', () => {
  const application = generateHomeApplicationSchema();

  assert.equal(application['@type'], 'SoftwareApplication');
  assert.equal(application.applicationCategory, 'NewsApplication');
  assert.equal(application.operatingSystem, 'Web, Chrome, Android');
  assert.equal(
    application.downloadUrl,
    'https://chromewebstore.google.com/detail/cblkklekbejbbpcaihfogdmaoofmikbk',
  );
  assert.match(application.description, /AI and technology news/);
  assert.equal('aggregateRating' in application, false);
  assert.equal('offers' in application, false);
  assert.equal('softwareVersion' in application, false);
});
