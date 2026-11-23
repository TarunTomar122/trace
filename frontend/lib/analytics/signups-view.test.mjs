import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agoText, dayWordsUtc, formWords, fromWords, loadSignupsView, parseSignups } from './signups-view.ts';
import { loadOpsHealth } from './ops-health.ts';

const NOW = Date.parse('2026-11-23T12:30:00Z');
const H = 3600_000;
const D = 24 * H;

function snapshot(extra = {}) {
  return {
    generatedAt: '2026-11-23T12:25:00+00:00',
    total: 6,
    created: [NOW - 30 * 60_000, NOW - 11 * H, NOW - D - 2 * H, NOW - D + H, NOW - 8 * D, NOW - 40 * D, NOW + H],
    newsletter: { active: 3, total: 4 },
    accounts: { total: 3, cameBack: 1, eligible: 2 },
    referred: { count: 2, readers: 1 },
    paid: { count: 1, paying: 1, trial: 0, lapsed: 2 },
    rowsTotal: 6,
    authMissing: false,
    rows: [
      { id: 'u1', email: 'a@example.com', name: 'Ann', photo: null, createdMs: NOW - 30 * 60_000, kind: 'both', method: 'google', plan: 'paid', planNote: null, paying: true, newsletter: 'on', lastSeenMs: NOW, cameBack: null, from: { id: 'youtube', heard: true }, form: 'app_web' },
      { id: 'n1', email: 'r@example.com', createdMs: NOW - 11 * H, kind: 'newsletter', method: 'fax', plan: 'gold', newsletter: 'off', from: { id: 'x' }, form: 'landing_page' },
      { id: '', kind: 'account' },
      { id: 'bad', kind: 'robot' },
    ],
    ...extra,
  };
}

test('tiles are worked out from every signup time at render, futures left out', () => {
  const view = parseSignups(snapshot(), NOW);
  assert.equal(view.today.count, 2);
  assert.equal(view.today.hours.length, 13); // 00:00 to 12:59
  assert.equal(view.today.hours[1], 1); // 01:30
  assert.equal(view.today.hours[12], 1); // 12:00
  assert.equal(view.today.yesterday, 1); // 10:30 yesterday; 13:30 yesterday is after "by now"
  assert.equal(view.week.count, 4);
  assert.equal(view.week.days.at(-1), 2);
  assert.equal(view.month.count, 5);
  assert.equal(view.month.previous, 1);
  assert.equal(view.firstMs, NOW - 40 * D);
  assert.equal(view.total, 6);
  assert.equal(view.generatedMs, Date.parse('2026-11-23T12:25:00Z'));
});

test('rows are shape-checked: bad ids and kinds dropped, unknown enums blanked', () => {
  const view = parseSignups(snapshot(), NOW);
  assert.deepEqual(view.rows.map((r) => r.id), ['u1', 'n1']);
  const reader = view.rows[1];
  assert.equal(reader.method, null);
  assert.equal(reader.plan, null);
  assert.equal(reader.newsletter, 'off');
  assert.deepEqual(reader.from, { id: 'x', heard: false });
  assert.equal(reader.cameBack, null);
  assert.equal(view.rows[0].paying, true);
});

test('missing or broken block gives null', () => {
  assert.equal(parseSignups(null, NOW), null);
  assert.equal(parseSignups({ rows: [] }, NOW), null);
  assert.equal(parseSignups('nope', NOW), null);
});

test('words', () => {
  assert.deepEqual(fromWords({ id: 'youtube', heard: true }), { label: 'YouTube', host: 'youtube.com' });
  assert.deepEqual(fromWords({ id: 'news.example.org', heard: false }), { label: 'news.example.org', host: 'news.example.org' });
  assert.deepEqual(fromWords({ id: 'mystery', heard: false }), { label: 'mystery', host: null });
  assert.equal(formWords('daily_page'), 'Brief pages');
  assert.equal(formWords('new_form'), 'new form');
  assert.equal(formWords(null), '');
  assert.equal(agoText(NOW - 90 * 60_000, NOW), '1 h ago');
  assert.equal(dayWordsUtc(NOW - D, NOW), 'yesterday');
});

test('loaders read TRACE_ANALYTICS_SNAPSHOT and fail soft', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trace-snap-'));
  const file = join(dir, 'latest.json');
  const before = process.env.TRACE_ANALYTICS_SNAPSHOT;
  try {
    process.env.TRACE_ANALYTICS_SNAPSHOT = file;
    assert.equal(await loadSignupsView(NOW), null); // no file
    assert.equal(await loadOpsHealth(), null);
    writeFileSync(file, JSON.stringify({ signups: snapshot(), ops: { latest: { generated_at: '2026-11-23T12:25:00+00:00', checks: [] }, history: { entries: [] } } }));
    const view = await loadSignupsView(NOW);
    assert.equal(view.rows.length, 2);
    const ops = await loadOpsHealth();
    assert.equal(ops.latest.generated_at, '2026-11-23T12:25:00+00:00');
    writeFileSync(file, '{broken');
    assert.equal(await loadSignupsView(NOW), null);
  } finally {
    if (before === undefined) delete process.env.TRACE_ANALYTICS_SNAPSHOT;
    else process.env.TRACE_ANALYTICS_SNAPSHOT = before;
    rmSync(dir, { recursive: true, force: true });
  }
});
