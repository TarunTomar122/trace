import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../.next/server/app/index.html', import.meta.url), 'utf8');

assert.match(html, /<title>Trace — AI and developer news in one focused feed<\/title>/);
assert.match(html, /<meta name="description" content="Trace is a focused AI and developer news aggregator/);
assert.match(html, /<link rel="canonical" href="https:\/\/www\.yourtrace\.online"/);
assert.match(html, /<meta property="og:title" content="Trace — AI and developer news in one focused feed"/);
assert.match(html, /Trace is a focused AI and developer news aggregator\./);
assert.match(html, /Trace vs\. following every source manually\./);

const requiredLinks = [
  '/blog/free-news-aggregators-for-developers',
  '/blog/how-to-stay-updated-on-tech-without-doomscrolling',
  '/compare/rss-reader-alternative',
  '/blog/ai-news-for-developers',
];

for (const href of requiredLinks) {
  assert.match(html, new RegExp(`href="${href}"`));
}

const schemas = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)]
  .map((match) => JSON.parse(match[1]));
const application = schemas.find((schema) => schema['@type'] === 'SoftwareApplication');
const faq = schemas.find((schema) => schema['@type'] === 'FAQPage');

assert.ok(application, 'homepage should render SoftwareApplication JSON-LD');
assert.ok(faq, 'homepage should render FAQPage JSON-LD');
assert.equal(faq.mainEntity.length, 7);
const publicAccessFaq = faq.mainEntity.find(
  (item) => item.name === 'Can I explore Trace without an account?',
);
assert.ok(publicAccessFaq, 'homepage should explain the public-access boundary');
assert.match(publicAccessFaq.acceptedAnswer.text, /browse homepage previews, guides, comparisons, and daily archive pages/);
assert.match(publicAccessFaq.acceptedAnswer.text, /Sign in to open the live feed/);

const visibleHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
assert.match(visibleHtml, /Can I explore Trace without an account\?/);
assert.ok(
  visibleHtml.includes(publicAccessFaq.acceptedAnswer.text),
  'public-access FAQ schema should match the visible answer',
);
assert.equal('aggregateRating' in application, false);
assert.equal('offers' in application, false);
assert.equal('softwareVersion' in application, false);

console.log('Homepage rendered SEO checks passed.');
