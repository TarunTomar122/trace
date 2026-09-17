/** Client-side retention helpers: edition timing, visit deltas, thread follows, milestones. */

export const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/trace-ai-tech-news-in-eve/cblkklekbejbbpcaihfogdmaoofmikbk';

export const EDITION_EPOCH = '2025-01-01';
export const EDITION_DROP_TZ = 'Europe/Berlin';
export const EDITION_DROP_HOUR = 10;
export const EDITION_DROP_MINUTE = 30;

export const MILESTONE_DAYS = [3, 7, 14, 30] as const;

export interface ReadingStreak {
  current_streak: number;
  longest_streak: number;
  last_read_date: string;
  total_days_read: number;
  streak_history?: string[];
}

export interface SinceLastVisitSummary {
  totalNew: number;
  byCategory: Array<{ cat: string; count: number }>;
  updatedThreads: number;
  isFirstVisit: boolean;
}

export interface WeeklyWrapSummary {
  week_id: string;
  headline: string;
  summary: string;
  total_articles: number;
  top_topics: string[];
  fun_stat: string;
}

const LAST_VISIT_KEY = 'trace_last_visit_v1';
const FOLLOWED_THREADS_KEY = 'trace_followed_threads_v1';
const MILESTONE_KEY = 'trace_milestone_seen_v1';
const EXTENSION_DISMISSED_KEY = 'trace_extension_cta_dismissed_v1';

function storageKey(base: string, uid?: string | null): string {
  return `${base}:${uid || 'guest'}`;
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseFeedDate(feedDate: string): Date | null {
  if (!feedDate) return null;
  const d = new Date(`${feedDate}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Edition number from the feed doc date (stable per day). */
export function editionNumber(feedDate: string): number {
  const d = parseFeedDate(feedDate);
  if (!d) return 1;
  const epoch = new Date(`${EDITION_EPOCH}T00:00:00`);
  const diff = Math.floor((d.getTime() - epoch.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

export function msUntilNextEdition(): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: EDITION_DROP_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const [h, m] = fmt.format(new Date()).split(':').map((x) => Number(x) || 0);
  const nowMin = h * 60 + m;
  const targetMin = EDITION_DROP_HOUR * 60 + EDITION_DROP_MINUTE;
  let diffMin = targetMin - nowMin;
  if (diffMin <= 0) diffMin += 24 * 60;
  return diffMin * 60000;
}

export function formatEditionCountdown(ms: number): string {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatEditionDate(feedDate: string): string {
  const d = parseFeedDate(feedDate);
  if (!d) return 'Today';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface LastVisitSnapshot {
  visitedAt: string;
  feedDate: string;
  storyIds: string[];
}

export function readLastVisit(uid?: string | null): LastVisitSnapshot | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(storageKey(LAST_VISIT_KEY, uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastVisitSnapshot;
    if (!parsed?.visitedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLastVisit(uid: string | null | undefined, feedDate: string, storyIds: string[]): void {
  try {
    const snap: LastVisitSnapshot = {
      visitedAt: new Date().toISOString(),
      feedDate,
      storyIds: storyIds.slice(0, 200),
    };
    window.localStorage.setItem(storageKey(LAST_VISIT_KEY, uid), JSON.stringify(snap));
  } catch {
    // private mode
  }
}

export function computeSinceLastVisit(
  stories: Array<{ id: string; cat: string; threadId?: string }>,
  last: LastVisitSnapshot | null,
  feedDate: string,
  interests: string[],
): SinceLastVisitSummary {
  if (!last || last.feedDate !== feedDate) {
    const filtered = interests.length
      ? stories.filter((s) => interests.includes(s.cat))
      : stories;
    return {
      totalNew: filtered.length,
      byCategory: summarizeCats(filtered),
      updatedThreads: 0,
      isFirstVisit: !last,
    };
  }
  const seen = new Set(last.storyIds);
  const newStories = stories.filter((s) => !seen.has(s.id));
  const interestFiltered = interests.length
    ? newStories.filter((s) => interests.includes(s.cat))
    : newStories;
  const updatedThreads = newStories.filter((s) => s.threadId).length;
  return {
    totalNew: interestFiltered.length,
    byCategory: summarizeCats(interestFiltered),
    updatedThreads,
    isFirstVisit: false,
  };
}

function summarizeCats(stories: Array<{ cat: string }>): Array<{ cat: string; count: number }> {
  const map = new Map<string, number>();
  for (const s of stories) {
    map.set(s.cat, (map.get(s.cat) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({ cat, count }));
}

/** Top-ranked story with multi-source coverage — editorial "story of the day". */
export function pickStoryOfDay<T extends { id: string; rank: number; sources?: string[]; threadId?: string }>(
  stories: T[],
): T | null {
  if (!stories.length) return null;
  const sorted = [...stories].sort((a, b) => a.rank - b.rank);
  const multi = sorted.find((s) => (s.sources?.length || 0) >= 2);
  return multi || sorted[0] || null;
}

export function readFollowedThreads(uid?: string | null): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set();
    const raw = window.localStorage.getItem(storageKey(FOLLOWED_THREADS_KEY, uid));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function toggleFollowedThread(threadId: string, uid?: string | null): boolean {
  const set = readFollowedThreads(uid);
  const next = new Set(set);
  if (next.has(threadId)) next.delete(threadId);
  else next.add(threadId);
  try {
    window.localStorage.setItem(storageKey(FOLLOWED_THREADS_KEY, uid), JSON.stringify([...next]));
  } catch {
    // ignore
  }
  return next.has(threadId);
}

export function readMilestoneSeen(uid?: string | null): number {
  try {
    const raw = window.localStorage.getItem(storageKey(MILESTONE_KEY, uid));
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function markMilestoneSeen(streak: number, uid?: string | null): void {
  try {
    window.localStorage.setItem(storageKey(MILESTONE_KEY, uid), String(streak));
  } catch {
    // ignore
  }
}

export function checkNewMilestone(streak: number, lastSeen: number): number | null {
  if (streak <= lastSeen) return null;
  const hit = MILESTONE_DAYS.filter((d) => d <= streak && d > lastSeen);
  return hit.length ? hit[hit.length - 1] : null;
}

export function buildCaughtUpShareText(streak: number, storiesRead: number): string {
  const streakLine = streak > 1 ? ` · ${streak}-day streak` : '';
  return `Caught up on tech in minutes${streakLine} — ${storiesRead} stories on Trace`;
}

export function buildCaughtUpShareUrl(): string {
  return 'https://www.yourtrace.online/feed';
}

export function buildHeatmapDays(history: string[]): Array<{ date: string; active: boolean }> {
  const activeSet = new Set(history);
  const days: Array<{ date: string; active: boolean }> = [];
  const d = new Date();
  for (let i = 29; i >= 0; i--) {
    const cell = new Date(d);
    cell.setDate(cell.getDate() - i);
    const key = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`;
    days.push({ date: key, active: activeSet.has(key) });
  }
  return days;
}

export function isExtensionCtaDismissed(uid?: string | null): boolean {
  try {
    return window.localStorage.getItem(storageKey(EXTENSION_DISMISSED_KEY, uid)) === '1';
  } catch {
    return false;
  }
}

export function dismissExtensionCta(uid?: string | null): void {
  try {
    window.localStorage.setItem(storageKey(EXTENSION_DISMISSED_KEY, uid), '1');
  } catch {
    // ignore
  }
}

export function isSunday(): boolean {
  return new Date().getDay() === 0;
}

export const CAT_DISPLAY: Record<string, string> = {
  ai: 'AI',
  markets: 'Markets',
  'ux-design': 'Design',
  engineering: 'Engineering',
  tech: 'Tech',
  startups: 'Startups',
};
