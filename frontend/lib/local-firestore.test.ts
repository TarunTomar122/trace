import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalFirestore } from './local-firestore.ts';

test('LocalDB query rejects non-2xx responses so fallback can run', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: 'authentication required' }),
    { status: 401, headers: { 'content-type': 'application/json' } },
  );

  try {
    const db = new LocalFirestore('https://db.example.test', 'bad-token');
    await assert.rejects(
      db.collection('v3_user_feeds/_global/daily').limit(2).get(),
      /authentication required/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
