import {
  addSummaryRead,
  canOpenSummary,
  filterArticlesByTag,
  isCacheFresh,
  normalizeArticlePool,
  normalizeBookmarks,
  normalizeRemoteBookmarks,
  normalizeSummaryReads,
  selectRandomArticles,
} from './lib/brief.js';
import { captureExtensionDailyActive, captureExtensionEvent } from './lib/analytics.js';

const CACHE_KEY = 'trace.extension.article-pool.v5';
const READS_KEY = 'trace.extension.summary-reads.v1';
const BOOKMARKS_KEY = 'trace.extension.bookmarks.v2';
const SESSION_KEY = 'trace.extension.session.v1';
const ACCOUNT_KEY = 'trace.extension.account.v1';
const BOOKMARK_MIGRATION_KEY = 'trace.extension.bookmark-migration.v1';
const BOOKMARK_OWNER_KEY = 'trace.extension.bookmark-owner.v1';
const BOOKMARKS_SYNCED_AT_KEY = 'trace.extension.bookmarks-synced-at.v1';
const CHECKOUT_PENDING_KEY = 'trace.extension.checkout-pending.v1';
const SITE_ORIGIN = chrome.runtime.getManifest().homepage_url;
const API_URL = new URL('/api/extension/brief', SITE_ORIGIN).toString();
const ACCOUNT_CACHE_TTL_MS = 5 * 60 * 1000;
const STORIES_PER_TAB = 31;
const SAVED_FILTER = '__saved__';

const elements = {
  filters: document.querySelector('#filters'),
  accountLink: document.querySelector('#account-link'),
  feedbackCard: document.querySelector('#feedback-card'),
  loading: document.querySelector('#loading'),
  articles: document.querySelector('#articles'),
  error: document.querySelector('#error'),
  errorMessage: document.querySelector('#error-message'),
  retry: document.querySelector('#retry'),
  reader: document.querySelector('#reader'),
  readerBookmark: document.querySelector('#reader-bookmark'),
  readerClose: document.querySelector('#reader-close'),
  readerImage: document.querySelector('#reader-image'),
  readerSource: document.querySelector('#reader-source'),
  readerTitle: document.querySelector('#reader-title'),
  readerBody: document.querySelector('#reader-body'),
  readerTakeaways: document.querySelector('#reader-takeaways'),
  readerLink: document.querySelector('#reader-link'),
  readerShare: document.querySelector('#reader-share'),
};

let currentPool = null;
let currentArticles = [];
let activeTag = '';
let summaryReads = normalizeSummaryReads(null);
let summaryReadQueue = Promise.resolve();
let bookmarkedArticles = new Map();
let bookmarkWriteQueue = Promise.resolve();
let readerArticle = null;
let extensionSession = null;
let account = null;

function connectUrl(intent = '') {
  const url = new URL('/extension/connect', SITE_ORIGIN);
  url.searchParams.set('extension_id', chrome.runtime.id);
  if (intent) url.searchParams.set('intent', intent);
  return url.toString();
}

function sessionIsValid(session) {
  return Boolean(session?.token?.startsWith('trace_ext_') && Date.parse(session.expiresAt) > Date.now());
}

function accountCacheIsFresh(value) {
  const timestamp = Date.parse(value?.cachedAt || '');
  return Number.isFinite(timestamp) && Date.now() - timestamp < ACCOUNT_CACHE_TTL_MS;
}

function renderAccount() {
  elements.accountLink.href = account ? new URL('/profile', SITE_ORIGIN).toString() : connectUrl();
  elements.accountLink.textContent = account?.hasAccess ? 'Pro' : account?.name?.split(' ')[0] || 'Sign in';
  elements.accountLink.classList.toggle('is-pro', Boolean(account?.hasAccess));
}

async function authorizedFetch(path, options = {}) {
  if (!sessionIsValid(extensionSession)) throw new Error('Trace sign-in is required');
  return fetch(new URL(path, SITE_ORIGIN), {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${extensionSession.token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
}

async function loadAccount(force = false) {
  const stored = await chrome.storage.local.get([SESSION_KEY, ACCOUNT_KEY]);
  extensionSession = sessionIsValid(stored[SESSION_KEY]) ? stored[SESSION_KEY] : null;
  if (!extensionSession) {
    account = null;
    await chrome.storage.local.remove([SESSION_KEY, ACCOUNT_KEY]);
    renderAccount();
    return;
  }
  if (!force && accountCacheIsFresh(stored[ACCOUNT_KEY])) {
    account = stored[ACCOUNT_KEY].payload;
    renderAccount();
    return;
  }
  const response = await authorizedFetch('/api/extension/account');
  if (response.status === 401) {
    extensionSession = null;
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

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function showLoading() {
  elements.loading.replaceChildren();
  for (let index = 0; index < STORIES_PER_TAB; index += 1) {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton';
    elements.loading.append(skeleton);
  }
  elements.loading.hidden = false;
  elements.articles.hidden = true;
  elements.error.hidden = true;
  elements.error.classList.remove('is-overlay');
}

function renderReaderContent(article) {
  elements.readerBody.replaceChildren();
  let list = null;

  article.content.forEach((block) => {
    if (block.type === 'list_item') {
      if (!list) {
        list = document.createElement('ul');
        elements.readerBody.append(list);
      }
      const item = document.createElement('li');
      item.textContent = block.text;
      list.append(item);
      return;
    }

    list = null;
    const node = document.createElement(block.type === 'heading' ? 'h2' : 'p');
    node.textContent = block.text;
    elements.readerBody.append(node);
  });

  if (!article.content.length && article.summary) {
    const summary = document.createElement('p');
    summary.textContent = article.summary;
    elements.readerBody.append(summary);
  }
}

function renderReadLimit() {
  elements.readerBody.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'reader-paywall';
  const title = document.createElement('h2');
  title.textContent = 'You have used today’s three free summaries.';
  const description = document.createElement('p');
  description.textContent = account
    ? 'Try Trace Pro free for 3 days to keep reading. Original publisher links always stay open.'
    : 'Sign in with Google to sync your access and saved stories. Original publisher links always stay open.';
  const action = document.createElement('a');
  action.href = account
    ? new URL('/profile?tab=subscription&intent=checkout', SITE_ORIGIN).toString()
    : connectUrl('checkout');
  action.target = '_blank';
  action.rel = 'noopener noreferrer';
  action.textContent = account ? 'Try Pro free for 3 days' : 'Continue with Google';
  action.addEventListener('click', () => {
    void chrome.storage.local.set({ [CHECKOUT_PENDING_KEY]: true });
    void captureExtensionEvent(account ? 'extension_checkout_clicked' : 'extension_sign_in_clicked');
  });
  panel.append(title, description, action);
  elements.readerBody.append(panel);
}

function renderStorageError() {
  elements.readerBody.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'reader-paywall';
  const title = document.createElement('h2');
  title.textContent = 'Trace could not save your reading progress.';
  const description = document.createElement('p');
  description.textContent = 'Check Chrome storage access, then reopen this story.';
  panel.append(title, description);
  elements.readerBody.append(panel);
}

function updateReaderBookmark() {
  const active = Boolean(readerArticle && bookmarkedArticles.has(readerArticle.id));
  elements.readerBookmark.setAttribute('aria-pressed', String(active));
  elements.readerBookmark.setAttribute('aria-label', active ? 'Remove bookmark' : 'Bookmark story');
}

async function openReader(article) {
  elements.readerSource.textContent = [article.source, formatDate(article.publishedAt)].filter(Boolean).join(' · ');
  elements.readerTitle.textContent = article.title;
  elements.readerLink.href = article.sourceUrl;
  readerArticle = article;
  elements.readerShare.setAttribute('aria-label', 'Copy story link');
  updateReaderBookmark();

  if (article.thumbnail) {
    elements.readerImage.src = article.thumbnail;
    elements.readerImage.hidden = false;
  } else {
    elements.readerImage.removeAttribute('src');
    elements.readerImage.hidden = true;
  }

  let access = 'denied';
  summaryReadQueue = summaryReadQueue.catch(() => undefined).then(async () => {
    if (!canOpenSummary(summaryReads, article.id, Boolean(account?.hasAccess))) return 'denied';
    if (account?.hasAccess) return 'allowed';
    const nextSummaryReads = addSummaryRead(summaryReads, article.id);
    await chrome.storage.local.set({ [READS_KEY]: nextSummaryReads });
    summaryReads = nextSummaryReads;
    return 'allowed';
  });
  try {
    access = await summaryReadQueue;
  } catch (error) {
      console.error('Trace could not save reading progress', error);
      renderStorageError();
      elements.readerTakeaways.replaceChildren();
      elements.readerTakeaways.hidden = true;
      elements.reader.showModal();
      return;
  }

  if (access === 'allowed') {
    renderReaderContent(article);
    elements.readerTakeaways.replaceChildren();
    article.keyTakeaways.forEach((takeaway) => {
      const item = document.createElement('li');
      item.textContent = takeaway;
      elements.readerTakeaways.append(item);
    });
    elements.readerTakeaways.hidden = article.keyTakeaways.length === 0;
  } else {
    renderReadLimit();
    elements.readerTakeaways.replaceChildren();
    elements.readerTakeaways.hidden = true;
  }
  elements.reader.showModal();
}

function bookmarkIcon() {
  return elements.readerBookmark.querySelector('svg').cloneNode(true);
}

function bookmarkPayload(article) {
  return {
    item_id: article.id,
    item_metadata: {
      type: 'article',
      title: article.title,
      description: article.content.map(({ text }) => text).join('\n\n'),
      url: article.sourceUrl,
      thumbnail: article.thumbnail || null,
      tags: [article.tag],
      source: article.source,
      timestamp: article.publishedAt,
    },
  };
}

async function syncBookmarks(force = false) {
  if (!account || !extensionSession) return;
  const migration = await chrome.storage.local.get([BOOKMARK_MIGRATION_KEY, BOOKMARK_OWNER_KEY, BOOKMARKS_SYNCED_AT_KEY]);
  if (
    !force
    && migration[BOOKMARK_OWNER_KEY] === account.uid
    && Date.now() - Date.parse(migration[BOOKMARKS_SYNCED_AT_KEY] || '') < ACCOUNT_CACHE_TTL_MS
  ) return;
  if (migration[BOOKMARK_OWNER_KEY] && migration[BOOKMARK_OWNER_KEY] !== account.uid) {
    bookmarkedArticles = new Map();
    await chrome.storage.local.remove(BOOKMARKS_KEY);
  }
  if (migration[BOOKMARK_MIGRATION_KEY] !== account.uid && bookmarkedArticles.size) {
    await Promise.all([...bookmarkedArticles.values()].map((article) => authorizedFetch('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify(bookmarkPayload(article)),
    }).then((response) => {
      if (!response.ok) throw new Error('Bookmark migration failed');
    })));
    await chrome.storage.local.set({ [BOOKMARK_MIGRATION_KEY]: account.uid });
  }
  const response = await authorizedFetch('/api/bookmarks?limit=100');
  if (!response.ok) throw new Error('Bookmark sync failed');
  const payload = await response.json();
  bookmarkedArticles = new Map(normalizeRemoteBookmarks(payload.bookmarks).map((article) => [article.id, article]));
  await chrome.storage.local.set({
    [BOOKMARKS_KEY]: [...bookmarkedArticles.values()],
    [BOOKMARK_OWNER_KEY]: account.uid,
    [BOOKMARK_MIGRATION_KEY]: account.uid,
    [BOOKMARKS_SYNCED_AT_KEY]: new Date().toISOString(),
  });
  renderFilters();
  renderArticles();
  updateReaderBookmark();
}

async function toggleBookmark(article) {
  if (!account) {
    window.open(connectUrl(), '_blank', 'noopener,noreferrer');
    return;
  }
  bookmarkWriteQueue = bookmarkWriteQueue.catch(() => undefined).then(async () => {
    const removing = bookmarkedArticles.has(article.id);
    const response = await authorizedFetch(removing ? `/api/bookmarks?item_id=${encodeURIComponent(article.id)}` : '/api/bookmarks', {
      method: removing ? 'DELETE' : 'POST',
      body: removing ? undefined : JSON.stringify(bookmarkPayload(article)),
    });
    if (!response.ok) throw new Error(`Bookmark request returned ${response.status}`);
    const next = new Map(bookmarkedArticles);
    if (next.has(article.id)) next.delete(article.id);
    else next.set(article.id, article);
    await chrome.storage.local.set({
      [BOOKMARKS_KEY]: [...next.values()],
      [BOOKMARK_OWNER_KEY]: account.uid,
      [BOOKMARKS_SYNCED_AT_KEY]: new Date().toISOString(),
    });
    bookmarkedArticles = next;
    void captureExtensionEvent('extension_story_bookmarked', {
      story_id: article.id,
      tag: article.tag,
      action: removing ? 'removed' : 'saved',
    });
  });
  try {
    await bookmarkWriteQueue;
  } catch (error) {
    console.error('Trace could not update the bookmark', error);
  }
  renderFilters();
  renderArticles();
  updateReaderBookmark();
}

function createArticleCard(article) {
  const card = document.createElement('article');
  card.className = 'article-card';

  const bookmark = document.createElement('button');
  bookmark.className = 'card-bookmark';
  bookmark.type = 'button';
  bookmark.setAttribute('aria-label', !account ? `Sign in to bookmark ${article.title}` : bookmarkedArticles.has(article.id) ? `Remove bookmark for ${article.title}` : `Bookmark ${article.title}`);
  bookmark.setAttribute('aria-pressed', String(bookmarkedArticles.has(article.id)));
  bookmark.append(bookmarkIcon());
  bookmark.addEventListener('click', () => void toggleBookmark(article));
  card.append(bookmark);

  const open = document.createElement('button');
  open.className = 'article-open';
  open.type = 'button';
  open.addEventListener('click', () => {
    void captureExtensionEvent('extension_story_opened', {
      story_id: article.id,
      tag: article.tag,
      has_pro: Boolean(account?.hasAccess),
    });
    void openReader(article);
  });

  if (article.thumbnail) {
    const image = document.createElement('img');
    image.src = article.thumbnail;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => image.remove());
    open.append(image);
  }

  const content = document.createElement('span');
  content.className = 'article-content';

  const tag = document.createElement('span');
  tag.className = 'story-tag';
  tag.textContent = article.tag;
  content.append(tag);

  const title = document.createElement('span');
  title.className = 'article-title';
  title.textContent = article.title;
  content.append(title);
  open.append(content);
  card.append(open);
  return card;
}

function renderArticles() {
  const selected = activeTag === SAVED_FILTER
    ? [...bookmarkedArticles.values()]
    : filterArticlesByTag(currentArticles, activeTag).slice(0, STORIES_PER_TAB);
  elements.articles.replaceChildren(
    ...selected.map(createArticleCard),
    elements.feedbackCard.content.cloneNode(true),
  );
}

function renderFilters() {
  const tags = [...new Set(currentArticles.map(({ tag }) => tag))].sort();
  elements.filters.replaceChildren(...['', ...tags, ...(account ? [SAVED_FILTER] : [])].map((tag) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tag = tag;
    button.textContent = tag === SAVED_FILTER ? 'Saved' : tag ? tag.replace(/\b(ai|ux)\b|^\w/g, (word) => word.toUpperCase()) : 'All';
    button.setAttribute('aria-pressed', String(tag === activeTag));
    return button;
  }));
}

function renderPool(pool) {
  currentPool = pool;
  currentArticles = selectRandomArticles(pool.articles, pool.articles.length);
  activeTag = '';
  renderFilters();
  renderArticles();
  elements.loading.hidden = true;
  elements.error.hidden = true;
  elements.error.classList.remove('is-overlay');
  elements.articles.hidden = false;
}

async function fetchPool() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(API_URL, {
      cache: 'default',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Trace returned ${response.status}`);
    return {
      payload: await response.json(),
      cachedAt: new Date().toISOString(),
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadArticles({ silent = false } = {}) {
  elements.error.hidden = true;

  try {
    const fresh = await fetchPool();
    const pool = normalizeArticlePool(fresh.payload);
    try {
      await chrome.storage.local.set({ [CACHE_KEY]: fresh });
    } catch (error) {
      console.warn('Trace could not cache the article pool', error);
    }
    renderPool(pool);
  } catch (error) {
    if (silent && currentPool) {
      console.warn('Trace extension background refresh failed', error);
      return;
    }
    if (!currentPool) {
      elements.loading.hidden = true;
      elements.articles.hidden = true;
    }
    elements.errorMessage.textContent = currentPool ? 'Could not refresh.' : 'Could not load articles.';
    elements.error.classList.toggle('is-overlay', Boolean(currentPool));
    elements.error.hidden = false;
    console.error('Trace extension refresh failed', error);
  }
}

async function start() {
  renderAccount();
  const stored = await chrome.storage.local.get([CACHE_KEY, READS_KEY, BOOKMARKS_KEY, BOOKMARK_OWNER_KEY]);
  const cached = stored[CACHE_KEY];
  summaryReads = normalizeSummaryReads(stored[READS_KEY]);
  try {
    bookmarkedArticles = new Map(normalizeBookmarks(stored[BOOKMARKS_KEY]).map((article) => [article.id, article]));
  } catch (error) {
    bookmarkedArticles = new Map();
    console.error('Trace ignored invalid bookmark data', error);
  }

  let cachedPool = null;
  if (cached?.payload) {
    try {
      cachedPool = normalizeArticlePool(cached.payload);
      renderPool(cachedPool);
    } catch {
      await chrome.storage.local.remove(CACHE_KEY);
    }
  }
  if (!cachedPool) showLoading();

  try {
    await loadAccount();
    if (!account && stored[BOOKMARK_OWNER_KEY]) {
      bookmarkedArticles = new Map();
      await chrome.storage.local.remove([BOOKMARKS_KEY, BOOKMARK_OWNER_KEY]);
    }
  } catch (error) {
    console.warn('Trace account refresh failed', error);
  }

  const trackDailyActive = (cacheState) => captureExtensionDailyActive({
    article_count: currentPool?.articles.length || 0,
    cache_state: cacheState,
    extension_version: chrome.runtime.getManifest().version,
    has_account: Boolean(account),
    has_pro: Boolean(account?.hasAccess),
  });

  if (cachedPool && (isCacheFresh(cached.cachedAt) || !navigator.onLine)) {
    void trackDailyActive('fresh');
    try { await syncBookmarks(); } catch (error) { console.warn('Trace bookmark sync failed', error); }
    return;
  }

  if (cachedPool) {
    void trackDailyActive('stale');
    void loadArticles({ silent: true });
    try { await syncBookmarks(); } catch (error) { console.warn('Trace bookmark sync failed', error); }
    return;
  }

  await loadArticles();
  void trackDailyActive('miss');
  try { await syncBookmarks(); } catch (error) { console.warn('Trace bookmark sync failed', error); }
}

elements.retry.addEventListener('click', () => {
  if (!currentPool) showLoading();
  void loadArticles();
});
elements.filters.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  activeTag = button.dataset.tag;
  void captureExtensionEvent('extension_filter_changed', { filter: activeTag || 'all' });
  elements.filters.querySelectorAll('button').forEach((option) => {
    option.setAttribute('aria-pressed', String(option === button));
  });
  renderArticles();
});
elements.readerClose.addEventListener('click', () => elements.reader.close());
elements.readerBookmark.addEventListener('click', () => {
  if (readerArticle) void toggleBookmark(readerArticle);
});
elements.readerShare.addEventListener('click', async () => {
  if (!readerArticle) return;
  try {
    await navigator.clipboard.writeText(readerArticle.shareUrl || readerArticle.sourceUrl);
    elements.readerShare.setAttribute('aria-label', 'Link copied');
    void captureExtensionEvent('extension_story_shared', {
      story_id: readerArticle.id,
      tag: readerArticle.tag,
    });
  } catch (error) {
    console.error('Trace could not copy the story link', error);
  }
});
elements.readerLink.addEventListener('click', () => {
  if (!readerArticle) return;
  void captureExtensionEvent('extension_source_opened', {
    story_id: readerArticle.id,
    tag: readerArticle.tag,
  });
});
elements.accountLink.addEventListener('click', () => {
  if (!account) void captureExtensionEvent('extension_sign_in_clicked');
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
  void loadAccount(true).then(() => syncBookmarks(true)).catch((error) => {
    console.error('Trace could not finish account connection', error);
  });
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  void chrome.storage.local.get(CHECKOUT_PENDING_KEY).then(async (stored) => {
    if (!stored[CHECKOUT_PENDING_KEY]) return;
    await loadAccount(true);
    if (account?.hasAccess) {
      await chrome.storage.local.remove(CHECKOUT_PENDING_KEY);
      if (readerArticle) void openReader(readerArticle);
    }
  }).catch((error) => console.warn('Trace entitlement refresh failed', error));
});

start().catch((error) => {
  elements.loading.hidden = true;
  elements.articles.hidden = true;
  elements.errorMessage.textContent = 'Could not load articles.';
  elements.error.hidden = false;
  console.error('Trace extension startup failed', error);
});
