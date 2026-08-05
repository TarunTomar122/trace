import {
  isCacheFresh,
  normalizeArticlePool,
  selectRandomArticles,
} from './lib/brief.js';

const CACHE_KEY = 'trace.extension.article-pool.v4';
const API_URL = new URL('/api/extension/brief', chrome.runtime.getManifest().homepage_url).toString();

const elements = {
  refresh: document.querySelector('#refresh'),
  loading: document.querySelector('#loading'),
  articles: document.querySelector('#articles'),
  error: document.querySelector('#error'),
  errorMessage: document.querySelector('#error-message'),
  retry: document.querySelector('#retry'),
  reader: document.querySelector('#reader'),
  readerClose: document.querySelector('#reader-close'),
  readerTag: document.querySelector('#reader-tag'),
  readerImage: document.querySelector('#reader-image'),
  readerSource: document.querySelector('#reader-source'),
  readerTitle: document.querySelector('#reader-title'),
  readerBody: document.querySelector('#reader-body'),
  readerTakeaways: document.querySelector('#reader-takeaways'),
  readerLink: document.querySelector('#reader-link'),
};

let currentPool = null;

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function showLoading() {
  elements.loading.replaceChildren();
  for (let index = 0; index < 15; index += 1) {
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
  elements.readerTag.textContent = article.tag;
  elements.readerTag.hidden = !article.tag;
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

  const title = document.createElement('span');
  title.className = 'article-title';
  title.textContent = article.title;

  if (article.tag) {
    const tag = document.createElement('span');
    tag.className = 'story-tag';
    tag.textContent = article.tag;
    content.append(tag);
  }

  content.append(title);

  if (article.summary) {
    const summary = document.createElement('span');
    summary.className = 'article-summary';
    summary.textContent = article.summary;
    content.append(summary);
  }

  open.append(content);

  const footer = document.createElement('div');
  footer.className = 'article-footer';

  const meta = document.createElement('span');
  meta.textContent = [article.source, formatDate(article.publishedAt)].filter(Boolean).join(' · ');

  const sourceLink = document.createElement('a');
  sourceLink.href = article.sourceUrl;
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener noreferrer';
  sourceLink.textContent = 'Source';

  footer.append(meta, sourceLink);
  card.append(open, footer);
  return card;
}

function renderPool(pool) {
  currentPool = pool;
  const selected = selectRandomArticles(pool.articles, 15);
  elements.articles.replaceChildren(...selected.map(createArticleCard));
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

async function refreshArticles() {
  elements.refresh.classList.add('is-loading');
  elements.refresh.disabled = true;
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
  } finally {
    elements.refresh.classList.remove('is-loading');
    elements.refresh.disabled = false;
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

  await refreshArticles();
}

elements.refresh.addEventListener('click', refreshArticles);
elements.retry.addEventListener('click', refreshArticles);
elements.readerClose.addEventListener('click', () => elements.reader.close());
elements.reader.addEventListener('click', (event) => {
  if (event.target === elements.reader) elements.reader.close();
});

start();
