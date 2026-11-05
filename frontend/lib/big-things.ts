import { isFreshRelease, isModelRelease } from './feed-ranking.ts';

/**
 * The feed's "big things" edition, modelled on the daily email's selection:
 * drop anything Jev judged worthless, lead with new model releases, then fill
 * lane quotas in priority order (AI, robotics, markets, tech, design).
 *
 * Robotics keeps two slots right after AI, as in the email
 * (backend/v3/flows/send_audience_newsletter.py); unlike it, Home gives tech
 * two slots and startups none.
 */

export type BigThingCandidate = {
  id?: string;
  title?: string;
  cat?: string;
  sources?: string[];
  ts?: number;
  tags?: string[];
  url?: string;
  body?: string;
  /** Jev verdict: 0 means no reader value. */
  sendWorthy?: number | null;
  /** The thin lane a story was folded out of; it still fills that lane's slots. */
  laneDetail?: string;
  /** The editor's 1-100 rating (backend v3/lib/feed_editor.py), when it has one. */
  importance?: number;
  /** The editor's call on whether this is a new AI model. */
  release?: boolean;
};

// With the editor's ratings: below this a story only fills an edition that would
// otherwise run short (Home shows fewer than HOME_CAP rather than filler), and no
// lane takes more than its MAX_PER_LANE cap.
const MIN_IMPORTANCE = 65;
// AI is most of this reader's day, so it gets more room; model launches count
// against their own cap, not AI's, so a busy launch day can't crowd out AI news.
const MAX_PER_LANE: Record<string, number> = { ai: 5, releases: 3 };
const DEFAULT_LANE_CAP = 3;

// Home is today's news: a story whose newest coverage is this old gives way to fresher news.
const AGING_HOURS = 18;
const OLD_HOURS = 24;
const FRESH_HOURS = 3;

/** The editor's importance plus breadth, minus age: Home's order, and how a lane picks its lead. */
export function score(story: BigThingCandidate, now: number = Date.now()): number {
  if (!story.importance) return 0;
  const hours = story.ts ? (now - story.ts) / 3_600_000 : 0;
  // Under FRESH_HOURS old a story gets a small lift: this morning's news over yesterday's.
  const age = hours > OLD_HOURS ? 16 : hours > AGING_HOURS ? 8 : hours < FRESH_HOURS ? -4 : 0;
  // Breadth: each outlet past the first counts, up to six (a seven-outlet story outranks a one-outlet one).
  return story.importance + 3 * (Math.min(story.sources?.length || 1, 6) - 1) - age;
}

function laneOf(story: BigThingCandidate): string {
  return story.laneDetail || story.cat || '';
}

// Startups have no quota here: their stories backfill, competing on strength
// rather than taking a reserved slot.
const LANE_ORDER = ['ai', 'robotics', 'markets', 'tech', 'startups', 'ux-design'] as const;

/** Slots per lane once releases have taken theirs (10 and 5 story editions). */
const LANE_QUOTA_PRO: Record<string, number> = {
  ai: 3,
  robotics: 2,
  markets: 2,
  tech: 2,
  'ux-design': 1,
};
const LANE_QUOTA_FREE: Record<string, number> = {
  ai: 2,
  robotics: 2,
  markets: 1,
  tech: 1,
};

export const BIG_THINGS_PRO = 10;
export const BIG_THINGS_FREE = 5;

function verdictRank(story: BigThingCandidate): number {
  const value = story.sendWorthy;
  return typeof value === 'number' ? value : 1;
}

function byStrength<T extends BigThingCandidate>(a: T, b: T): number {
  const verdict = verdictRank(b) - verdictRank(a);
  if (verdict !== 0) return verdict;
  const coverage = (b.sources?.length || 0) - (a.sources?.length || 0);
  if (coverage !== 0) return coverage;
  return (b.ts || 0) - (a.ts || 0);
}

export function selectBigThings<T extends BigThingCandidate>(
  stories: T[],
  options: { count: number; lanes?: string[]; now?: number },
): T[] {
  const { count, now = Date.now() } = options;
  const laneFilter = (options.lanes || []).filter((lane) => lane);
  const eligible = stories
    .filter((story) => story.sendWorthy !== 0)
    .filter((story) => (laneFilter.length ? laneFilter.includes(story.cat || '') || laneFilter.includes(laneOf(story)) : true))
    .sort(byStrength);

  if (eligible.some((story) => story.importance)) return selectByImportance(eligible, count, now);
  if (eligible.length <= count) return eligible;

  const picked: T[] = [];
  const used = new Set<T>();

  // New model releases lead the edition, like the email's own section. One
  // whose newest coverage is older than FRESH_STORY_HOURS competes in its lane.
  const releaseSlots = count >= BIG_THINGS_PRO ? 2 : 1;
  for (const story of eligible) {
    if (picked.length >= releaseSlots) break;
    if (!isFreshRelease(story, now)) continue;
    picked.push(story);
    used.add(story);
  }

  const quota = count >= BIG_THINGS_PRO ? LANE_QUOTA_PRO : LANE_QUOTA_FREE;
  for (const lane of LANE_ORDER) {
    if (!(lane in quota)) continue;
    let taken = 0;
    for (const story of eligible) {
      if (taken >= quota[lane] || picked.length >= count) break;
      if (used.has(story) || laneOf(story) !== lane) continue;
      picked.push(story);
      used.add(story);
      taken += 1;
    }
  }

  // Anything unfilled backfills from the strongest remaining stories.
  for (const story of eligible) {
    if (picked.length >= count) break;
    if (used.has(story)) continue;
    picked.push(story);
    used.add(story);
  }

  return picked;
}

/** The edition when the editor has rated the stories: importance decides, lanes only cap. */
function selectByImportance<T extends BigThingCandidate>(eligible: T[], count: number, now: number): T[] {
  const ordered = [...eligible].sort((a, b) => score(b, now) - score(a, now) || (b.ts || 0) - (a.ts || 0));
  const strong = ordered.filter((story) => !story.importance || story.importance >= MIN_IMPORTANCE);
  const pool = strong.length >= Math.min(count, 6) ? strong : ordered.slice(0, Math.min(count, 6));
  const picked: T[] = [];
  const used = new Set<T>();
  const perLane = new Map<string, number>();
  const capLane = (story: T) => (isModelRelease(story) ? 'releases' : laneOf(story));
  const full = (story: T) => (perLane.get(capLane(story)) ?? 0) >= (MAX_PER_LANE[capLane(story)] ?? DEFAULT_LANE_CAP);
  const take = (story: T) => {
    picked.push(story);
    used.add(story);
    perLane.set(capLane(story), (perLane.get(capLane(story)) ?? 0) + 1);
  };
  // The three most important lead whatever their lane (two or more outlets each);
  // launches then take their place by importance like everything else, so the
  // launch panel sits where they rank instead of ahead of bigger news.
  for (const story of pool.filter((s) => (s.sources?.length || 0) >= 2).slice(0, Math.min(3, count))) take(story);
  for (const capped of [true, false]) {
    for (const story of pool) {
      if (picked.length >= count) break;
      if (used.has(story) || (capped && full(story))) continue;
      take(story);
    }
  }
  // Shown most important first: the caps decide who is in, not the order.
  return picked.sort((a, b) => score(b, now) - score(a, now) || (b.ts || 0) - (a.ts || 0));
}
