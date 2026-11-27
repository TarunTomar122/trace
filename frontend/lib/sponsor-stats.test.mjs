// Sponsor stats: the view counter (POST /api/tools/seen) against the in-memory
// store, and how the stats page labels where visitors came from.
import './test-support/next-route-hooks.mjs';
import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

const { NextRequest } = await import('next/server');
const { adminFirestore: db } = await import('./test-support/firebase-admin-stub.mjs');
const seenRoute = await import('../app/api/tools/seen/route.ts');
const { sourceOf, rank } = await import('./sponsor-audience.ts');

const ID = 'sponsor-live-1';
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const today = () => new Date().toISOString().slice(0, 10);

function seen(body, { userAgent = BROWSER, site = 'same-origin' } = {}) {
  const headers = { 'user-agent': userAgent, 'content-type': 'text/plain' };
  if (site) headers['sec-fetch-site'] = site;
  return seenRoute.POST(new NextRequest('https://www.yourtrace.online/api/tools/seen', {
    method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

const views = async (id = ID) => (await db.collection('sponsor_views').doc(`${id}_${today()}`).get()).data();

beforeEach(async () => {
  process.env.NODE_ENV = 'production';
  db.reset();
  const later = new Date(Date.now() + 86_400_000).toISOString();
  await db.collection('promoted_tools').doc(ID).set({ status: 'active', expires_at: later, title: 'Live' });
  await db.collection('promoted_tools').doc('sponsor-ended-1').set({ status: 'active', expires_at: '2020-01-01T00:00:00Z' });
});

test('one beacon counts each card it carries, by spot', async () => {
  const res = await seen({ views: [[ID, 'desktop_tools'], [ID, 'home_feed_end']] });
  assert.equal(res.status, 204);
  await seen({ views: [[ID, 'desktop_tools']] });
  const doc = await views();
  assert.equal(doc.views, 3);
  assert.equal(doc.views_desktop_tools, 2);
  assert.equal(doc.views_home_feed_end, 1);
  assert.equal(doc.day, today());
});

test('ended spots, other sites, bots and dev servers add nothing', async () => {
  await seen({ views: [['sponsor-ended-1', 'desktop_tools']] });
  assert.equal(await views('sponsor-ended-1'), undefined);
  await seen({ views: [[ID, 'desktop_tools']] }, { site: 'cross-site' });
  await seen({ views: [[ID, 'desktop_tools']] }, { userAgent: 'Googlebot/2.1' });
  process.env.NODE_ENV = 'development';
  await seen({ views: [[ID, 'desktop_tools']] });
  assert.equal(await views(), undefined);
});

test('malformed views are refused', async () => {
  assert.equal((await seen({ views: [[ID, 'email']] })).status, 400);
  assert.equal((await seen({ views: [['bad id!', 'desktop_tools']] })).status, 400);
  assert.equal((await seen({ views: [] })).status, 400);
  assert.equal((await seen({ ids: [ID], placement: 'desktop_tools' })).status, 400);
  assert.equal(await views(), undefined);
});

test('sources read the entry URL first, then the referrer', () => {
  assert.equal(sourceOf('https://x/?from=email&et=abc', '$direct'), 'Daily email');
  assert.equal(sourceOf('https://x/?utm_source=tiktok', '$direct'), 'TikTok');
  assert.equal(sourceOf('https://x/?via=abcdefgh', '$direct'), 'A reader’s share link');
  assert.equal(sourceOf('https://x/?', 'mail.google.com'), 'Gmail');
  assert.equal(sourceOf('https://x/?', 'www.google.co.uk'), 'Google');
  assert.equal(sourceOf('https://x/?', 't.co'), 'X');
  assert.equal(sourceOf('https://x/?', '$direct'), 'Direct or unknown');
  assert.equal(sourceOf(null, null), 'Direct or unknown');
});

test('breakdowns keep the top rows and fold one-offs into Other', () => {
  const rows = rank([['Google', 5], ['X', 3], ['Google', 2], ['odd.example', 1], ['Other', 1]], 2);
  assert.deepEqual(rows, [{ label: 'Google', count: 7 }, { label: 'X', count: 3 }, { label: 'Other', count: 2 }]);
  assert.deepEqual(rank([['United Kingdom', 1]]), [{ label: 'United Kingdom', count: 1 }]);
  const many = rank([['a', 9], ['b', 8], ['c', 7], ['d', 6], ['e', 5], ['f', 4], ['g', 3]]);
  assert.equal(many.length, 7);
  assert.deepEqual(many.at(-1), { label: 'Other', count: 3 });
});
