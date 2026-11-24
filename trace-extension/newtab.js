import {
  agoLabel,
  bookmarkPayload,
  filterStories,
  insertAt,
  isCacheFresh,
  normalizeBookmarks,
  normalizeRemoteBookmarks,
  normalizeStoryPool,
  storyTopics,
} from './lib/stories.js';

const CACHE_KEY = 'trace.extension.stories.v6';
const BOOKMARKS_KEY = 'trace.extension.bookmarks.v3';
const SESSION_KEY = 'trace.extension.session.v1';
const ACCOUNT_KEY = 'trace.extension.account.v1';
const BOOKMARK_OWNER_KEY = 'trace.extension.bookmark-owner.v1';
const BOOKMARKS_SYNCED_AT_KEY = 'trace.extension.bookmarks-synced-at.v1';
// Keys from versions before 0.3 (article pool, the old five-a-day read count, checkout flag).
const OLD_KEYS = [
  'trace.extension.article-pool.v5',
  'trace.extension.summary-reads.v1',
  'trace.extension.checkout-pending.v1',
  'trace.extension.bookmarks.v2',
  'trace.extension.bookmark-migration.v1',
];
const SITE_ORIGIN = new URL(chrome.runtime.getManifest().homepage_url).origin;
const API_URL = new URL('/api/extension/stories', SITE_ORIGIN).toString();
const ACCOUNT_CACHE_TTL_MS = 5 * 60 * 1000;
const SAVED = '__saved__';

const $ = (selector) => document.querySelector(selector);
const elements = {
  topics: $('#topics'),
  accountLink: $('#account-link'),
  loading: $('#loading'),
  stories: $('#stories'),
  error: $('#error'),
  errorMessage: $('#error-message'),
  retry: $('#retry'),
  reader: $('#reader'),
  readerKicker: $('#reader-kicker'),
  readerBookmark: $('#reader-bookmark'),
  readerShare: $('#reader-share'),
  readerClose: $('#reader-close'),
  readerImage: $('#reader-image'),
  readerTitle: $('#reader-title'),
  readerMeta: $('#reader-meta'),
  readerText: $('#reader-text'),
  readerMore: $('#reader-more'),
  readerCoverage: $('#reader-coverage'),
  readerTrace: $('#reader-trace'),
  readerSource: $('#reader-source'),
};

let pool = null;
let activeCat = '';
let bookmarks = new Map();
let bookmarkQueue = Promise.resolve();
let readerStory = null;
let session = null;
let account = null;

function el(tag, className, textContent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent) node.textContent = textContent;
  return node;
}

function connectUrl() {
  const url = new URL('/extension/connect', SITE_ORIGIN);
  url.searchParams.set('extension_id', chrome.runtime.id);
  return url.toString();
}

function sessionIsValid(value) {
  return Boolean(value?.token?.startsWith('trace_ext_') && Date.parse(value.expiresAt) > Date.now());
}

function renderAccount() {
  elements.accountLink.href = account ? new URL('/feed', SITE_ORIGIN).toString() : connectUrl();
  elements.accountLink.textContent = account?.name?.split(' ')[0] || (account ? 'Account' : 'Sign in');
}

async function authorizedFetch(path, options = {}) {
  if (!sessionIsValid(session)) throw new Error('Trace sign-in is required');
  return fetch(new URL(path, SITE_ORIGIN), {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

async function loadAccount(force = false) {
  const stored = await chrome.storage.local.get([SESSION_KEY, ACCOUNT_KEY]);
  session = sessionIsValid(stored[SESSION_KEY]) ? stored[SESSION_KEY] : null;
  if (!session) {
    account = null;
    await chrome.storage.local.remove([SESSION_KEY, ACCOUNT_KEY]);
    renderAccount();
    return;
  }
  const cachedAt = Date.parse(stored[ACCOUNT_KEY]?.cachedAt || '');
  if (!force && Number.isFinite(cachedAt) && Date.now() - cachedAt < ACCOUNT_CACHE_TTL_MS) {
    account = stored[ACCOUNT_KEY].payload;
    renderAccount();
    return;
  }
  const response = await authorizedFetch('/api/extension/account');
  if (response.status === 401) {
    session = null;
    account = null;
    await chrome.storage.local.remove([SESSION_KEY, ACCOUNT_KEY]);
    renderAccount();
    return;
  }
  if (!response.ok) throw new Error(`Trace account returned ${response.status}`);
  account = await response.json();
  await chrome.storage.local.set({ [ACCOUNT_KEY]: { payload: account, cachedAt: new Date().toISOString() } });
  renderAccount();
}

// ---------- bookmarks ----------

async function syncBookmarks(force = false) {
  if (!account || !session) return;
  const stored = await chrome.storage.local.get([BOOKMARK_OWNER_KEY, BOOKMARKS_SYNCED_AT_KEY]);
  const fresh = Date.now() - Date.parse(stored[BOOKMARKS_SYNCED_AT_KEY] || '') < ACCOUNT_CACHE_TTL_MS;
  if (!force && stored[BOOKMARK_OWNER_KEY] === account.uid && fresh) return;
  const response = await authorizedFetch('/api/bookmarks?limit=100');
  if (!response.ok) throw new Error('Bookmark sync failed');
  const payload = await response.json();
  bookmarks = new Map(normalizeRemoteBookmarks(payload.bookmarks, SITE_ORIGIN).map((story) => [story.id, story]));
  await chrome.storage.local.set({
    [BOOKMARKS_KEY]: [...bookmarks.values()],
    [BOOKMARK_OWNER_KEY]: account.uid,
    [BOOKMARKS_SYNCED_AT_KEY]: new Date().toISOString(),
  });
  refreshBookmarks();
}

async function toggleBookmark(story) {
  if (!account) {
    window.open(connectUrl(), '_blank', 'noopener,noreferrer');
    return;
  }
  bookmarkQueue = bookmarkQueue.catch(() => undefined).then(async () => {
    const removing = bookmarks.has(story.id);
    const response = await authorizedFetch(
      removing ? `/api/bookmarks?item_id=${encodeURIComponent(story.id)}` : '/api/bookmarks',
      { method: removing ? 'DELETE' : 'POST', body: removing ? undefined : JSON.stringify(bookmarkPayload(story)) },
    );
    if (!response.ok) throw new Error(`Bookmark request returned ${response.status}`);
    const next = new Map(bookmarks);
    if (removing) next.delete(story.id);
    else next.set(story.id, story);
    await chrome.storage.local.set({ [BOOKMARKS_KEY]: [...next.values()], [BOOKMARK_OWNER_KEY]: account.uid });
    bookmarks = next;
  });
  try {
    await bookmarkQueue;
  } catch (error) {
    console.error('Trace could not update the bookmark', error);
  }
  refreshBookmarks();
}

function setBookmarkState(button, story) {
  const saved = bookmarks.has(story.id);
  button.setAttribute('aria-pressed', String(saved));
  button.setAttribute('aria-label', !account ? `Sign in to save ${story.title}` : saved ? `Remove ${story.title} from Saved` : `Save ${story.title}`);
}

/** After a save or a sync: the Saved tab re-renders; elsewhere only the buttons change, so focus stays put. */
function refreshBookmarks() {
  if (activeCat === SAVED) render();
  else {
    const byId = new Map([...(pool?.stories || []), ...bookmarks.values()].map((story) => [story.id, story]));
    elements.stories.querySelectorAll('.save[data-id]').forEach((button) => {
      const story = byId.get(button.dataset.id);
      if (story) setBookmarkState(button, story);
    });
    renderTopics();
  }
  updateReaderBookmark();
}

function bookmarkButton(story) {
  const button = el('button', 'save');
  button.type = 'button';
  button.dataset.id = story.id;
  setBookmarkState(button, story);
  button.append(elements.readerBookmark.querySelector('svg').cloneNode(true));
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    void toggleBookmark(story);
  });
  return button;
}

// ---------- rendering ----------

function meta(story) {
  const parts = [story.source, story.sourceCount > 1 ? `${story.sourceCount} sources` : '', agoLabel(story.ts)].filter(Boolean);
  return parts.join(' · ');
}

function image(src, className, eager = false) {
  const img = el('img', className);
  img.src = src;
  img.alt = '';
  img.loading = eager ? 'eager' : 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => img.remove());
  return img;
}

function link(href, className, text, rel = 'noopener noreferrer') {
  const a = el('a', className, text);
  a.href = href;
  a.target = '_blank';
  a.rel = rel;
  return a;
}

function storyCard(story, lead = '') {
  const card = el('article', lead ? 'card is-lead' : 'card');
  const open = el('button', 'card-open');
  open.type = 'button';
  open.setAttribute('aria-label', `Open ${story.title}`);
  open.addEventListener('click', () => openReader(story));
  card.append(open);

  const top = el('div', 'card-top');
  if (lead) {
    const kicker = el('span', 'kicker');
    kicker.append(el('span', 'kicker-star', '★'), el('mark', '', lead));
    top.append(kicker);
  } else {
    top.append(el('span', `tag tag-${story.cat}`, story.catLabel));
  }
  top.append(bookmarkButton(story));
  card.append(top);

  const text = el('div', 'card-text');
  text.append(el('h2', 'card-title', story.title));
  if (lead && story.body) text.append(el('p', 'card-body', story.body));
  text.append(el('p', 'meta', meta(story)));
  if (lead && story.coverage.length) {
    const more = el('ul', 'card-more');
    story.coverage.slice(0, 2).forEach((item) => {
      const li = el('li');
      li.append(link(item.url, '', item.title));
      if (item.source) li.append(el('span', 'more-source', ` · ${item.source}`));
      more.append(li);
    });
    text.append(more);
  }
  card.append(text);
  if (story.img) card.append(image(story.img, 'card-image', Boolean(lead)));
  return card;
}

function sponsorCard(sponsor, slotUrl) {
  const card = el('article', 'card is-ad');
  const top = el('div', 'card-top');
  top.append(el('span', 'ad-label', 'Sponsored'));
  card.append(top);
  const text = el('div', 'card-text');
  text.append(el('h2', 'card-title', sponsor.title));
  if (sponsor.sub) text.append(el('p', 'card-body', sponsor.sub));
  card.append(text);
  const go = link(sponsor.href, 'ad-button', 'Visit website ', 'noopener sponsored');
  go.append(el('span', '', '↗'));
  card.append(go);
  if (slotUrl) card.append(link(slotUrl, 'ad-slot', 'Your tool here · $19/mo'));
  return card;
}

function openSlotCard(slotUrl) {
  const card = el('article', 'card is-ad is-slot');
  const top = el('div', 'card-top');
  top.append(el('span', 'ad-label', 'Sponsor spot open'));
  card.append(top);
  const text = el('div', 'card-text');
  text.append(el('h2', 'card-title', 'Put your tool in front of people who follow tech news'));
  text.append(el('p', 'card-body', 'One card here, on the Trace site and in the daily email. $19 a month, cancel any time.'));
  card.append(text);
  card.append(link(slotUrl, 'ad-button', 'Sponsor Trace'));
  return card;
}

function houseCard() {
  const card = el('article', 'card is-ad is-house');
  const top = el('div', 'card-top');
  top.append(el('span', 'ad-label', 'From the maker of Trace'));
  card.append(top);
  const text = el('div', 'card-text');
  text.append(el('h2', 'card-title', 'StocksBrew'));
  text.append(el('p', 'card-body', 'Look up any US stock: financials, valuation, earnings, analyst targets and news. Follow up to five stocks free.'));
  card.append(text);
  const go = link('https://stocksbrew.online/?utm_source=trace&utm_medium=extension_card', 'ad-button', 'Visit website ', 'noopener');
  go.append(el('span', '', '↗'));
  card.append(go);
  return card;
}

/** Story cards with the sponsor cards placed among them (3rd, 11th, 19th spot; StocksBrew 9th). */
function withSponsorCards(cards) {
  const sponsors = pool?.sponsors || [];
  const slotUrl = pool?.sponsorUrl || '';
  const inserts = sponsors.length
    ? sponsors.map((sponsor, i) => [2 + i * 8, sponsorCard(sponsor, i === 0 ? slotUrl : '')])
    : slotUrl ? [[2, openSlotCard(slotUrl)]] : [];
  inserts.push([8, houseCard()]);
  return insertAt(cards, inserts);
}

function renderTopics() {
  const topics = pool ? storyTopics(pool.stories) : [];
  const tabs = [{ cat: '', label: 'All' }, ...topics, ...(account ? [{ cat: SAVED, label: 'Saved' }] : [])];
  elements.topics.replaceChildren(...tabs.map(({ cat, label }) => {
    const button = el('button', 'topic', label);
    button.type = 'button';
    button.dataset.cat = cat;
    button.setAttribute('aria-pressed', String(cat === activeCat));
    return button;
  }));
}

function render() {
  renderTopics();
  if (!pool) return;
  if (activeCat === SAVED) {
    const saved = [...bookmarks.values()];
    elements.stories.replaceChildren(
      ...(saved.length ? saved.map((story) => storyCard(story)) : [el('p', 'empty', 'Nothing saved yet. Use the bookmark on any story.')]),
    );
    return;
  }
  const stories = filterStories(pool.stories, activeCat);
  const label = pool.stories.find((s) => s.cat === activeCat)?.catLabel || '';
  if (!stories.length) {
    elements.stories.replaceChildren(el('p', 'empty', 'No stories in this topic today.'));
    return;
  }
  const cards = stories.map((story, i) => storyCard(story, i === 0 ? (activeCat ? `Top in ${label}` : 'Story of the day') : ''));
  elements.stories.replaceChildren(...withSponsorCards(cards));
}

function showPool(next) {
  pool = next;
  if (activeCat && activeCat !== SAVED && !pool.stories.some((s) => s.cat === activeCat)) activeCat = '';
  render();
  elements.loading.hidden = true;
  elements.error.hidden = true;
  elements.error.classList.remove('is-overlay');
  elements.stories.hidden = false;
}

// ---------- reader ----------

function updateReaderBookmark() {
  const saved = Boolean(readerStory && bookmarks.has(readerStory.id));
  elements.readerBookmark.setAttribute('aria-pressed', String(saved));
  elements.readerBookmark.setAttribute('aria-label', saved ? 'Remove from Saved' : 'Save story');
}

function openReader(story) {
  readerStory = story;
  elements.readerKicker.textContent = story.catLabel;
  elements.readerTitle.textContent = story.title;
  elements.readerMeta.textContent = meta(story);
  elements.readerText.replaceChildren(...story.detail.map((part) => el('p', '', part)));
  elements.readerCoverage.replaceChildren(...story.coverage.map((item) => {
    const li = el('li');
    const a = el('a', '', item.title);
    a.href = item.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    li.append(a);
    if (item.source) li.append(el('span', 'more-source', ` · ${item.source}`));
    return li;
  }));
  elements.readerMore.hidden = story.coverage.length === 0;
  elements.readerTrace.href = story.traceUrl || story.url;
  elements.readerTrace.hidden = !story.traceUrl;
  elements.readerSource.href = story.url;
  elements.readerSource.textContent = story.source ? `Read ${story.source} ` : 'Read the source ';
  elements.readerSource.append(el('span', '', '↗'));
  elements.readerShare.setAttribute('aria-label', 'Copy story link');
  if (story.img) {
    elements.readerImage.src = story.img;
    elements.readerImage.hidden = false;
  } else {
    elements.readerImage.removeAttribute('src');
    elements.readerImage.hidden = true;
  }
  updateReaderBookmark();
  elements.reader.showModal();
}

// ---------- loading ----------

async function fetchPool() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(API_URL, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`Trace returned ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadStories() {
  elements.error.hidden = true;
  try {
    const payload = await fetchPool();
    const next = normalizeStoryPool(payload);
    try {
      await chrome.storage.local.set({ [CACHE_KEY]: { payload, cachedAt: new Date().toISOString() } });
    } catch (error) {
      console.warn('Trace could not cache the stories', error);
    }
    showPool(next);
  } catch (error) {
    if (!pool) {
      elements.loading.hidden = true;
      elements.stories.hidden = true;
    }
    elements.errorMessage.textContent = pool ? 'Could not refresh.' : 'Could not load stories.';
    elements.error.classList.toggle('is-overlay', Boolean(pool));
    elements.error.hidden = false;
    console.error('Trace extension refresh failed', error);
  }
}

async function start() {
  renderAccount();
  void chrome.storage.local.remove(OLD_KEYS).catch(() => undefined);
  const stored = await chrome.storage.local.get([CACHE_KEY, BOOKMARKS_KEY]);
  bookmarks = new Map(normalizeBookmarks(stored[BOOKMARKS_KEY]).map((story) => [story.id, story]));
  // Coming from 0.2 the bookmark key is new: forget the last sync time so Saved fills now.
  if (!stored[BOOKMARKS_KEY]) await chrome.storage.local.remove(BOOKMARKS_SYNCED_AT_KEY).catch(() => undefined);
  try {
    await loadAccount();
    if (!account && bookmarks.size) {
      bookmarks = new Map();
      await chrome.storage.local.remove([BOOKMARKS_KEY, BOOKMARK_OWNER_KEY]);
    }
  } catch (error) {
    console.warn('Trace account refresh failed', error);
  }

  const cached = stored[CACHE_KEY];
  if (cached?.payload) {
    try {
      showPool(normalizeStoryPool(cached.payload));
      if (isCacheFresh(cached.cachedAt) || !navigator.onLine) {
        try { await syncBookmarks(); } catch (error) { console.warn('Trace bookmark sync failed', error); }
        return;
      }
    } catch {
      await chrome.storage.local.remove(CACHE_KEY);
    }
  }
  await loadStories();
  try { await syncBookmarks(); } catch (error) { console.warn('Trace bookmark sync failed', error); }
}

elements.retry.addEventListener('click', loadStories);
elements.topics.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  activeCat = button.dataset.cat;
  render();
  window.scrollTo({ top: 0 });
});
elements.readerClose.addEventListener('click', () => elements.reader.close());
elements.readerBookmark.addEventListener('click', () => {
  if (readerStory) void toggleBookmark(readerStory);
});
elements.readerShare.addEventListener('click', async () => {
  if (!readerStory) return;
  try {
    await navigator.clipboard.writeText(readerStory.traceUrl || readerStory.url);
    elements.readerShare.setAttribute('aria-label', 'Link copied');
    elements.readerShare.classList.add('is-done');
    window.setTimeout(() => elements.readerShare.classList.remove('is-done'), 1400);
  } catch (error) {
    console.error('Trace could not copy the story link', error);
  }
});
elements.readerImage.addEventListener('error', () => {
  elements.readerImage.removeAttribute('src');
  elements.readerImage.hidden = true;
});
elements.reader.addEventListener('click', (event) => {
  if (event.target === elements.reader) elements.reader.close();
});
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'TRACE_SESSION_UPDATED') return;
  void loadAccount(true).then(() => syncBookmarks(true)).then(render).catch((error) => {
    console.error('Trace could not finish account connection', error);
  });
});

start().catch((error) => {
  elements.loading.hidden = true;
  elements.stories.hidden = true;
  elements.errorMessage.textContent = 'Could not load stories.';
  elements.error.hidden = false;
  console.error('Trace extension startup failed', error);
});
