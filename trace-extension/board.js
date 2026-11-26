// The owner's day board ("Today"): big checklist, Ideas / Later / Done, and today's
// Trace stories in a rail. Loaded by newtab.js only in unpacked installs; the store
// package leaves this file, lib/board.js and board.css out.
import {
  addItem, clearDone, dayKey, doneTodayCount, editItem, hasStory, listItems,
  moveItem, normalizeBoard, openToday, removeItem, rollover, toggleDone,
} from './lib/board.js';

const BOARD_KEY = 'trace.board.v1';
const RAIL_SIZE = 10;
const MINIS = [['ideas', 'Ideas'], ['later', 'Later'], ['done', 'Done']];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(className, text, label) {
  const b = el('button', className, text);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  return b;
}

/** Same key order whatever the source, so our own writes are recognised when they echo back. */
const snapshot = (value) => JSON.stringify(normalizeBoard(value));

/**
 * @param {{ openReader: (story: object) => void, agoLabel: (ts: number) => string,
 *   retry: () => void, view: 'today' | 'news', saveView: (view: string) => void }} api
 */
export function mountBoard(api) {
  let board = normalizeBoard(null);
  let stories = [];
  let storiesFailed = false;
  let lastSaved = '';
  let editing = false;
  let boardChangedElsewhere = false;
  let dragId = null;
  let view = api.view;

  // ---------- skeleton ----------
  document.body.classList.add('has-board');
  const topbar = document.querySelector('.topbar');
  const tools = el('div', 'board-tools');
  const count = el('span', 'board-count');
  const seg = el('div', 'seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'View');
  const segToday = button('', 'Today');
  const segNews = button('', 'News');
  segToday.dataset.view = 'today';
  segNews.dataset.view = 'news';
  seg.append(segToday, segNews);
  tools.append(count, seg);
  topbar.append(tools);

  const root = el('section', 'today');
  root.id = 'board';
  root.setAttribute('aria-label', 'Today');
  const main = el('div', 'today-main');
  const dayTitle = el('h1', 'today-day');
  const daySub = el('p', 'today-sub');
  const bigList = el('ul', 'big-list');
  bigList.dataset.list = 'today';
  const bigAdd = addForm('today', 'big-add', '+ Something else', 'Add to today');
  const minis = el('div', 'minis');
  const miniLists = {};
  for (const [list, label] of MINIS) {
    const box = el('div', 'mini');
    const head = el('div', 'mini-head');
    head.append(el('h2', '', label));
    if (list === 'done') {
      const clear = button('mini-clear', 'Clear', 'Clear the Done list');
      clear.addEventListener('click', () => commit(clearDone(board)));
      head.append(clear);
      miniLists.clear = clear;
    }
    const ul = el('ul', 'mini-list');
    ul.dataset.list = list;
    miniLists[list] = ul;
    box.append(head, ul);
    if (list !== 'done') box.append(addForm(list, 'mini-add', '+ Add', `Add to ${label}`));
    minis.append(box);
  }
  main.append(dayTitle, daySub, bigList, bigAdd, minis);

  const rail = el('aside', 'today-rail');
  const railHead = el('div', 'rail-head');
  const railAll = button('rail-all', 'All stories →');
  railAll.addEventListener('click', () => setView('news'));
  railHead.append(el('h2', '', 'Today on Trace'), railAll);
  const railList = el('ol', 'rail-list');
  rail.append(railHead, railList);
  root.append(main, rail);
  topbar.after(root);

  function addForm(list, className, placeholder, label) {
    const form = el('form', className);
    const input = el('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.maxLength = 300;
    input.setAttribute('aria-label', label);
    input.autocomplete = 'off';
    form.append(input);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!input.value.trim()) return;
      const next = addItem(board, list, input.value);
      if (next === board) return; // board is full: keep the text
      commit(next);
      input.value = '';
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { input.value = ''; input.blur(); }
    });
    // Enter that confirms an input-method composition must not submit half a word.
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.isComposing) event.stopPropagation();
    }, true);
    return form;
  }

  // ---------- state ----------
  async function load() {
    try {
      const stored = await chrome.storage.local.get(BOARD_KEY);
      board = normalizeBoard(stored[BOARD_KEY]);
      lastSaved = snapshot(board);
    } catch (error) {
      console.error('Trace board could not load', error);
    }
    turnover();
    render();
  }

  function commit(next) {
    if (next === board) return;
    board = next;
    render();
    lastSaved = snapshot(board);
    chrome.storage.local.set({ [BOARD_KEY]: board }).catch((error) => console.error('Trace board could not save', error));
  }

  /** Midnight passed (tab left open, or first open of the day). */
  function turnover() {
    const next = rollover(board);
    if (next !== board) commit(next);
  }
  let shownDay = dayKey();
  window.setInterval(() => {
    if (dayKey() === shownDay || editing) return;
    turnover();
    render();
  }, 60_000);

  // Every open new tab shows the same board: take edits made in other tabs.
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area !== 'local' || !changes[BOARD_KEY]) return;
    const raw = snapshot(changes[BOARD_KEY].newValue);
    if (raw === lastSaved) return;
    board = normalizeBoard(changes[BOARD_KEY].newValue);
    lastSaved = raw;
    if (editing) boardChangedElsewhere = true; // rendered when the edit ends
    else render();
  });

  // ---------- rendering ----------
  /** Which control has focus, so a rebuild can put it back (or on its row). */
  function focusKey() {
    const active = document.activeElement;
    if (!active || active === document.body || !root.contains(active)) return null;
    const row = active.closest('li[data-id], li[data-story]');
    if (!row) return null;
    return { id: row.dataset.id, story: row.dataset.story, cls: active.classList[0] };
  }

  function restoreFocus(key) {
    if (!key) return;
    const row = key.id ? root.querySelector(`li[data-id="${CSS.escape(key.id)}"]`) : root.querySelector(`li[data-story="${CSS.escape(key.story)}"]`);
    const target = row && (row.querySelector(`.${CSS.escape(key.cls || 'txt')}:not([disabled])`) || row.querySelector('.txt, .rail-open'));
    (target || bigAdd.querySelector('input')).focus({ preventScroll: true });
  }

  function render() {
    const key = focusKey();
    const now = new Date();
    shownDay = dayKey(now);
    dayTitle.textContent = `${now.toLocaleDateString(undefined, { weekday: 'long' })}.`;
    const left = openToday(board);
    daySub.textContent = `${now.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })} · ${left ? `${left} left` : 'nothing left'}`;
    const done = doneTodayCount(board, dayKey(now));
    count.textContent = done ? `${done} done today` : '';

    const today = listItems(board, 'today');
    const firstOpen = today.find((item) => !item.doneAt);
    bigList.replaceChildren(...today.map((item) => bigItem(item, item === firstOpen)));
    if (!today.length) bigList.append(el('li', 'big-empty', 'Nothing on today yet. What comes first?'));
    for (const [list] of MINIS) {
      const items = listItems(board, list);
      miniLists[list].replaceChildren(...items.map((item) => miniItem(item)));
      if (!items.length) miniLists[list].append(el('li', 'mini-empty', list === 'done' ? 'Ticked items land here tomorrow.' : 'Empty'));
    }
    miniLists.clear.hidden = !listItems(board, 'done').length;
    renderRail();
    restoreFocus(key);
  }

  function storyLink(item) {
    if (!item.story) return null;
    const link = button('story-link', item.story.source || 'Trace', `Open the story: ${item.text}`);
    link.addEventListener('click', (event) => {
      event.stopPropagation();
      const story = stories.find((s) => s.id === item.story.id);
      if (story) api.openReader(story);
      else window.open(item.story.traceUrl || item.story.url, '_blank', 'noopener,noreferrer');
    });
    return link;
  }

  function editable(span, item) {
    span.tabIndex = 0;
    span.setAttribute('role', 'button');
    span.setAttribute('aria-label', `Edit: ${item.text}`);
    const start = () => {
      if (span.isContentEditable) return;
      editing = true;
      const row = span.closest('li');
      row.draggable = false;
      span.removeAttribute('role');
      span.contentEditable = 'plaintext-only';
      span.focus();
      const range = document.createRange();
      range.selectNodeContents(span);
      range.collapse(false);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    };
    // Ending an edit must not rebuild the lists: the click that moved focus away
    // (a tick, ×, another line) would land on a button that no longer exists.
    const finish = (save) => {
      if (!span.isContentEditable) return;
      span.contentEditable = 'false';
      span.setAttribute('role', 'button');
      span.closest('li').draggable = true;
      editing = false;
      const next = save ? editItem(board, item.id, span.textContent) : board;
      const current = board.items.find((i) => i.id === item.id);
      const changed = next.items.find((i) => i.id === item.id);
      if (!changed) { commit(next); return; } // text cleared: the item is gone
      if (current && changed.text !== current.text) {
        board = next;
        lastSaved = snapshot(board);
        chrome.storage.local.set({ [BOARD_KEY]: board }).catch((error) => console.error('Trace board could not save', error));
        item.text = changed.text;
        span.setAttribute('aria-label', `Edit: ${changed.text}`);
      }
      span.textContent = (current && changed.text) || item.text;
      if (lastSaved !== snapshot(board) || boardChangedElsewhere) { boardChangedElsewhere = false; render(); }
    };
    span.addEventListener('click', start);
    span.addEventListener('keydown', (event) => {
      if (!span.isContentEditable) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); start(); }
        return;
      }
      if (event.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); span.blur(); }
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
    });
    span.addEventListener('blur', () => finish(true));
  }

  function draggableRow(li, item) {
    li.draggable = true;
    li.dataset.id = item.id;
    li.addEventListener('dragstart', (event) => {
      dragId = item.id;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.text);
      requestAnimationFrame(() => li.classList.add('is-dragging'));
    });
    li.addEventListener('dragend', () => {
      dragId = null;
      li.classList.remove('is-dragging');
      clearMarks();
    });
  }

  function bigItem(item, isNow) {
    const li = el('li', `big-item${item.doneAt ? ' is-done' : ''}${isNow ? ' is-now' : ''}`);
    const check = button('check', '', `Done: ${item.text}`);
    check.setAttribute('aria-pressed', String(Boolean(item.doneAt)));
    check.addEventListener('click', () => commit(toggleDone(board, item.id)));
    const text = el('span', 'txt', item.text);
    editable(text, item);
    li.append(check, text);
    const link = storyLink(item);
    if (link) li.append(link);
    if (item.doneAt) {
      const at = new Date(item.doneAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      li.append(el('span', 'when', `done ${at}`));
    }
    const acts = el('span', 'acts');
    if (!item.doneAt) {
      const later = button('act', 'Later', `Move to Later: ${item.text}`);
      later.addEventListener('click', () => commit(moveItem(board, item.id, 'later')));
      acts.append(later);
    }
    const del = button('act act-del', '×', `Delete: ${item.text}`);
    del.addEventListener('click', () => commit(removeItem(board, item.id)));
    acts.append(del);
    li.append(acts);
    draggableRow(li, item);
    return li;
  }

  function miniItem(item) {
    const li = el('li', `mini-item${item.list === 'done' ? ' is-done' : ''}`);
    const text = el('span', 'txt', item.text);
    if (item.list !== 'done') editable(text, item);
    li.append(text);
    const link = storyLink(item);
    if (link) li.append(link);
    const acts = el('span', 'acts');
    if (item.list !== 'done') {
      const toToday = button('act', 'Today', `Move to Today: ${item.text}`);
      toToday.addEventListener('click', () => commit(moveItem(board, item.id, 'today')));
      acts.append(toToday);
    }
    const del = button('act act-del', '×', `Delete: ${item.text}`);
    del.addEventListener('click', () => commit(removeItem(board, item.id)));
    acts.append(del);
    li.append(acts);
    if (item.list !== 'done') draggableRow(li, item);
    return li;
  }

  function renderRail() {
    if (!stories.length) {
      const li = el('li', 'rail-empty', storiesFailed ? 'Could not load stories. ' : 'Loading stories…');
      if (storiesFailed) {
        const retry = button('rail-retry', 'Try again');
        retry.addEventListener('click', () => { storiesFailed = false; renderRail(); api.retry(); });
        li.append(retry);
      }
      railList.replaceChildren(li);
      return;
    }
    railAll.textContent = `All ${stories.length} →`;
    railList.replaceChildren(...stories.slice(0, RAIL_SIZE).map((story) => {
      const li = el('li', 'rail-item');
      li.dataset.story = story.id;
      const open = button('rail-open');
      open.addEventListener('click', () => api.openReader(story));
      open.append(el('h3', '', story.title));
      const meta = el('span', 'rail-meta');
      meta.append(el('span', `tag tag-${story.cat}`, story.catLabel), el('span', 'meta', [story.source, api.agoLabel(story.ts)].filter(Boolean).join(' · ')));
      open.append(meta);
      const on = hasStory(board, story.id);
      const add = button(`rail-add${on ? ' is-on' : ''}`, on ? '✓' : '+', on ? `On your list: ${story.title}` : `Add to Today: ${story.title}`);
      add.disabled = on;
      add.addEventListener('click', () => commit(addItem(board, 'today', story.title, {
        story: { id: story.id, url: story.url, traceUrl: story.traceUrl, source: story.source },
      })));
      li.append(open, add);
      return li;
    }));
  }

  // ---------- drag and drop between Today, Ideas and Later ----------
  const mark = el('li', 'drop-mark');
  function clearMarks() { mark.remove(); }
  function rowAfter(ul, y) {
    const rows = [...ul.querySelectorAll(':scope > li[data-id]:not(.is-dragging)')];
    return rows.find((row) => {
      const box = row.getBoundingClientRect();
      return y < box.top + box.height / 2;
    }) || null;
  }
  for (const ul of [bigList, miniLists.ideas, miniLists.later]) {
    ul.addEventListener('dragover', (event) => {
      if (!dragId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const before = rowAfter(ul, event.clientY);
      if (before) ul.insertBefore(mark, before);
      else ul.append(mark);
    });
    ul.addEventListener('dragleave', (event) => {
      if (!ul.contains(event.relatedTarget)) clearMarks();
    });
    ul.addEventListener('drop', (event) => {
      if (!dragId) return;
      event.preventDefault();
      const before = rowAfter(ul, event.clientY);
      const id = dragId;
      dragId = null;
      clearMarks();
      commit(moveItem(board, id, ul.dataset.list, before?.dataset.id || null));
    });
  }

  // ---------- view switch ----------
  function setView(next) {
    view = next;
    api.saveView(view);
    document.documentElement.dataset.view = view;
    segToday.setAttribute('aria-pressed', String(view === 'today'));
    segNews.setAttribute('aria-pressed', String(view === 'news'));
    window.scrollTo({ top: 0 });
  }
  seg.addEventListener('click', (event) => {
    const b = event.target.closest('button[data-view]');
    if (b) setView(b.dataset.view);
  });

  // "n" starts a new line on Today, wherever focus is not already typing.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey || view !== 'today') return;
    const t = event.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t?.isContentEditable) return;
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault();
    bigAdd.querySelector('input').focus();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    turnover();
    if (!editing) render();
  });

  setView(view);
  void load();

  return {
    setStories(next) {
      stories = Array.isArray(next) ? next : [];
      storiesFailed = false;
      if (!editing) renderRail();
    },
    /** The first load failed and there is nothing cached. */
    storiesFailed() {
      storiesFailed = true;
      if (!stories.length) renderRail();
    },
  };
}
