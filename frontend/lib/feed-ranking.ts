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
  title?: string;
  tags?: string[];
  source?: string;
  body?: string;
};

const MODEL_RELEASE_SKIP = /\b(misalignment|jailbreak|incident|incidents|lawsuit|job loss)\b/i;
// Parameter counts ("70B model") only — never dollar amounts ("$9.2B project").
const MODEL_PARAM_SIZE = /(?<![$\d.,])\b\d+(?:\.\d+)?\s*b\b/i;
const MODEL_NOUN = /\b(model|llm|foundation model|open[- ]weights?|checkpoint)\b/i;
const MODEL_RELEASE_VERB = /\b(releases?|released|launches?|launched|unveils?|unveiled|ships?|shipped|introduces?|introduced|open[- ]sourc(?:e|ed|ing))\b/i;
// "model" alone is too generic (Tesla Model Y), so a textual match also needs
// an AI-flavoured word next to it.
const AI_CONTEXT = /\b(ai|a\.i\.|llm|weights?|tokens?|context|inference|benchmarks?|parameters?|multimodal|agents?|agentic|reasoning|coding|prompts?|checkpoints?|open[- ]weights?)\b/i;
// Named launches that never say "model": "releases Qwen3.8", "unveils Claude Opus 5".
const NAMED_LAUNCH = /\b(releases?|released|launches?|launched|unveils?|unveiled|ships?|shipped|introduces?|introduced)\s+(?:[A-Z][\w.-]*\d[\w.-]*|(?:[A-Z][\w.-]*\s+){1,3}\d+(?:\.\d+)?)\b/;

/** Lab-blog / param-size launches, not AI-safety or incident coverage. */
export function isModelRelease(story: {
  title?: string;
  tags?: string[];
  source?: string;
  body?: string;
}): boolean {
  const title = String(story.title || '');
  const haystack = `${title} ${(story.tags || []).join(' ')} ${story.body || ''}`;
  if (MODEL_RELEASE_SKIP.test(haystack)) return false;
  if (/ai\/?tldr/i.test(String(story.source || ''))) return true;
  if (MODEL_PARAM_SIZE.test(title)) return true;
  const textual = NAMED_LAUNCH.test(title)
    || (MODEL_NOUN.test(haystack) && MODEL_RELEASE_VERB.test(title));
  return textual && AI_CONTEXT.test(haystack);
}

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
    personal: storyBoost(story.cat, interests, roleInterests),
    model: isModelRelease(story) ? 1 : 0,
    coverage: story.sources?.length || 0,
    score:
      (story.sources?.length || 0) +
      storyBoost(story.cat, interests, roleInterests),
  }));

  const byRank = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    (a.story.rank || Number.MAX_SAFE_INTEGER) - (b.story.rank || Number.MAX_SAFE_INTEGER);
  const byRecency = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    (b.story.ts || 0) - (a.story.ts || 0);
  // Model launches sit above same-band coverage noise, then Jev rank / recency.
  const byPriority = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    b.personal - a.personal ||
    b.model - a.model ||
    b.coverage - a.coverage ||
    byRank(a, b) ||
    byRecency(a, b) ||
    a.index - b.index;

  // Without a profile, “Top” follows the backend Jev order, with a light
  // bump so model launches are not buried under multi-source incident clusters.
  if (interests.length === 0 && roleInterests.length === 0) {
    return rows
      .sort((a, b) => b.model - a.model || byRank(a, b) || b.coverage - a.coverage || byRecency(a, b) || a.index - b.index)
      .map((row) => row.story);
  }

  if (!diversify) {
    return rows
      .sort(byPriority)
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
    list.sort(byPriority);
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

/** Random sample from the top of a ranked list — used for a fresh Home For You slice. */
export function sampleStoriesForFeed<T>(ranked: T[], cap: number, poolSize = 30): T[] {
  if (ranked.length <= cap) return [...ranked];
  const pool = ranked.slice(0, Math.min(poolSize, ranked.length));
  const picked = [...pool];
  for (let i = picked.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked.slice(0, cap);
}
