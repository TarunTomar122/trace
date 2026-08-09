const FREE_READS_KEY = 'trace_free_reads_v1';
export const FREE_READS_LIMIT = 5;

export interface FreeReadsState {
  date: string; // YYYY-MM-DD
  ids: string[]; // article IDs read today
}

export type SummaryAccessResult = 'allowed' | 'denied' | 'error';
export type SummaryAccessState = 'checking' | 'pro' | 'free';
type GetIdToken = () => Promise<string>;

export function canReadArticle(
  state: FreeReadsState,
  articleId: string,
  access: SummaryAccessState = 'free',
): boolean {
  return access !== 'free' || state.ids.includes(articleId) || state.ids.length < FREE_READS_LIMIT;
}

export function addFreeRead(state: FreeReadsState, articleId: string): FreeReadsState {
  if (state.ids.includes(articleId) || state.ids.length >= FREE_READS_LIMIT) return state;
  return { ...state, ids: [...state.ids, articleId] };
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
  return canReadArticle(getLocalFreeReads(), articleId);
}

/**
 * Record a free read for an article.
 * Returns true if the article is now (or was already) readable.
 * Returns false if the limit has been reached and this article is new.
 */
export function recordLocalFreeRead(articleId: string): SummaryAccessResult {
  try {
    const state = getLocalFreeReads();
    if (!canReadArticle(state, articleId)) return 'denied';
    localStorage.setItem(FREE_READS_KEY, JSON.stringify(addFreeRead(state, articleId)));
    return 'allowed';
  } catch {
    return 'error';
  }
}

export function getFreeReadsUsed(): number {
  return getLocalFreeReads().ids.length;
}

async function fetchSummaryAccess(
  init: RequestInit,
  getIdToken?: GetIdToken,
): Promise<Response> {
  const response = await fetch('/api/feed/reads', init);
  if (response.status !== 401 || !getIdToken) return response;
  const token = await getIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch('/api/feed/reads', {
    ...init,
    headers,
  });
}

export async function syncFreeReadsFromServer(getIdToken?: GetIdToken): Promise<{
  access: Exclude<SummaryAccessState, 'checking'>;
  state: FreeReadsState;
} | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetchSummaryAccess(
      { credentials: 'same-origin', cache: 'no-store' },
      getIdToken,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as FreeReadsState & {
      access: Exclude<SummaryAccessState, 'checking'>;
      count?: number;
    };
    if (data.date === getTodayDate()) {
      localStorage.setItem(FREE_READS_KEY, JSON.stringify(data));
      return { access: data.access, state: { date: data.date, ids: data.ids } };
    }
  } catch {
    // ignore network errors
  }
  return null;
}

export async function recordServerFreeRead(
  articleId: string,
  getIdToken?: GetIdToken,
): Promise<{
  status: SummaryAccessResult;
  access?: Exclude<SummaryAccessState, 'checking'>;
  readsUsed: number;
  state?: FreeReadsState;
}> {
  if (typeof window === 'undefined') {
    return { status: 'error', readsUsed: getFreeReadsUsed() };
  }
  try {
    const res = await fetchSummaryAccess({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId }),
    }, getIdToken);
    if (!res.ok) return { status: 'error', readsUsed: getFreeReadsUsed() };
    const data = (await res.json()) as {
      access: Exclude<SummaryAccessState, 'checking'>;
      date: string;
      canRead: boolean;
      count: number;
      ids: string[];
    };
    if (data.date === getTodayDate()) {
      try {
        localStorage.setItem(
          FREE_READS_KEY,
          JSON.stringify({ date: data.date, ids: data.ids })
        );
      } catch {
        // The server accepted the read. Local mirroring must not hide it.
      }
    }
    return {
      status: data.canRead ? 'allowed' : 'denied',
      readsUsed: data.count,
      state: { date: data.date, ids: data.ids },
      access: data.access,
    };
  } catch {
    return { status: 'error', readsUsed: getFreeReadsUsed() };
  }
}
