import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server.js';
import { createTraceSession, TRACE_SESSION_COOKIE_NAME } from './lib/server-session.ts';
import { proxy } from './proxy.ts';

test('redirects signed-in homepage requests before rendering', () => {
  const session = createTraceSession('user-1');
  const request = new NextRequest('https://www.yourtrace.online/', {
    headers: { cookie: `${TRACE_SESSION_COOKIE_NAME}=${session}` },
  });

  const response = proxy(request);

  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://www.yourtrace.online/feed');
});

test('keeps the public homepage for missing or invalid sessions', () => {
  for (const cookie of [undefined, `${TRACE_SESSION_COOKIE_NAME}=invalid`]) {
    const request = new NextRequest('https://www.yourtrace.online/', {
      headers: cookie ? { cookie } : undefined,
    });

    const response = proxy(request);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-middleware-next'), '1');
  }
});
