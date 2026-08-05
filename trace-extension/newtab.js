import {
  filterArticlesByTag,
  isCacheFresh,
  normalizeArticlePool,
  selectRandomArticles,
} from './lib/brief.js';

const CACHE_KEY = 'trace.extension.article-pool.v4';
const API_URL = new URL('/api/extension/brief', chrome.runtime.getManifest().homepage_url).toString();
const STORIES_PER_TAB = 30;

const elements = {
  filters: document.querySelector('#filters'),
  feedbackCard: document.querySelector('#feedback-card'),
  loading: document.querySelector('#loading'),
  articles: document.querySelector('#articles'),
  error: document.querySelector('#error'),
  errorMessage: document.querySelector('#error-message'),
  retry: document.querySelector('#retry'),
  reader: document.querySelector('#reader'),
  readerClose: document.querySelector('#reader-close'),
  readerImage: document.querySelector('#reader-image'),
  readerSource: document.querySelector('#reader-source'),
  readerTitle: document.querySelector('#reader-title'),
  readerBody: document.querySelector('#reader-body'),
  readerTakeaways: document.querySelector('#reader-takeaways'),
  readerLink: document.querySelector('#reader-link'),
};

let currentPool = null;
let currentArticles = [];
let activeTag = '';

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

function openReader(article) {
  elements.readerSource.textContent = [article.source, formatDate(article.publishedAt)].filter(Boolean).join(' · ');
  elements.readerTitle.textContent = article.title;
  renderReaderContent(article);
  elements.readerLink.href = article.sourceUrl;

  if (article.thumbnail) {
    elements.readerImage.src = article.thumbnail;
    elements.readerImage.hidden = false;
  } else {
    elements.readerImage.removeAttribute('src');
    elements.readerImage.hidden = true;
  }

  elements.readerTakeaways.replaceChildren();
  article.keyTakeaways.forEach((takeaway) => {
    const item = document.createElement('li');
    item.textContent = takeaway;
    elements.readerTakeaways.append(item);
  });
  elements.readerTakeaways.hidden = article.keyTakeaways.length === 0;
  elements.reader.showModal();
}

function createArticleCard(article) {
  const card = document.createElement('article');
  card.className = 'article-card';

  const open = document.createElement('button');
  open.className = 'article-open';
  open.type = 'button';
  open.addEventListener('click', () => openReader(article));

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
  const selected = filterArticlesByTag(currentArticles, activeTag).slice(0, STORIES_PER_TAB);
  elements.articles.replaceChildren(
    ...selected.map(createArticleCard),
    elements.feedbackCard.content.cloneNode(true),
  );
}

function renderFilters() {
  const tags = [...new Set(currentArticles.map(({ tag }) => tag))].sort();
  elements.filters.replaceChildren(...['', ...tags].map((tag) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tag = tag;
    button.textContent = tag ? tag.replace(/\b(ai|ux)\b|^\w/g, (word) => word.toUpperCase()) : 'All';
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

async function loadArticles() {
  elements.error.hidden = true;

  try {
    const fresh = await fetchPool();
    const pool = normalizeArticlePool(fresh.payload);
    await chrome.storage.local.set({ [CACHE_KEY]: fresh });
    renderPool(pool);
  } catch (error) {
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
  showLoading();
  const stored = await chrome.storage.local.get(CACHE_KEY);
  const cached = stored[CACHE_KEY];

  if (cached?.payload) {
    try {
      renderPool(normalizeArticlePool(cached.payload));
      if (isCacheFresh(cached.cachedAt) || !navigator.onLine) return;
    } catch {
      await chrome.storage.local.remove(CACHE_KEY);
    }
  }

  await loadArticles();
}

elements.retry.addEventListener('click', loadArticles);
elements.filters.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  activeTag = button.dataset.tag;
  elements.filters.querySelectorAll('button').forEach((option) => {
    option.setAttribute('aria-pressed', String(option === button));
  });
  renderArticles();
});
elements.readerClose.addEventListener('click', () => elements.reader.close());
elements.readerImage.addEventListener('error', () => {
  elements.readerImage.removeAttribute('src');
  elements.readerImage.hidden = true;
});
elements.reader.addEventListener('click', (event) => {
  if (event.target === elements.reader) elements.reader.close();
});

start();
