import assert from 'node:assert/strict';
import test from 'node:test';
import { extensionBearerToken, extensionSessionId } from './extension-session.ts';

test('extension sessions only accept correctly prefixed opaque bearer tokens', () => {
  const token = `trace_ext_${'a'.repeat(43)}`;
  assert.equal(extensionBearerToken(`Bearer ${token}`), token);
  assert.equal(extensionBearerToken('Bearer firebase-token'), '');
  assert.equal(extensionSessionId(token), extensionSessionId(token));
  assert.notEqual(extensionSessionId(token), extensionSessionId(`${token}b`));
  assert.equal(extensionSessionId('trace_ext_short'), null);
});
