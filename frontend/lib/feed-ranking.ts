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
  /**
   * Stable seed (e.g. userId + date). Same seed -> same order, different
   * seeds -> different lane order and small score jitter, so the feed feels
   * fresh day to day without churning within a session.
   */
  seed?: string;
  /** Set false for the legacy pure score order. */
  diversify?: boolean;
};

export const ROLE_PRIMARY_INTERESTS: Record<string, string[]> = {
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

function fnv1a(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(items: T[], rand: () => number): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
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
  const rand = diversify && options.seed ? mulberry32(fnv1a(options.seed)) : null;

  const rows = stories.map((story, index) => ({
    story,
    index,
    lane: story.cat || 'other',
    score:
      (story.sources?.length || 0) +
      storyBoost(story.cat, interests, roleInterests) +
      (rand ? rand() * 0.9 : 0),
  }));

  if (!diversify) {
    return rows
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.story.ts || 0) - (a.story.ts || 0) ||
          (a.story.rank || Number.MAX_SAFE_INTEGER) - (b.story.rank || Number.MAX_SAFE_INTEGER) ||
          a.index - b.index,
      )
      .map((row) => row.story);
  }

  const byLane = new Map<string, typeof rows>();
  const laneBest = new Map<string, number>();
  for (const row of rows) {
    const list = byLane.get(row.lane) || [];
    list.push(row);
    byLane.set(row.lane, list);
    laneBest.set(row.lane, Math.max(laneBest.get(row.lane) ?? -Infinity, row.score));
  }
  for (const list of byLane.values()) {
    list.sort(
      (a, b) =>
        b.score - a.score ||
        (b.story.ts || 0) - (a.story.ts || 0) ||
        (a.story.rank || Number.MAX_SAFE_INTEGER) - (b.story.rank || Number.MAX_SAFE_INTEGER) ||
        a.index - b.index,
    );
  }

  // Lanes the reader chose come first (seeded order so the lead lane varies),
  // then role-primary lanes, then every other lane by its best story.
  const chosenLanes = [...new Set(interests)];
  if (rand) shuffleInPlace(chosenLanes, rand);
  const tailLanes = [...byLane.keys()]
    .filter((lane) => !chosenLanes.includes(lane) && !roleInterests.includes(lane))
    .sort(
      (a, b) => (laneBest.get(b) ?? -Infinity) - (laneBest.get(a) ?? -Infinity) ||
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
