import assert from 'node:assert/strict';
import test from 'node:test';
import { addReaderHistoryState, isReaderHistoryState } from './reader-history.js';

test('reader history preserves router state and marks only valid reader entries', () => {
  const state = addReaderHistoryState({ __NA: true }, 'story-1');
  assert.deepEqual(state, { __NA: true, traceReader: 'story-1' });
  assert.equal(isReaderHistoryState(state), true);
  assert.equal(isReaderHistoryState({ traceReader: 1 }), false);
  assert.equal(isReaderHistoryState(null), false);
});
