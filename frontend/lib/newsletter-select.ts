/**
 * Story allocation for the daily email, ported line for line from
 * `_select_from_groups` in backend/v3/flows/send_audience_newsletter.py so the
 * newsletter builder can preview exactly what a reader will receive.
 * backend/v3/test_newsletter_parity.py runs both against the same fixture; change
 * them together.
 */

export type PoolStory = {
  topic_id: string;
  title: string;
  summary: string;
  url: string;
  source_name: string;
  image: string;
  sources: string[];
  source_count: number;
  coverage: number;
  interest_id: string;
  /** The thin lane a story was folded out of (THIN_LANE_FOLD in build_trending). */
  lane_detail?: string;
  macro: boolean;
  model_release: boolean;
  send_worthy: number | null;
  /** The editor's 1-100 rating (newsletter_editor); absent when it never saw the story. */
  importance?: number | null;
  /** The company the story is mainly about, per the editor ("" when none). */
  company?: string | null;
};

export type Bucket = 'member' | 'winback' | 'landing';
export type Section = [lane: string, stories: PoolStory[]];

export const MODEL_RELEASE_LANE = 'model-releases';
export const TOP_LANE = 'top';
export const LANE_ORDER = [
  'ai', 'robotics', 'markets', 'tech', 'startups', 'ux-design',
  'products', 'the-world',
] as const;
const MODEL_RELEASE_SLOTS: Record<Bucket, number> = { member: 2, winback: 2, landing: 1 };
const TOP_SLOTS: Record<Bucket, number> = { member: 3, winback: 3, landing: 3 };
const MAX_PER_LANE = 3;
// A full email shows these lanes when the pool has a strong story for them, even a
// single-source one: it takes the slot of the weakest pick from a lane that has others.
const FLOOR_LANES = ['markets', 'robotics'];
const FLOOR_IMPORTANCE = 75;
const MAX_PER_COMPANY = 2;
const MAX_SINGLE_SOURCE = 2;
const MIN_IMPORTANCE = 50;
const MIN_STORIES = 6;

function verdictRank(story: PoolStory): number {
  return typeof story.send_worthy === 'number' ? story.send_worthy : 1;
}

/**
 * The editor's importance first, then outlet count; stories it never saw rank
 * after every edited one, by Jev's verdict then coverage. Stable, like Python's sorted.
 */
export function ranked(stories: PoolStory[]): PoolStory[] {
  const imp = (s: PoolStory) => s.importance || 0;
  // Breadth counts on top of the editor's rating: up to +8 for five or more outlets.
  const score = (s: PoolStory) => (imp(s) ? imp(s) + 2 * (Math.min(s.source_count, 5) - 1) : 0);
  return [...stories].sort((a, b) =>
    score(b) - score(a)
    || (imp(b) ? b.source_count : 0) - (imp(a) ? a.source_count : 0)
    || verdictRank(b) - verdictRank(a)
    || b.source_count - a.source_count
    || b.coverage - a.coverage);
}

function isStrong(story: PoolStory): boolean {
  return story.importance == null || story.importance >= MIN_IMPORTANCE;
}

function isWanted(story: PoolStory, wanted: Set<string>): boolean {
  return wanted.has(story.interest_id) || (!!story.lane_detail && wanted.has(story.lane_detail));
}

export function selectFromGroups(
  groups: PoolStory[],
  interests: string[],
  count: number,
  bucket: Bucket,
): Section[] {
  let primary: PoolStory[];
  let secondary: PoolStory[];
  const wanted = new Set(interests.map((i) => i.trim().toLowerCase()).filter(Boolean));
  if (wanted.size > 0) {
    // A story folded out of a thin lane still belongs to readers who picked it.
    primary = ranked(groups.filter((g) => isWanted(g, wanted)));
    secondary = ranked(groups.filter((g) => !isWanted(g, wanted)));
  } else {
    primary = ranked(groups);
    secondary = [];
  }

  // Below MIN_IMPORTANCE a story only goes out to keep the email at MIN_STORIES.
  const pool = [...primary.filter(isStrong), ...secondary.filter(isStrong)];
  const floor = Math.min(count, MIN_STORIES);
  if (pool.length < floor) {
    const weak = [...primary, ...secondary].filter((g) => !isStrong(g));
    pool.push(...weak.slice(0, floor - pool.length));
  }
  const own = new Set(primary.map((g) => g.topic_id));

  // A company over its cap is out of the pool, except to keep the email at its floor.
  const perCompany = new Map<string, number>();
  const cappedPool: PoolStory[] = [];
  const overflow: PoolStory[] = [];
  let singles = 0;
  for (const g of pool) {
    const company = g.company || '';
    const single = (g.source_count || 1) <= 1 && !g.model_release;
    if ((company && (perCompany.get(company) ?? 0) >= MAX_PER_COMPANY) || (single && singles >= MAX_SINGLE_SOURCE)) {
      overflow.push(g);
      continue;
    }
    perCompany.set(company, (perCompany.get(company) ?? 0) + 1);
    if (single) singles += 1;
    cappedPool.push(g);
  }
  pool.splice(0, pool.length, ...cappedPool, ...overflow.slice(0, Math.max(0, floor - cappedPool.length)));

  const used = new Set<string>();
  const picks: [string, PoolStory][] = [];
  const perLane = new Map<string, number>();
  const take = (group: PoolStory, lane: string) => {
    used.add(group.topic_id);
    picks.push([lane, group]);
    if (lane !== TOP_LANE) perLane.set(lane, (perLane.get(lane) ?? 0) + 1);
  };

  const topSlots = Math.min(TOP_SLOTS[bucket] ?? 0, count <= 5 ? 2 : count);
  // Launches have their own section right below; Top stories are the day's other news.
  pool.filter((g) => own.has(g.topic_id) && !g.model_release)
    .slice(0, topSlots)
    .forEach((g) => take(g, TOP_LANE));

  let releaseSlots = MODEL_RELEASE_SLOTS[bucket] ?? 0;
  // A five-story brief cannot spend two of its slots on launches.
  if (count <= 5) releaseSlots = Math.min(releaseSlots, 1);
  const releases = pool.filter((g) => g.model_release && own.has(g.topic_id) && !used.has(g.topic_id));
  releases.slice(0, Math.max(0, Math.min(releaseSlots, count - picks.length)))
    .forEach((g) => take(g, MODEL_RELEASE_LANE));

  // The reader's own lanes first (caps, then without), and only then other lanes as backfill.
  for (const [mineOnly, capped] of [[true, true], [true, false], [false, true], [false, false]]) {
    for (const group of pool) {
      if (picks.length >= count) break;
      if (mineOnly !== own.has(group.topic_id)) continue;
      // A launch that earns its place on rank still sits with the other launches.
      const lane = group.model_release ? MODEL_RELEASE_LANE : group.interest_id;
      if (used.has(group.topic_id) || (capped && (perLane.get(lane) ?? 0) >= MAX_PER_LANE)) continue;
      take(group, lane);
    }
  }

  if (count >= 8) {
    for (const lane of FLOOR_LANES) {
      if (picks.some(([l]) => l === lane)) continue;
      const floorPick = primary.find((g) => g.interest_id === lane && !used.has(g.topic_id)
        && (g.importance ?? 0) >= FLOOR_IMPORTANCE);
      if (!floorPick) continue;
      const counts = new Map<string, number>();
      for (const [l] of picks) counts.set(l, (counts.get(l) ?? 0) + 1);
      const victims = picks
        .map(([l], i) => ({ l, i }))
        .filter(({ l }) => l !== TOP_LANE && l !== MODEL_RELEASE_LANE && (counts.get(l) ?? 0) >= 2)
        .map(({ i }) => i);
      if (!victims.length) continue;
      // The weakest; on a tie the later one (Python: min by (importance, -index)).
      const i = victims.reduce((best, j) => {
        const a = picks[j][1].importance ?? 0;
        const b = picks[best][1].importance ?? 0;
        return a < b || (a === b && j > best) ? j : best;
      });
      if ((picks[i][1].importance ?? 0) > (floorPick.importance ?? 0)) continue; // never push out a higher-rated story
      used.delete(picks[i][1].topic_id);
      used.add(floorPick.topic_id);
      picks[i] = [lane, floorPick];
    }
  }

  const lead: string[] = [TOP_LANE, MODEL_RELEASE_LANE, ...LANE_ORDER];
  const rank = (lane: string) => (lead.includes(lane) ? lead.indexOf(lane) : lead.length);
  // Top stories and launches first; after them, the section with the most important story.
  const head = (lane: string) => (lane === TOP_LANE || lane === MODEL_RELEASE_LANE ? lead.indexOf(lane) : 2);
  const best = (lane: string) => Math.max(...picks.filter(([l]) => l === lane).map(([, g]) => g.importance ?? 0));
  const lanes = [...new Set(picks.map(([lane]) => lane))]
    .sort((a, b) => head(a) - head(b) || best(b) - best(a) || rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  return lanes.map((lane) => [lane, picks.filter(([l]) => l === lane).map(([, g]) => g)] as Section);
}
