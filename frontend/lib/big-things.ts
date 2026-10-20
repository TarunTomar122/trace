import { isFreshRelease } from './feed-ranking.ts';

/**
 * The feed's "big things" edition — the same selection the daily email makes:
 * drop anything Jev judged worthless, lead with new model releases, then fill
 * lane quotas in priority order (AI, markets, tech, design).
 *
 * Kept in step with backend/v3/flows/send_audience_newsletter.py on purpose: the
 * homepage promises "10 big things in tech and AI", so the feed should show
 * the same ten.
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
};

// Startups and robotics have no quota here: their stories backfill, competing
// on strength rather than taking a reserved slot.
const LANE_ORDER = ['ai', 'markets', 'tech', 'ux-design', 'startups', 'robotics'] as const;

/** Slots per lane once releases have taken theirs (10 and 5 story editions). */
const LANE_QUOTA_PRO: Record<string, number> = {
  ai: 3,
  markets: 2,
  tech: 2,
  'ux-design': 1,
};
const LANE_QUOTA_FREE: Record<string, number> = {
  ai: 2,
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
    .filter((story) => (laneFilter.length ? laneFilter.includes(story.cat || '') : true))
    .sort(byStrength);

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
      if (used.has(story) || story.cat !== lane) continue;
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
