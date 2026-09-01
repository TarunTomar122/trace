import assert from 'node:assert/strict';
import test from 'node:test';

function setup() {
  const values = {};
  const requests = [];
  globalThis.chrome = {
    runtime: { getManifest: () => ({ homepage_url: 'https://www.yourtrace.online' }) },
    storage: {
      local: {
        get: async (key) => ({ [key]: values[key] }),
        set: async (entries) => Object.assign(values, entries),
      },
    },
  };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(null, { status: 202 });
  };
  return { values, requests };
}

test('captures one anonymous daily feed event without article content', async () => {
  const { requests } = setup();
  const analytics = await import(`../lib/analytics.js?test=${Date.now()}`);
  await analytics.captureExtensionDailyActive({ article_count: 31, cache_state: 'fresh' });
  await analytics.captureExtensionDailyActive({ article_count: 31, cache_state: 'fresh' });

  assert.equal(requests.length, 1);
  const payload = JSON.parse(requests[0].options.body);
  assert.match(payload.distinctId, /^ext_[0-9a-f-]{36}$/);
  assert.equal(payload.event, 'extension_feed_viewed');
  assert.deepEqual(payload.properties, { article_count: 31, cache_state: 'fresh' });
  assert.equal('title' in payload.properties, false);
  assert.equal('url' in payload.properties, false);
});
