// Profile-aware story ranking for the web feed. Ordering only — the same
// global stories are shown, but interest matches and role-primary topics
// float up, and stories are interleaved across the reader's chosen lanes so
// For You never reads like a single-topic feed. Kept pure so it can be
// unit-tested and reused.

export type SortableStory = {
  cat: string;
  ts: number;
  sources: string[];
  /** Backend rank used only as a stable tie-break after personalization. */
  rank?: number;
};

export type RankOptions = {
  /** Set false to skip lane interleaving. */
  diversify?: boolean;
};

export const ROLE_PRIMARY_INTERESTS: Record<string, string[]> = {
  developer: ['engineering', 'tech', 'ai'],
  engineer: ['engineering', 'tech', 'ai'],
  designer: ['ux-design', 'products'],
  pm: ['products', 'startups', 'markets'],
  founder: ['startups', 'markets', 'products'],
  investor: ['markets', 'startups'],
  student: ['engineering', 'ai', 'tech'],
};

export function rolePrimaryInterests(role?: string | null): string[] {
  return ROLE_PRIMARY_INTERESTS[(role || '').toLowerCase()] || [];
}

// Interest matches should visibly float above the raw coverage order, while
// role-primary topics get a lighter nudge. Coverage (source count) still
// breaks ties inside each band.
export function storyBoost(cat: string, interests: string[], roleInterests: string[]): number {
  if (interests.includes(cat)) return roleInterests.includes(cat) ? 5 : 4;
  return roleInterests.includes(cat) ? 2 : 0;
}

export function rankStoriesForProfile<T extends SortableStory>(
  stories: T[],
  profile: { interests?: string[] | null; role?: string | null },
  options: RankOptions = {},
): T[] {
  const interests = (profile.interests || []).filter(Boolean);
  const roleInterests = rolePrimaryInterests(profile.role).filter(
    (cat) => !interests.includes(cat),
  );
  const diversify = options.diversify !== false;

  const rows = stories.map((story, index) => ({
    story,
    index,
    lane: story.cat || 'other',
    score:
      (story.sources?.length || 0) +
      storyBoost(story.cat, interests, roleInterests),
  }));

  const byRank = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    (a.story.rank || Number.MAX_SAFE_INTEGER) - (b.story.rank || Number.MAX_SAFE_INTEGER);

  // Without a profile, “Top” should be the backend Jev order, not a seeded
  // client shuffle. Coverage and recency remain safe fallbacks for old data.
  if (interests.length === 0 && roleInterests.length === 0) {
    return rows
      .sort((a, b) => byRank(a, b) || b.score - a.score || (b.story.ts || 0) - (a.story.ts || 0) || a.index - b.index)
      .map((row) => row.story);
  }

  if (!diversify) {
    return rows
      .sort(
        (a, b) =>
          b.score - a.score ||
          byRank(a, b) ||
          (b.story.ts || 0) - (a.story.ts || 0) ||
          a.index - b.index,
      )
      .map((row) => row.story);
  }

  const byLane = new Map<string, typeof rows>();
  const laneBest = new Map<string, number>();
  const laneRank = new Map<string, number>();
  for (const row of rows) {
    const list = byLane.get(row.lane) || [];
    list.push(row);
    byLane.set(row.lane, list);
    laneBest.set(row.lane, Math.max(laneBest.get(row.lane) ?? -Infinity, row.score));
    laneRank.set(row.lane, Math.min(laneRank.get(row.lane) ?? Number.MAX_SAFE_INTEGER, row.story.rank || Number.MAX_SAFE_INTEGER));
  }
  for (const list of byLane.values()) {
    list.sort(
      (a, b) =>
        b.score - a.score ||
        byRank(a, b) ||
        (b.story.ts || 0) - (a.story.ts || 0) ||
        a.index - b.index,
    );
  }

  // Lanes the reader chose come first, then role-primary lanes, then every
  // other lane. Coverage chooses the lane; Jev rank breaks coverage ties.
  const chosenLanes = [...new Set(interests)].sort(
    (a, b) => (laneBest.get(b) ?? -Infinity) - (laneBest.get(a) ?? -Infinity) ||
      (laneRank.get(a) ?? Number.MAX_SAFE_INTEGER) - (laneRank.get(b) ?? Number.MAX_SAFE_INTEGER) ||
      a.localeCompare(b),
  );
  const tailLanes = [...byLane.keys()]
    .filter((lane) => !chosenLanes.includes(lane) && !roleInterests.includes(lane))
    .sort(
      (a, b) => (laneBest.get(b) ?? -Infinity) - (laneBest.get(a) ?? -Infinity) ||
        (laneRank.get(a) ?? Number.MAX_SAFE_INTEGER) - (laneRank.get(b) ?? Number.MAX_SAFE_INTEGER) ||
        a.localeCompare(b),
    );
  const laneOrder = [...chosenLanes, ...roleInterests, ...tailLanes];

  // Round-robin one story per lane, so the top of For You alternates lanes
  // instead of stacking whichever topic has the most coverage.
  const out: T[] = [];
  let remaining = rows.length;
  for (let depth = 0; remaining > 0; depth += 1) {
    let progressed = false;
    for (const lane of laneOrder) {
      const list = byLane.get(lane);
      if (!list || depth >= list.length) continue;
      out.push(list[depth].story);
      remaining -= 1;
      progressed = true;
    }
    if (!progressed) break;
  }
  return out;
}
