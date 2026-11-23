import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtSpeed } from '../../components/admin-analytics/format.ts';
import { legacySpeedCell } from './legacy.ts';
import { bucketOf, buildSpeed, emptyCell, MAX_ROUTES, MIN_LOADS, mergeCell, OTHER_ROUTE, parseVitals, percentile, rate, rollupSpeedDay, TREND_DAYS } from './speed.ts';
import { lastDays } from './speed-load.ts';
import { cacheOf, ClsWindow, inpOf, samePath } from './vitals-client.ts';

const NOW = Date.parse('2026-11-13T12:00:00Z');
const DAY = '2026-11-13';
const row = (over = {}) => ({ t: NOW, r: '/brief/[date]', d: 'desktop', ct: '4g', c: 'hit', si: false, lcp: 1200, ttfb: 300, ...over });

test('histograms: thresholds are good, percentiles come back within a bucket', () => {
  assert.equal(rate('lcp', 2500), 'good');
  assert.equal(rate('lcp', 2501), 'needs-work');
  assert.equal(rate('lcp', 4001), 'poor');
  assert.equal(rate('inp', null), null);
  const values = Array.from({ length: 400 }, (_, i) => 100 + i * 20);
  const hist = [];
  for (const v of values) {
    const b = bucketOf('lcp', v);
    while (hist.length <= b) hist.push(0);
    hist[b] += 1;
  }
  const sorted = [...values].sort((a, b) => a - b);
  for (const q of [0.5, 0.75, 0.95]) {
    const truth = sorted[Math.ceil(q * sorted.length) - 1];
    assert.ok(Math.abs(percentile('lcp', hist, q) - truth) / truth < 0.1);
  }
  assert.equal(percentile('lcp', [], 0.75), null);
  const over = [];
  over[bucketOf('lcp', 90_000)] = 1;
  assert.equal(percentile('lcp', over, 0.75), 30000);
});

test('the browser\'s report keeps the route, the device, the server time and nothing else', () => {
  const parsed = parseVitals({ p: '/story/private-id?ref=x', vw: 390, lcp: 2400.6, cls: 0.123456, ttfb: 310, origin: 88.4, ct: '4g', c: 'miss', email: 'a@b.c' }, true);
  assert.deepEqual(parsed, { r: '/story/[id]', d: 'phone', ct: '4g', c: 'miss', si: true, lcp: 2401, cls: 0.1235, ttfb: 310, origin: 88 });
  assert.doesNotMatch(JSON.stringify(parsed), /private|a@b|ref/);
  assert.equal(parseVitals({ p: '/admin/analytics', vw: 1280, lcp: 100 }, null), null);
  assert.equal(parseVitals({ p: '/dev/feed-v2', vw: 1280, lcp: 100 }, null), null);
  assert.equal(parseVitals({ p: '/', lcp: 100 }, null), null);
  // A server time alone is not a page load.
  assert.equal(parseVitals({ p: '/', vw: 1280, origin: 50 }, null), null);
});

test('a day counts by route, device, cache, network and signed in, and caps routes', () => {
  const day = rollupSpeedDay(DAY, [row(), row({ d: 'phone', lcp: 3800, c: 'pass', si: true, ct: '3g' }), row({ r: '/', c: null, ct: null, si: null }), row({ t: NOW - 86_400_000 })]);
  assert.equal(day.n, 3);
  assert.equal(day.routes['/brief/[date]'].phone.c.pass, 1);
  assert.deepEqual(Object.keys(day.cuts).sort(), ['net:3g', 'net:4g', 'net:unknown', 'si:in', 'si:out', 'si:unknown']);
  const many = Array.from({ length: MAX_ROUTES + 30 }, (_, i) => row({ r: `/page-${i}`, lcp: 1000 + i }));
  const capped = rollupSpeedDay(DAY, many);
  assert.equal(Object.keys(capped.routes).length, MAX_ROUTES);
  assert.equal(capped.routes[OTHER_ROUTE].desktop.n, 31);
  const a = [row({ lcp: 900 }), row({ lcp: 5000 })];
  const b = [row({ lcp: 2600, origin: 120 }), row({ lcp: 1800, inp: 300 })];
  const merged = emptyCell();
  mergeCell(merged, rollupSpeedDay(DAY, a).routes['/brief/[date]'].desktop);
  mergeCell(merged, rollupSpeedDay(DAY, b).routes['/brief/[date]'].desktop);
  assert.deepEqual(merged, rollupSpeedDay(DAY, [...a, ...b]).routes['/brief/[date]'].desktop);
});

test('the Speed view ranks routes slowest first and reads the server time', () => {
  const days = lastDays(TREND_DAYS, NOW);
  const dayAt = (i, rows) => rollupSpeedDay(days[i], rows.map((r) => ({ ...r, t: Date.parse(`${days[i]}T10:00:00Z`) })));
  const rows = [
    ...Array.from({ length: MIN_LOADS }, () => row({ r: '/fast', lcp: 900, origin: 40 })),
    ...Array.from({ length: MIN_LOADS }, () => row({ r: '/slow', lcp: 5200, origin: 400 })),
    row({ r: '/once', lcp: 9000 }),
  ];
  const list = Array.from({ length: TREND_DAYS }, (_, i) => dayAt(i, i === TREND_DAYS - 1 ? rows : []));
  const view = buildSpeed({ days: list, range: '7d', device: 'all', now: NOW });
  assert.deepEqual(view.routes.map((r) => r.route), ['/once', '/slow', '/fast']);
  assert.equal(view.server.loads, 2 * MIN_LOADS);
  assert.ok(view.server.p95 > 300 && view.server.p95 <= 400);
  const phones = buildSpeed({ days: list, range: '7d', device: 'phone', now: NOW });
  assert.equal(phones.loads, 0);
  const none = buildSpeed({ days: [rollupSpeedDay(DAY, [])], range: '7d', device: 'all', now: NOW });
  assert.equal(none.empty, true);
  assert.equal(none.server.p95, null);
});

test('the first version\'s timings count for the whole site, never for a route or a device', () => {
  const cell = legacySpeedCell(4, [
    { metric: 'lcp', value: 1200, n: 3 },
    { metric: 'lcp', value: 5000, n: 1 },
    { metric: 'cls', value: 50, n: 4 },
    { metric: 'origin', value: 90, n: 2 },
    { metric: 'bogus', value: 1, n: 9 },
  ]);
  assert.equal(cell.n, 4);
  assert.equal(cell.h.lcp.reduce((a, b) => a + b, 0), 4);
  assert.ok(percentile('cls', cell.h.cls, 0.75) <= 0.05);
  assert.equal(legacySpeedCell(0, []), null);
  const day = { ...rollupSpeedDay(DAY, [row()]), legacy: cell };
  const all = buildSpeed({ days: [day], range: 'today', device: 'all', now: NOW });
  assert.equal(all.loads, 5);
  assert.equal(all.server.loads, 2);
  assert.equal(all.routes.length, 1);
  assert.equal(all.routes[0].loads, 1);
  assert.equal(buildSpeed({ days: [day], range: 'today', device: 'desktop', now: NOW }).loads, 1);
});

test('collecting in the browser', () => {
  const cls = new ClsWindow();
  cls.add(0.05, 0);
  cls.add(0.05, 500);
  cls.add(0.02, 3000);
  assert.ok(Math.abs(cls.value - 0.1) < 1e-9);
  assert.equal(inpOf([]), undefined);
  assert.equal(inpOf([40, 300, 120]), 300);
  assert.equal(samePath('https://www.yourtrace.online/brief/?x=1', '/brief'), true);
  assert.equal(samePath('https://www.yourtrace.online/admin/analytics', '/brief'), false);
  assert.equal(cacheOf({ transferSize: 0, decodedBodySize: 5000, serverTiming: [] }), 'browser');
  assert.equal(cacheOf({ transferSize: 1000, decodedBodySize: 5000, serverTiming: [{ name: 'cache', description: 'HIT' }] }), 'hit');
  assert.equal(fmtSpeed('lcp', 996), '1.0 s');
  assert.equal(fmtSpeed('cls', 0.004), '<0.01');
  assert.equal(fmtSpeed('inp', null), 'n/a');
});
