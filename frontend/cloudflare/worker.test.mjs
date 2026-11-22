import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

test('an anonymous cached homepage still redirects after sign-in', async t => {
  let cached;
  const pending = [];
  const store = {
    match: async () => cached?.clone(),
    put: async (_key, response) => { cached = response; },
  };
  const initial = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: store } });
  t.after(() => initial ? Object.defineProperty(globalThis, 'caches', initial) : delete globalThis.caches);
  const upstream = t.mock.method(globalThis, 'fetch', async (_url, opts) => {
    if (opts.headers.has('cookie')) return new Response(null, { status: 307, headers: { location: '/feed' } });
    return new Response('homepage', { headers: { 'content-type': 'text/html', 'cache-control': 's-maxage=600' } });
  });
  const visit = headers => worker.fetch(new Request('https://www.yourtrace.online/', {
    headers: { accept: 'text/html', ...headers },
  }), { ORIGIN_KEY: 'unit-test' }, { waitUntil: p => pending.push(p) });
  assert.equal((await visit({})).headers.get('cache-control'), 'private, no-store');
  await Promise.all(pending);
  assert.equal((await visit({})).headers.get('cache-control'), 'private, no-store');
  assert.equal(upstream.mock.callCount(), 1);
  const signedIn = await visit({ cookie: 'trace_signed_in=1' });
  assert.equal(signedIn.status, 307);
  assert.equal(signedIn.headers.get('location'), '/feed');
  assert.equal(upstream.mock.callCount(), 2);
});
