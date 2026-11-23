import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Every write in this file goes to a throwaway folder.
const dir = mkdtempSync(join(tmpdir(), 'trace-analytics-test-'));
process.env.TRACE_ANALYTICS_DIR = dir;

const { analyticsNamespace, MAX_DAY_EVENTS } = await import('./db.ts');
const { loadDashboard, loadLive, resetDashboardCacheForTests } = await import('./dashboard.ts');
const { chunkId, enqueue, flush, ingestStateForTests, parseBeacon, resetIngestForTests, spoolNow, VITALS_FLUSH_AT } = await import('./ingest.ts');
const { pruneRawChunks } = await import('./retention.ts');
const { loadSpeed, resetSpeedCacheForTests } = await import('./speed-load.ts');
const { closeAnalyticsForTests, maintain, sqlite } = await import('./store.ts');
const { SaltKeeper } = await import('./visitor.ts');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const IP = '198.51.100.23';
const NS = 'development';
const OWN = ['www.yourtrace.online', 'yourtrace.online', 'localhost'];

test.after(() => {
  closeAnalyticsForTests();
  rmSync(dir, { recursive: true, force: true });
});

test.beforeEach(() => {
  resetIngestForTests();
  resetDashboardCacheForTests();
  resetSpeedCacheForTests();
});

test('a beacon keeps key events with clean values and drops private pages, unknown events and free text', () => {
  const beacon = parseBeacon({
    sid: 'abcdefgh12345678',
    sw: 390,
    si: true,
    e: [
      { n: '$pageview', p: '/story/s1?email=a@b.c', r: 'https://www.google.com/search?q=private', u: { s: 'X', c: 'Launch!' } },
      { n: '$pageview', p: '/admin/analytics' },
      { n: '$pageview', p: '/sponsor/acme-private' },
      { n: 'feed_item_upvoted', p: '/feed' },
      { n: 'newsletter_signup', p: '/blog/x', x: { source: 'blog_inline', email: 'a@b.c' } },
    ],
  }, OWN);
  assert.equal(beacon.events.length, 3);
  assert.deepEqual(beacon.events.map((e) => [e.n, e.p, e.r]), [['pageview', '/story/s1', '/story/[id]'], ['pageview', '/sponsor/[id]', '/sponsor/[id]'], ['newsletter_signup', '/blog/x', '/blog/[slug]']]);
  assert.equal(beacon.events[0].ref, 'google.com');
  assert.equal(beacon.events[0].us, 'x');
  assert.deepEqual(beacon.events[2].props, { kind: 'blog_inline' });
  assert.equal(beacon.sw, '<480');
  assert.equal(parseBeacon({ page: '/feed', source: 'Direct' }, OWN), null);
  assert.equal(parseBeacon({ sid: 'x', e: [] }, OWN), null);
  assert.equal(analyticsNamespace('www.yourtrace.online', 'production'), 'production');
  assert.equal(analyticsNamespace('www.yourtrace.online', 'development'), 'development');
  assert.equal(analyticsNamespace('preview.example', 'production'), 'development');
});

test('events are hashed and written to SQLite with no address or User-Agent, then counted on the dashboard', async () => {
  const now = Date.now();
  const body = (sid, e) => parseBeacon({ sid, sw: 1440, si: false, e }, OWN);
  enqueue(body('sessiona12345678', [{ n: '$pageview', p: '/', r: 'https://news.ycombinator.com/item?id=1' }, { n: '$pageview', p: '/brief/2026-11-20' }, { n: 'share_initiated', p: '/brief/2026-11-20', x: { channel: 'x' } }]), { host: 'localhost:5001', ip: IP, ua: UA, country: 'DE', now });
  enqueue(body('sessionb12345678', [{ n: '$pageview', p: '/blog' }, { n: 'newsletter_signup', p: '/blog', x: { source: 'blog_inline' } }]), { host: 'localhost:5001', ip: '203.0.113.9', ua: UA, country: 'IN', now });
  assert.equal(ingestStateForTests().buffer.length, 5);
  await flush();
  assert.equal(ingestStateForTests().buffer.length, 0);
  const rows = sqlite(NS).prepare('SELECT body FROM event_chunks').all();
  assert.equal(rows.length, 1);
  const raw = String(rows[0].body);
  assert.doesNotMatch(raw, /198\.51|203\.0|Macintosh|item\?id/);
  const chunk = JSON.parse(raw);
  const signup = chunk.events.find((e) => e.n === 'newsletter_signup');
  assert.equal(signup.sid, '');
  assert.equal(signup.t % 60_000, 0);
  assert.equal(chunkId(chunk).length > 20, true);

  const board = await loadDashboard(NS, 'today', now);
  assert.equal(board.headline.visitors.value, 2);
  assert.equal(board.headline.pageviews.value, 3);
  assert.equal(board.headline.signups.value, 1);
  assert.deepEqual(board.sources.referrers.map((r) => r.key).sort(), ['(direct)', 'news.ycombinator.com']);
  assert.deepEqual(board.reads.map((r) => r.path), ['/brief/2026-11-20']);
  assert.deepEqual(board.forms.map((r) => r.key), ['blog_inline']);
  assert.deepEqual(board.shares.map((r) => r.key), ['x']);
  assert.deepEqual(board.funnel.slice(0, 2).map((s) => s.count), [2, 1]);
  const live = await loadLive(NS, now + 1000);
  assert.equal(live.visitors, 2);
});

test('the first version\'s totals and timings stay on the dashboard for their days', async () => {
  const now = Date.now();
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
  const db = sqlite(NS);
  const put = db.prepare('INSERT OR REPLACE INTO totals VALUES(?,?,?,?)');
  put.run(yesterday, 'visitors', 'all', 40);
  put.run(yesterday, 'page', '/feed', 70);
  put.run(yesterday, 'source', 'Direct', 30);
  put.run(yesterday, 'country', 'US', 70);
  put.run(yesterday, 'loads', 'all', 12);
  db.prepare('INSERT OR REPLACE INTO timings VALUES(?,?,?,?)').run(yesterday, 'lcp', 1500, 12);
  db.prepare('INSERT OR REPLACE INTO timings VALUES(?,?,?,?)').run(yesterday, 'origin', 80, 10);
  const week = await loadDashboard(NS, '7d', now);
  assert.equal(week.headline.visitors.value >= 42, true);
  assert.equal(week.pages.paths.find((p) => p.key === '/feed').views, 70);
  assert.equal(week.series.find((p) => p.label === yesterday).visitors, 40);
  const speed = await loadSpeed(NS, '7d', 'all', now);
  assert.equal(speed.loads, 12);
  assert.equal(speed.server.loads, 10);
  // The old tables are only read: nothing in them changes.
  assert.equal(Number(db.prepare('SELECT COUNT(*) n FROM totals').get().n), 5);
});

test('page-load timings ride in their own chunks and fold into the Speed view', async () => {
  const now = Date.now();
  for (let i = 0; i < VITALS_FLUSH_AT; i += 1) {
    enqueue(parseBeacon({ sid: 'sessionc12345678', sw: 390, si: null, e: [], v: { p: '/story/s1', vw: 390, lcp: 1800 + i, ttfb: 200, origin: 60, ct: '4g' } }, OWN), { host: 'localhost', ip: IP, ua: UA, now: now + i });
  }
  await flush();
  assert.equal(Number(sqlite(NS).prepare('SELECT COUNT(*) n FROM vitals_chunks').get().n), 1);
  const view = await loadSpeed(NS, 'today', 'phone', now);
  assert.equal(view.loads, VITALS_FLUSH_AT);
  assert.equal(view.routes[0].route, '/story/[id]');
  assert.equal(view.server.loads, VITALS_FLUSH_AT);
});

test('raw chunks go five days after their day, once the final rollup is stored', async () => {
  const now = Date.now();
  const old = now - 20 * 86_400_000; // outside every range loaded above, so its day is not folded yet
  const oldDay = new Date(old).toISOString().slice(0, 10);
  enqueue(parseBeacon({ sid: 'sessiond12345678', e: [{ n: '$pageview', p: '/feed' }] }, OWN), { host: 'localhost', ip: IP, ua: UA, now: old });
  await flush();
  const before = Number(sqlite(NS).prepare('SELECT COUNT(*) n FROM event_chunks').get().n);
  assert.deepEqual(await pruneRawChunks(NS, now), { deleted: 1 });
  assert.equal(Number(sqlite(NS).prepare('SELECT COUNT(*) n FROM event_chunks').get().n), before - 1);
  const stored = JSON.parse(String(sqlite(NS).prepare('SELECT body FROM daily WHERE day=?').get(oldDay).body));
  assert.equal(stored.complete, true);
  assert.equal(stored.pv, 1);
});

test('a shutdown spools hashed events and the next process writes them', async () => {
  const now = Date.now();
  enqueue(parseBeacon({ sid: 'sessione12345678', e: [{ n: '$pageview', p: '/about' }] }, OWN), { host: 'localhost', ip: IP, ua: UA, now });
  await flush();
  enqueue(parseBeacon({ sid: 'sessione12345678', e: [{ n: '$pageview', p: '/contact' }] }, OWN), { host: 'localhost', ip: IP, ua: UA, now });
  spoolNow();
  const spooled = readdirSync(dir).filter((name) => name.startsWith('trace-analytics-spool-'));
  assert.equal(spooled.length, 1);
  ingestStateForTests().spoolRead = false;
  await flush();
  assert.equal(readdirSync(dir).filter((name) => name.startsWith('trace-analytics-spool-')).length, 0);
  const board = await loadDashboard(NS, 'today', now);
  assert.equal(board.pages.paths.some((p) => p.key === '/contact'), true);
});

test('the salt rotates daily and old salts go', async () => {
  const store = new Map();
  const keeper = new SaltKeeper({
    read: async (day) => store.get(day) ?? null,
    create: async (day, salt) => (store.has(day) ? false : (store.set(day, salt), true)),
    removeBefore: async (day) => { for (const key of [...store.keys()]) if (key < day) store.delete(key); },
  });
  const a = await keeper.saltFor(Date.parse('2026-11-13T10:00:00Z'));
  const b = await keeper.saltFor(Date.parse('2026-11-14T10:00:00Z'));
  assert.notEqual(a, b);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual([...store.keys()], ['2026-11-14']);
  // A late event from the day before is hashed with today's salt, never a re-created old one.
  assert.equal(await keeper.saltFor(Date.parse('2026-11-13T23:59:00Z')), b);
  maintain();
});

test('a day whose raw read hit the cap stays open, and its raw rows are kept', async () => {
  const now = Date.now();
  const t = now - 30 * 86_400_000;
  const day = new Date(t).toISOString().slice(0, 10);
  const put = sqlite(NS).prepare('INSERT OR REPLACE INTO event_chunks VALUES(?,?,?,?,?,?,?,?)');
  const event = { t, n: 'pageview', sid: 'capsession000001', vid: 'v1', p: '/feed', r: '/feed' };
  const chunk = (id, count) => put.run(id, day, day, t, t, count, JSON.stringify({ days: [day], first_ts: t, last_ts: t, count, events: [event], created_at: new Date(t).toISOString() }), new Date(t).toISOString());
  chunk('cap-a', MAX_DAY_EVENTS);
  chunk('cap-b', 1);
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    assert.deepEqual(await pruneRawChunks(NS, now), { deleted: 0 });
  } finally {
    console.warn = warn;
  }
  assert.equal(Number(sqlite(NS).prepare("SELECT COUNT(*) n FROM event_chunks WHERE id LIKE 'cap-%'").get().n), 2);
  assert.equal(sqlite(NS).prepare('SELECT body FROM daily WHERE day=?').get(day), undefined);
});

test('ranges share one fold of an open day for a minute', async () => {
  const now = Date.now();
  enqueue(parseBeacon({ sid: 'sessionf12345678', e: [{ n: '$pageview', p: '/agents' }] }, OWN), { host: 'localhost', ip: IP, ua: UA, now });
  await flush();
  const first = await loadDashboard(NS, 'today', now);
  enqueue(parseBeacon({ sid: 'sessiong12345678', e: [{ n: '$pageview', p: '/agents' }] }, OWN), { host: 'localhost', ip: '203.0.113.50', ua: UA, now });
  await flush();
  // Another range within the minute reuses today's fold; after it, the new event counts.
  const week = await loadDashboard(NS, '7d', now + 1000);
  assert.equal(week.pages.paths.find((p) => p.key === '/agents').views, first.pages.paths.find((p) => p.key === '/agents').views);
  const later = await loadDashboard(NS, 'today', now + 61_000);
  assert.equal(later.pages.paths.find((p) => p.key === '/agents').views, first.pages.paths.find((p) => p.key === '/agents').views + 1);
});
