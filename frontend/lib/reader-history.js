export const READER_HISTORY_KEY = 'traceReader';

/** @param {unknown} state @param {string} articleId */
export function addReaderHistoryState(state, articleId) {
  const current = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  return { ...current, [READER_HISTORY_KEY]: articleId };
}

/** @param {unknown} state */
export function isReaderHistoryState(state) {
  return Boolean(
    state
    && typeof state === 'object'
    && !Array.isArray(state)
    && typeof state[READER_HISTORY_KEY] === 'string',
  );
}
