// The owner's day board on the new tab (unpacked installs only; see board.js).
// Pure functions over one plain object kept in chrome.storage.local:
// { v: 1, day: 'YYYY-MM-DD', items: [{ id, text, list, createdAt, doneAt?, story? }] }
// Array order is the order inside each list.

export const LISTS = ['today', 'ideas', 'later', 'done'];
const MAX_TEXT = 300;
const MAX_ITEMS = 400;
const DONE_KEEP = 40;

/** Local calendar day, so the board turns over at the owner's midnight, not UTC's. */
export function dayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '';
}

function webUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function cleanStory(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const url = webUrl(value.url);
  if (!id || !url) return null;
  return { id, url, traceUrl: webUrl(value.traceUrl), source: cleanText(value.source).slice(0, 80) };
}

function isoOrEmpty(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : '';
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyBoard(day = dayKey()) {
  return { v: 1, day, items: [] };
}

/** Anything read from storage goes through here first. */
export function normalizeBoard(value, day = dayKey()) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.items)) return emptyBoard(day);
  const seen = new Set();
  const items = [];
  for (const raw of value.items) {
    if (!raw || typeof raw !== 'object') continue;
    const id = cleanText(raw.id).slice(0, 64);
    const text = cleanText(raw.text);
    const list = LISTS.includes(raw.list) ? raw.list : '';
    if (!id || !text || !list || seen.has(id)) continue;
    seen.add(id);
    const item = { id, text, list, createdAt: isoOrEmpty(raw.createdAt) || new Date(0).toISOString() };
    const doneAt = isoOrEmpty(raw.doneAt);
    if (doneAt && (list === 'today' || list === 'done')) item.doneAt = doneAt;
    if (list === 'done' && !item.doneAt) item.doneAt = item.createdAt;
    const story = cleanStory(raw.story);
    if (story) item.story = story;
    items.push(item);
    if (items.length >= MAX_ITEMS) break;
  }
  return { v: 1, day: /^\d{4}-\d{2}-\d{2}$/.test(value.day) ? value.day : day, items };
}

/**
 * A new day: what was ticked off today moves to Done; what wasn't stays on Today.
 * Done keeps the latest DONE_KEEP.
 */
export function rollover(board, day = dayKey()) {
  if (board.day === day) return board;
  // Only what was ticked before the new day: a tick made after midnight stays on Today.
  const ticked = (item) => item.list === 'today' && item.doneAt && dayKey(new Date(item.doneAt)) < day;
  const items = board.items.map((item) => (ticked(item) ? { ...item, list: 'done' } : item));
  const done = items.filter((item) => item.list === 'done').sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  const keep = new Set(done.slice(0, DONE_KEEP).map((item) => item.id));
  return { ...board, day, items: items.filter((item) => item.list !== 'done' || keep.has(item.id)) };
}

export function addItem(board, list, text, { story = null, now = new Date() } = {}) {
  const clean = cleanText(text);
  if (!clean || !LISTS.includes(list) || list === 'done' || board.items.length >= MAX_ITEMS) return board;
  const item = { id: newId(), text: clean, list, createdAt: now.toISOString() };
  const ref = cleanStory(story);
  if (ref) item.story = ref;
  return { ...board, items: [...board.items, item] };
}

/** Move to `list`, placed before `beforeId` (or at the end of that list). */
export function moveItem(board, id, list, beforeId = null, now = new Date()) {
  const item = board.items.find((i) => i.id === id);
  if (!item || !LISTS.includes(list) || id === beforeId) return board;
  const moved = { ...item, list };
  if (list === 'done') moved.doneAt = item.doneAt || now.toISOString();
  else if (list !== 'today') delete moved.doneAt;
  const rest = board.items.filter((i) => i.id !== id);
  let at = beforeId ? rest.findIndex((i) => i.id === beforeId && i.list === list) : -1;
  if (at < 0) {
    const last = rest.findLastIndex((i) => i.list === list);
    at = last < 0 ? rest.length : last + 1;
  }
  rest.splice(at, 0, moved);
  return { ...board, items: rest };
}

/** Tick or untick a Today item. */
export function toggleDone(board, id, now = new Date()) {
  return {
    ...board,
    items: board.items.map((item) => {
      if (item.id !== id || item.list !== 'today') return item;
      if (item.doneAt) {
        const { doneAt, ...open } = item;
        return open;
      }
      return { ...item, doneAt: now.toISOString() };
    }),
  };
}

/** Rename; clearing the text deletes the item. */
export function editItem(board, id, text) {
  const clean = cleanText(text);
  if (!clean) return removeItem(board, id);
  return { ...board, items: board.items.map((item) => (item.id === id ? { ...item, text: clean } : item)) };
}

export function removeItem(board, id) {
  return { ...board, items: board.items.filter((item) => item.id !== id) };
}

export function clearDone(board) {
  return { ...board, items: board.items.filter((item) => item.list !== 'done') };
}

/** Items of one list in display order: Today shows what's ticked off first, then what's left. Done is newest first. */
export function listItems(board, list) {
  const items = board.items.filter((item) => item.list === list);
  if (list === 'today') {
    const done = items.filter((item) => item.doneAt).sort((a, b) => a.doneAt.localeCompare(b.doneAt));
    return [...done, ...items.filter((item) => !item.doneAt)];
  }
  if (list === 'done') return items.sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  return items;
}

export function openToday(board) {
  return board.items.filter((item) => item.list === 'today' && !item.doneAt).length;
}

export function doneTodayCount(board, day = board.day) {
  return board.items.filter((item) => item.doneAt && dayKey(new Date(item.doneAt)) === day).length;
}

/** Is this story already on the board (anywhere but Done)? */
export function hasStory(board, storyId) {
  return board.items.some((item) => item.story?.id === storyId && item.list !== 'done');
}
