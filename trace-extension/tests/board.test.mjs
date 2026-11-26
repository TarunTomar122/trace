import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addItem, clearDone, dayKey, doneTodayCount, editItem, emptyBoard, hasStory, listItems,
  moveItem, normalizeBoard, openToday, removeItem, rollover, toggleDone,
} from '../lib/board.js';

const T = (h, m = 0) => new Date(2026, 10, 26, h, m);
const texts = (board, list) => listItems(board, list).map((i) => i.text);

function sample() {
  let b = emptyBoard('2026-11-26');
  b = addItem(b, 'today', 'reel', { now: T(6) });
  b = addItem(b, 'today', 'sponsor reply', { now: T(6, 1) });
  b = addItem(b, 'today', '  post   the video ', { now: T(6, 2) });
  b = addItem(b, 'ideas', 'weekly wrap', { now: T(6, 3) });
  return b;
}

test('dayKey uses the local calendar day', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('add trims text, skips empty text and the Done list', () => {
  const b = sample();
  assert.deepEqual(texts(b, 'today'), ['reel', 'sponsor reply', 'post the video']);
  assert.equal(addItem(b, 'today', '   '), b);
  assert.equal(addItem(b, 'done', 'x'), b);
  assert.equal(openToday(b), 3);
});

test('ticking off shows done items first and counts them', () => {
  let b = sample();
  const [, second] = listItems(b, 'today');
  b = toggleDone(b, second.id, T(9));
  assert.deepEqual(texts(b, 'today'), ['sponsor reply', 'reel', 'post the video']);
  assert.equal(openToday(b), 2);
  assert.equal(doneTodayCount(b), 1);
  b = toggleDone(b, second.id, T(10));
  assert.equal(openToday(b), 3);
  assert.equal(listItems(b, 'today')[1].doneAt, undefined);
});

test('a new day moves ticked items to Done and keeps the rest on Today', () => {
  let b = sample();
  b = toggleDone(b, listItems(b, 'today')[0].id, T(7));
  const next = rollover(b, '2026-11-27');
  assert.equal(next.day, '2026-11-27');
  assert.deepEqual(texts(next, 'today'), ['sponsor reply', 'post the video']);
  assert.deepEqual(texts(next, 'done'), ['reel']);
  assert.equal(rollover(next, '2026-11-27'), next);
  assert.equal(doneTodayCount(next), 0);
});

test('a tick made after midnight stays on Today at the late rollover', () => {
  let b = sample();
  b = toggleDone(b, listItems(b, 'today')[0].id, new Date(2026, 10, 27, 0, 5));
  const next = rollover(b, '2026-11-27');
  assert.equal(listItems(next, 'done').length, 0);
  assert.equal(listItems(next, 'today')[0].text, 'reel');
  assert.equal(doneTodayCount(next), 1);
});

test('Done keeps only the latest 40', () => {
  let b = emptyBoard('2026-11-01');
  for (let i = 0; i < 45; i++) {
    b = addItem(b, 'today', `t${i}`);
    b = toggleDone(b, b.items.at(-1).id, new Date(2026, 10, 1, 0, i));
  }
  const next = rollover(b, '2026-11-02');
  assert.equal(listItems(next, 'done').length, 40);
  assert.equal(listItems(next, 'done')[0].text, 't44');
});

test('move places the item before another or at the end of a list', () => {
  let b = sample();
  const [reel, sponsor, post] = listItems(b, 'today');
  b = moveItem(b, post.id, 'today', reel.id);
  assert.deepEqual(texts(b, 'today'), ['post the video', 'reel', 'sponsor reply']);
  b = moveItem(b, sponsor.id, 'ideas');
  assert.deepEqual(texts(b, 'ideas'), ['weekly wrap', 'sponsor reply']);
  b = moveItem(b, reel.id, 'later', 'missing-id');
  assert.deepEqual(texts(b, 'later'), ['reel']);
  assert.equal(moveItem(b, 'nope', 'today'), b);
});

test('moving a ticked item off Today forgets it was done; moving to Done stamps it', () => {
  let b = sample();
  const reel = listItems(b, 'today')[0];
  b = toggleDone(b, reel.id, T(7));
  b = moveItem(b, reel.id, 'later');
  assert.equal(b.items.find((i) => i.id === reel.id).doneAt, undefined);
  b = moveItem(b, reel.id, 'done', null, T(8));
  assert.equal(b.items.find((i) => i.id === reel.id).doneAt, T(8).toISOString());
});

test('edit renames; clearing the text deletes', () => {
  let b = sample();
  const id = listItems(b, 'ideas')[0].id;
  b = editItem(b, id, 'weekly  wrap email');
  assert.deepEqual(texts(b, 'ideas'), ['weekly wrap email']);
  b = editItem(b, id, ' ');
  assert.deepEqual(texts(b, 'ideas'), []);
  b = removeItem(b, listItems(b, 'today')[0].id);
  assert.equal(listItems(b, 'today').length, 2);
});

test('clearDone empties only Done', () => {
  let b = sample();
  b = moveItem(b, listItems(b, 'today')[0].id, 'done', null, T(9));
  b = clearDone(b);
  assert.equal(listItems(b, 'done').length, 0);
  assert.equal(listItems(b, 'today').length, 2);
});

test('story links are cleaned and tracked', () => {
  let b = addItem(emptyBoard(), 'today', 'Chip stocks', { story: { id: 's1', url: 'https://cnbc.com/a', traceUrl: 'javascript:alert(1)', source: 'CNBC' } });
  assert.deepEqual(b.items[0].story, { id: 's1', url: 'https://cnbc.com/a', traceUrl: '', source: 'CNBC' });
  assert.ok(hasStory(b, 's1'));
  b = addItem(b, 'today', 'bad', { story: { id: 's2', url: 'ftp://x' } });
  assert.equal(b.items[1].story, undefined);
});

test('normalize drops junk and duplicates and repairs Done items', () => {
  const b = normalizeBoard({
    day: 'garbage',
    items: [
      { id: 'a', text: 'ok', list: 'today', createdAt: '2026-11-26T08:00:00.000Z' },
      { id: 'a', text: 'dupe', list: 'today' },
      { id: 'b', text: '', list: 'today' },
      { id: 'c', text: 'x', list: 'nowhere' },
      { id: 'd', text: 'old', list: 'done', createdAt: '2026-11-20T08:00:00.000Z' },
      { id: 'e', text: 'idea', list: 'ideas', doneAt: '2026-11-26T08:00:00.000Z' },
      null,
    ],
  }, '2026-11-26');
  assert.equal(b.day, '2026-11-26');
  assert.deepEqual(b.items.map((i) => i.id), ['a', 'd', 'e']);
  assert.equal(b.items[1].doneAt, '2026-11-20T08:00:00.000Z');
  assert.equal(b.items[2].doneAt, undefined);
  assert.deepEqual(normalizeBoard(null, '2026-11-26'), emptyBoard('2026-11-26'));
});
