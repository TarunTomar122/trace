import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboard, rangeDays } from './dashboard.ts';
import { funnel, stepRates } from './funnel.ts';
import { legacyRollup } from './legacy.ts';
import { combineDays, emptyRollup, exitRate, hoursUpTo, liveView, mergeRollups, rollupDay } from './rollup.ts';

const DAY = '2026-11-13';
const at = (hhmm, s = 0) => Date.parse(`${DAY}T${hhmm}:${String(s).padStart(2, '0')}Z`);
const route = (p) => (p.startsWith('/brief/') ? '/brief/[date]' : p.startsWith('/story/') ? '/story/[id]' : p);
const pv = (vid, sid, t, p, extra = {}) => ({ t, n: 'pageview', vid, sid, p, r: route(p), ...extra });
const hour = (over = {}) => ({ pv: 0, v: 0, s: 0, b: 0, d: 0, su: 0, pd: 0, ...over });

// Three visitors, four visits:
//  a: one visit from google, / then /brief/2026-11-13 then /story/s1 (2 minutes), signed in
//  b: one bounce on /blog (direct), from India, then a newsletter signup (an account event: no session)
//  c: two visits, 09:00 bounce on / (x.com) and 15:00 /story/s1 then a share (30 s)
const events = [
  pv('a', 's1', at('08:00'), '/', { ref: 'google.com', cc: 'US', dev: 'desktop', br: 'Chrome', si: true }),
  pv('a', 's1', at('08:01'), '/brief/2026-11-13', { si: true }),
  pv('a', 's1', at('08:02'), '/story/s1', { si: true }),
  pv('b', 's2', at('08:30'), '/blog', { cc: 'IN', dev: 'mobile', br: 'Safari' }),
  { t: at('08:31'), n: 'newsletter_signup', vid: 'b', sid: '', p: '/blog', r: '/blog', kind: 'blog_inline' },
  pv('c', 's3', at('09:00'), '/', { ref: 'x.com', us: 'x', uc: 'launch', cc: 'US', dev: 'mobile', br: 'Safari' }),
  pv('c', 's4', at('15:00'), '/story/s1', { cc: 'US', dev: 'mobile', br: 'Safari' }),
  { t: at('15:00', 30), n: 'share', vid: 'c', sid: 's4', p: '/story/s1', r: '/story/[id]', kind: 'x' },
  // another day's event never leaks in
  pv('z', 's9', Date.parse('2026-11-12T23:59:00Z'), '/'),
];

test('a day counts visitors, pageviews, visits, bounces and visit length', () => {
  const day = rollupDay(DAY, events, { complete: true, now: at('23:59') });
  assert.equal(day.v, 3);
  assert.equal(day.pv, 6);
  assert.equal(day.s, 4);
  // b's single view and c's 09:00 single view; c's 15:00 visit had a share, so it is not a bounce
  assert.equal(day.b, 2);
  assert.equal(day.d, 150);
  assert.equal(day.si_pv, 3);
  assert.equal(day.si_v, 1);
  assert.equal(day.complete, true);
  assert.deepEqual(day.hours[8], hour({ pv: 4, v: 2, s: 2, b: 1, d: 120, su: 1 }));
  assert.deepEqual(day.hours[15], hour({ pv: 1, s: 1, d: 30 }));
  assert.deepEqual(hoursUpTo(day, 9), hour({ pv: 5, v: 3, s: 3, b: 2, d: 120, su: 1 }));
});

test('pages, reads, sources and key events', () => {
  const day = rollupDay(DAY, events);
  assert.deepEqual(day.pages['/'], { pv: 2, v: 2, x: 1, e: 2 });
  assert.deepEqual(day.pages['/story/s1'], { pv: 2, v: 2, x: 2, e: 1 });
  assert.deepEqual(day.routes['/story/[id]'], { pv: 2, v: 2, x: 2, e: 1 });
  assert.deepEqual(day.reads, { '/brief/2026-11-13': { pv: 1, v: 1 }, '/story/s1': { pv: 2, v: 2 } });
  assert.deepEqual(day.refs, { 'google.com': 1, '(direct)': 2, 'x.com': 1 });
  assert.deepEqual(day.utm_source, { x: 1 });
  assert.deepEqual(day.countries, { US: 2, IN: 1 });
  assert.deepEqual(day.events.newsletter_signup, { n: 1, v: 1 });
  assert.deepEqual(day.forms, { blog_inline: 1 });
  assert.deepEqual(day.shares, { x: 1 });
  assert.equal(rollupDay('2026-11-10', events).hours.length, 24);
});

test('the dashboard compares today with yesterday up to the same hour', () => {
  const now = at('09:30');
  const yesterday = emptyRollup('2026-11-12');
  yesterday.hours[8] = hour({ pv: 10, v: 4, s: 5, b: 2, d: 300, su: 2 });
  yesterday.hours[20] = hour({ pv: 99, v: 50, s: 60, b: 10, d: 999, su: 9 });
  const board = buildDashboard({ range: 'today', now, current: [rollupDay(DAY, events.filter((e) => e.t <= now))], previous: [yesterday] });
  assert.deepEqual([board.headline.visitors.value, board.headline.visitors.previous], [3, 4]);
  assert.deepEqual([board.headline.pageviews.value, board.headline.pageviews.previous], [5, 10]);
  assert.deepEqual([board.headline.signups.value, board.headline.signups.previous], [1, 2]);
  assert.equal(board.series.length, 10);
  assert.equal(board.series[8].label, '08:00');
  assert.equal(board.signedIn.share, 3 / 5);
  assert.deepEqual(board.funnel.map((s) => s.count), [3, 1, 0, 0, 0, 0]);
});

test('a 7-day range so far against the 7 days before, cut at the same hour', () => {
  const now = at('09:30');
  const full = (day, n) => {
    const r = emptyRollup(day);
    r.pv = n;
    r.hours[8] = hour({ pv: n / 2 });
    r.hours[20] = hour({ pv: n / 2 });
    return r;
  };
  const { current: days, previous: before } = rangeDays('7d', now);
  const current = days.map((d) => (d === DAY ? rollupDay(DAY, events.filter((e) => e.t <= now)) : full(d, 10)));
  const board = buildDashboard({ range: '7d', now, current, previous: before.map((d) => full(d, 20)) });
  assert.equal(board.headline.pageviews.value, 65);
  assert.equal(board.headline.pageviews.previous, 130);
  assert.equal(rangeDays('90d', now).previous.length, 90);
  assert.equal(rangeDays('today', now).previous[0], '2026-11-12');
});

test('days add up, and odd keys never touch the prototype', () => {
  const d13 = rollupDay(DAY, events);
  const d12 = rollupDay('2026-11-12', events);
  const totals = mergeRollups([d12, d13]);
  assert.equal(totals.v, 4);
  assert.equal(totals.refs['(direct)'], 3);
  const odd = pv('a', 's1', at('08:00'), '/', { ref: 'constructor', us: 'constructor', uc: '__proto__' });
  const range = mergeRollups([rollupDay(DAY, [odd]), rollupDay(DAY, [odd])]);
  assert.equal(range.refs.constructor, 2);
  assert.deepEqual(Object.keys(range.utm_campaign), []);
  assert.equal({}.pv, undefined);
});

test('the live view puts each visitor on the page they viewed last', () => {
  const live = liveView(events, at('15:03'));
  assert.equal(live.visitors, 1);
  assert.deepEqual(live.pages, [{ path: '/story/s1', visitors: 1 }]);
  assert.equal(liveView(events, at('16:00')).visitors, 0);
});

test('the funnel follows newsletter, account, onboarding, checkout and payment', () => {
  const steps = funnel({ v: 100, events: { newsletter_signup: { n: 12, v: 10 }, signup_completed: { n: 5, v: 5 }, onboarded: { n: 4, v: 4 }, checkout_started: { n: 2, v: 1 } } });
  assert.deepEqual(steps.map((s) => [s.id, s.count]), [['visit', 100], ['newsletter', 10], ['account', 5], ['onboarded', 4], ['checkout', 1], ['paid', 0]]);
  // Each a share of what it follows: newsletter, accounts and checkouts of visitors, onboarded of accounts, paid of checkouts.
  assert.deepEqual(stepRates(steps), [null, 0.1, 0.05, 0.8, 0.01, 0]);
  // An account without a newsletter signup never reads as over 100%, nor does a range of per-day people.
  const odd = funnel({ v: 3, events: { newsletter_signup: { n: 1, v: 1 }, signup_completed: { n: 5, v: 5 } } });
  assert.deepEqual(stepRates(odd).slice(0, 3), [null, 1 / 3, 1]);
  assert.deepEqual(stepRates(funnel({ v: 0, events: {} })), [null, null, null, null, null, null]);
});

test('the first version\'s totals become a rollup that adds onto the new one', () => {
  const rows = [
    { kind: 'visitors', label: 'all', n: 50 },
    { kind: 'page', label: '/blog/[page]', n: 30 },
    { kind: 'page', label: '/feed', n: 20 },
    { kind: 'source', label: 'Direct', n: 10 },
    { kind: 'source', label: 'Internal', n: 40 },
    { kind: 'source', label: 'google.com', n: 5 },
    { kind: 'country', label: 'Unknown', n: 2 },
    { kind: 'country', label: 'US', n: 48 },
    { kind: 'device', label: 'mobile', n: 50 },
    { kind: 'loads', label: 'all', n: 9 },
  ];
  const legacy = legacyRollup('2026-11-21', rows);
  assert.equal(legacy.v, 50);
  assert.equal(legacy.pv, 50);
  assert.equal(legacy.lpv, 50);
  assert.deepEqual(legacy.pages['/blog/[slug]'], { pv: 30, v: 0, x: 0, e: 0 });
  assert.deepEqual(legacy.refs, { '(direct)': 10, 'google.com': 5 });
  assert.deepEqual(legacy.countries, { '??': 2, US: 48 });
  assert.equal(legacy.hours.reduce((n, h) => n + h.v, 0), 50);
  assert.equal(legacy.hours.reduce((n, h) => n + h.pv, 0), 50);
  assert.equal(exitRate(legacy.pages['/feed']), null);
  // Today so far: spread over the hours that have passed only.
  const today = legacyRollup('2026-11-21', rows, 2);
  assert.deepEqual(today.hours.slice(0, 3).map((h) => h.v), [25, 25, 0]);
  assert.equal(legacyRollup('2026-11-21', []), null);
  // The rollup of the same day (after the switch) adds on; the inputs stay as they were.
  const fresh = rollupDay(DAY, events);
  const both = combineDays(fresh, legacyRollup(DAY, rows));
  assert.equal(both.v, 53);
  assert.equal(both.pv, 56);
  assert.equal(fresh.v, 3);
  const board = buildDashboard({ range: 'today', now: at('23:00'), current: [both], previous: [emptyRollup('2026-11-12')] });
  // Signed in is a share of the pageviews that carry the flag (the new ones).
  assert.equal(board.signedIn.share, 3 / 6);
  assert.equal(board.headline.visitors.value, 53);
});
