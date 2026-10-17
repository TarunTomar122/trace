// POST /api/email/visit: a reader landed from one of the daily's own links.
// Runs the real route handler against the in-memory store.
import './test-support/next-route-hooks.mjs';
import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

const { NextRequest } = await import('next/server');
const { adminFirestore: db } = await import('./test-support/firebase-admin-stub.mjs');
const { resetRateLimits } = await import('./oauth-http.ts');
const { normalizeTrackId } = await import('./email-visit.ts');
const visitRoute = await import('../app/api/email/visit/route.ts');

const TRACK_ID = 'a'.repeat(32);
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

function visit(body, { userAgent = BROWSER, ip = '203.0.113.7' } = {}) {
  return visitRoute.POST(new NextRequest('https://www.yourtrace.online/api/email/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'X-Forwarded-For': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

beforeEach(async () => {
  db.reset();
  resetRateLimits();
  await db.collection('email_sends').doc('s1').set({
    to: 'Reader@Example.com', bucket: 'winback', date: '2026-10-16', track_id: TRACK_ID, status: 'sent',
  });
});

test('a visit from a real send is recorded once per send, with who and which email', async () => {
  const before = new Date().toISOString().slice(0, 10);
  const res = await visit({ t: TRACK_ID.toUpperCase() });
  const after = new Date().toISOString().slice(0, 10);
  assert.equal(res.status, 200);
  const doc = (await db.collection('email_events').doc(`visit-${TRACK_ID}`).get()).data();
  assert.equal(doc.kind, 'visit');
  assert.equal(doc.email, 'reader@example.com');
  assert.equal(doc.bucket, 'winback');
  assert.equal(doc.send_date, '2026-10-16');
  assert.equal(doc.user_agent, BROWSER);
  assert.ok([before, after].includes(doc.date));

  await visit({ t: TRACK_ID });
  assert.equal((await db.collection('email_events').get()).size, 1);
});

test('ids we never sent are refused and leave nothing behind', async () => {
  assert.equal((await visit({ t: 'b'.repeat(32) })).status, 404);
  assert.equal((await visit({ t: 'not-an-id' })).status, 400);
  assert.equal((await visit({})).status, 400);
  assert.equal((await visit('not json')).status, 400);
  assert.equal((await db.collection('email_events').get()).size, 0);
});

test('headless browsers and crawlers are not readers', async () => {
  const headless = BROWSER.replace('Chrome/', 'HeadlessChrome/');
  assert.equal((await visit({ t: TRACK_ID }, { userAgent: headless })).status, 403);
  assert.equal((await visit({ t: TRACK_ID }, { userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' })).status, 403);
  assert.equal((await visit({ t: TRACK_ID }, { userAgent: 'link-checker bot 1.0' })).status, 403);
  // A phone whose model name ends in "bot" is still a reader.
  const cubot = 'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
  assert.equal((await visit({ t: TRACK_ID }, { userAgent: cubot })).status, 200);
});

test('one client is rate limited', async () => {
  for (let i = 0; i < 20; i += 1) await visit({ t: 'c'.repeat(32) }, { ip: '198.51.100.1' });
  assert.equal((await visit({ t: TRACK_ID }, { ip: '198.51.100.1' })).status, 429);
  assert.equal((await visit({ t: TRACK_ID }, { ip: '198.51.100.2' })).status, 200);
});

test('track ids are normalised and validated', () => {
  assert.equal(normalizeTrackId(` ${TRACK_ID.toUpperCase()} `), TRACK_ID);
  assert.equal(normalizeTrackId('a'.repeat(31)), '');
  assert.equal(normalizeTrackId(42), '');
});
