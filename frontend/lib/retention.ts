/** Client-side retention helpers: thread follows, milestones, streak UI. */

import { isStaleStory } from './feed-ranking.ts';

export const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/trace-ai-tech-news-in-eve/cblkklekbejbbpcaihfogdmaoofmikbk';

export const MILESTONE_DAYS = [3, 7, 14, 30] as const;

export interface ReadingStreak {
  current_streak: number;
  longest_streak: number;
  last_read_date: string;
  total_days_read: number;
  streak_history?: string[];
}

export interface WeeklyWrapSummary {
  week_id: string;
  headline: string;
  summary: string;
  total_articles: number;
  top_topics: string[];
  fun_stat: string;
}

const FOLLOWED_THREADS_KEY = 'trace_followed_threads_v1';
const MILESTONE_KEY = 'trace_milestone_seen_v1';
const EXTENSION_DISMISSED_KEY = 'trace_extension_cta_dismissed_v1';

function storageKey(base: string, uid?: string | null): string {
  return `${base}:${uid || 'guest'}`;
}

/**
 * Top-ranked story with multi-source coverage — editorial "story of the day".
 * Only stories with coverage in the last FRESH_STORY_HOURS qualify while any
 * exist, so a well-covered launch from two days ago does not keep the top spot.
 */
export function pickStoryOfDay<T extends { id: string; rank: number; sources?: string[]; threadId?: string; ts?: number }>(
  stories: T[],
  now: number = Date.now(),
): T | null {
  if (!stories.length) return null;
  const sorted = [...stories].sort((a, b) => a.rank - b.rank);
  const fresh = sorted.filter((s) => !isStaleStory(s.ts, now));
  const pool = fresh.length ? fresh : sorted;
  const multi = pool.find((s) => (s.sources?.length || 0) >= 2);
  return multi || pool[0] || null;
}

/** Newest story in the pool — hero for the Recent sort. */
export function pickLatestStory<T extends { id: string; ts?: number }>(stories: T[]): T | null {
  if (!stories.length) return null;
  return [...stories].sort((a, b) => (b.ts || 0) - (a.ts || 0))[0] || null;
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
