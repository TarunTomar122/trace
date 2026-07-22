const FREE_READS_KEY = 'trace_free_reads_v1';
export const FREE_READS_LIMIT = 5;

export interface FreeReadsState {
  date: string; // YYYY-MM-DD
  ids: string[]; // article IDs read today
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getLocalFreeReads(): FreeReadsState {
  if (typeof window === 'undefined') {
    return { date: getTodayDate(), ids: [] };
  }
  try {
    const raw = localStorage.getItem(FREE_READS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FreeReadsState;
      if (parsed.date === getTodayDate()) {
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return { date: getTodayDate(), ids: [] };
}

export function canReadFreeArticle(articleId: string): boolean {
  const state = getLocalFreeReads();
  return state.ids.includes(articleId) || state.ids.length < FREE_READS_LIMIT;
}

/**
 * Record a free read for an article.
 * Returns true if the article is now (or was already) readable.
 * Returns false if the limit has been reached and this article is new.
 */
export function recordLocalFreeRead(articleId: string): boolean {
  const state = getLocalFreeReads();
  if (state.ids.includes(articleId)) return true;
  if (state.ids.length >= FREE_READS_LIMIT) return false;
  state.ids.push(articleId);
  localStorage.setItem(FREE_READS_KEY, JSON.stringify(state));
  return true;
}

export function getFreeReadsUsed(): number {
  return getLocalFreeReads().ids.length;
}

export async function syncFreeReadsFromServer(): Promise<FreeReadsState | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/feed/reads', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = (await res.json()) as FreeReadsState & { count?: number };
    if (data.date === getTodayDate()) {
      localStorage.setItem(FREE_READS_KEY, JSON.stringify(data));
      return data;
    }
  } catch {
    // ignore network errors
  }
  return null;
}

export async function recordServerFreeRead(
  articleId: string
): Promise<{ success: boolean; readsUsed: number }> {
  if (typeof window === 'undefined') {
    return { success: false, readsUsed: getFreeReadsUsed() };
  }
  try {
    const res = await fetch('/api/feed/reads', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId }),
    });
    if (!res.ok) return { success: false, readsUsed: getFreeReadsUsed() };
    const data = (await res.json()) as {
      date: string;
      canRead: boolean;
      count: number;
      ids: string[];
    };
    if (data.date === getTodayDate()) {
      localStorage.setItem(
        FREE_READS_KEY,
        JSON.stringify({ date: data.date, ids: data.ids })
      );
    }
    return { success: data.canRead, readsUsed: data.count };
  } catch {
    return { success: false, readsUsed: getFreeReadsUsed() };
  }
}
