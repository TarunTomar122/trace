import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FREE_READS_LIMIT,
  addFreeRead,
  canReadArticle,
  recordServerFreeRead,
  syncFreeReadsFromServer,
} from './free-reads.ts';

const today = '2026-08-05';

test('free users can choose any five unique summaries', () => {
  let state = { date: today, ids: [] };

  for (let index = 0; index < FREE_READS_LIMIT; index += 1) {
    const articleId = `story-${index}`;
    assert.equal(canReadArticle(state, articleId, 'free'), true);
    state = addFreeRead(state, articleId);
  }

  assert.equal(canReadArticle(state, 'story-6', 'free'), false);
});

test('reopening a consumed summary stays free and does not duplicate the read', () => {
  const fullState = {
    date: today,
    ids: Array.from({ length: FREE_READS_LIMIT }, (_, index) => `story-${index}`),
  };

  assert.equal(canReadArticle(fullState, 'story-2', 'free'), true);
  assert.deepEqual(addFreeRead(fullState, 'story-2'), fullState);
});

test('Pro users can open summaries after the free limit', () => {
  const fullState = {
    date: today,
    ids: Array.from({ length: FREE_READS_LIMIT }, (_, index) => `story-${index}`),
  };

  assert.equal(canReadArticle(fullState, 'story-6', 'pro'), true);
});

test('articles never look locked while subscription access is checking', () => {
  const fullState = {
    date: today,
    ids: Array.from({ length: FREE_READS_LIMIT }, (_, index) => `story-${index}`),
  };

  assert.equal(canReadArticle(fullState, 'story-6', 'checking'), true);
});

test('a server-approved read stays allowed when the local mirror is unavailable', async () => {
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const originalFetch = globalThis.fetch;
  try {
    globalThis.window = {};
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('storage unavailable'); },
    };
    globalThis.fetch = async () => new Response(JSON.stringify({
      access: 'pro',
      date: new Date().toISOString().slice(0, 10),
      canRead: true,
      count: 1,
      ids: ['story-1'],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const result = await recordServerFreeRead('story-1');
    assert.equal(result.status, 'allowed');
    assert.equal(result.access, 'pro');
    assert.deepEqual(result.state?.ids, ['story-1']);
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    globalThis.fetch = originalFetch;
  }
});

test('a read verification failure is not reported as a paywall denial', async () => {
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const originalFetch = globalThis.fetch;
  try {
    globalThis.window = {};
    globalThis.localStorage = { getItem: () => null, setItem: () => undefined };
    globalThis.fetch = async () => { throw new Error('offline'); };

    assert.equal((await recordServerFreeRead('story-1')).status, 'error');
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    globalThis.fetch = originalFetch;
  }
});

test('subscription access retries with Firebase auth while the session cookie is still syncing', async () => {
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const originalFetch = globalThis.fetch;
  try {
    globalThis.window = {};
    globalThis.localStorage = { getItem: () => null, setItem: () => undefined };
    const requests = [];
    globalThis.fetch = async (_url, init = {}) => {
      requests.push(init);
      if (requests.length === 1) return new Response(null, { status: 401 });
      return new Response(JSON.stringify({
        access: 'pro',
        date: new Date().toISOString().slice(0, 10),
        count: 0,
        ids: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const result = await syncFreeReadsFromServer(async () => 'firebase-token');
    assert.equal(result?.access, 'pro');
    assert.equal(new Headers(requests[1].headers).get('Authorization'), 'Bearer firebase-token');
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    globalThis.fetch = originalFetch;
  }
});
