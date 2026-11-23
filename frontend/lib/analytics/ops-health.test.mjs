import test from 'node:test';
import assert from 'node:assert/strict';
import { greenShare, groupChecks, parseHistory, parseLatest, stripRows, unitName, worstOf } from './ops-health.ts';

const NOW = Date.parse('2026-11-23T12:00:00Z');

test('parseLatest keeps Trace extras and drops junk', () => {
  const latest = parseLatest({
    generated_at: '2026-11-23T11:58:00+00:00',
    overall: 'sideways',
    checks: [{ id: 'web_home', group: 'services', label: 'Web home', status: 'ok', detail: 'HTTP 200 in 30 ms', ms: 30 }, { group: 'x' }],
    system: { mem_total: 8, mem_available: 3, load: [1, 'x'], disks: [{ mount: '/', free: 1, total: 2 }] },
    traffic: {},
    jobs: [{ unit: 'trace-pulse.service', runs: 8, last_ok: false }, { runs: 1 }],
    timers: [{ unit: 'trace-pulse.service', next_at: '2026-11-23T13:00:00+00:00', user: true }, {}],
    backup: { ok: true, last_ok_at: '2026-11-23T04:12:23+00:00', compressed_bytes: 5, dailies: 31, offsite: false, files: [{ at: '2026-11-23T04:12:23+00:00', bytes: 5 }, { at: 'never', bytes: 1 }] },
    alert: { enabled: false },
  });
  assert.equal(latest.overall, 'unknown');
  assert.equal(latest.checks.length, 1);
  assert.equal(latest.checks[0].ms, 30);
  assert.deepEqual(latest.system.load, [1, 0]);
  assert.equal(latest.system.disks[0].label, '/');
  assert.equal(latest.traffic.last_15m, undefined);
  assert.deepEqual(latest.jobs.map((j) => [j.unit, j.last_ok]), [['trace-pulse.service', false]]);
  assert.deepEqual(latest.timers, [{ unit: 'trace-pulse.service', next_at: '2026-11-23T13:00:00+00:00', last_at: null, user: true }]);
  assert.equal(latest.backup.offsite, false);
  assert.equal(latest.backup.files.length, 1);
  assert.equal(parseLatest({ checks: [] }), null);
  assert.equal(parseLatest(null), null);
});

test('history strip: worst per slot, gaps stay empty, sorted', () => {
  const history = parseHistory({
    entries: [
      { t: '2026-11-23T11:55:00+00:00', o: 'a', c: { web_home: 'a' } },
      { t: '2026-11-23T11:50:00+00:00', o: 'g', c: { web_home: 'g' } },
      { t: 'later', o: 'r' },
    ],
  });
  assert.deepEqual(history.map((e) => e.o), ['g', 'a']);
  const [overall, web] = stripRows(history, ['web_home'], NOW);
  assert.equal(overall.cells.at(-1), 'warn');
  assert.equal(web.cells.at(-1), 'warn');
  assert.equal(overall.cells[0], null);
  assert.equal(greenShare(history, NOW), 0.5);
  assert.equal(greenShare([], NOW), null);
  assert.equal(worstOf(['ok', 'unknown']), 'unknown');
});

test('groups in order and unit names', () => {
  const groups = groupChecks([
    { id: 'a', group: 'box', label: 'A', status: 'ok', detail: '' },
    { id: 'b', group: 'site', label: 'B', status: 'ok', detail: '' },
    { id: 'c', group: 'odd', label: 'C', status: 'ok', detail: '' },
  ]);
  assert.deepEqual(groups.map((g) => g.label), ['Site', 'Box', 'odd']);
  assert.equal(unitName('trace-localdb-backup.service'), 'localdb-backup');
});
