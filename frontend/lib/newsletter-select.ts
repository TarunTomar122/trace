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
};

export type Bucket = 'member' | 'winback' | 'landing';
export type Section = [lane: string, stories: PoolStory[]];

export const MODEL_RELEASE_LANE = 'model-releases';
export const LANE_ORDER = [
  'ai', 'robotics', 'markets', 'tech', 'startups', 'ux-design',
  'products', 'the-world',
] as const;
const LANE_PATTERN: Record<Bucket, number[]> = {
  member: [3, 2, 2, 1, 1, 1],
  winback: [3, 2, 2, 1, 1, 1],
  landing: [2, 2, 1],
};
const MODEL_RELEASE_SLOTS: Record<Bucket, number> = { member: 2, winback: 2, landing: 1 };
const FULL_DISPLAY_ORDER = [MODEL_RELEASE_LANE, 'ai', 'robotics', 'markets', 'tech', 'startups', 'ux-design'];

function verdictRank(story: PoolStory): number {
  return typeof story.send_worthy === 'number' ? story.send_worthy : 1;
}

/** Jev's verdict first, then multi-source coverage. Stable, like Python's sorted. */
export function ranked(stories: PoolStory[]): PoolStory[] {
  return [...stories].sort((a, b) =>
    verdictRank(b) - verdictRank(a)
    || b.source_count - a.source_count
    || b.coverage - a.coverage);
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
  let lanes: string[];
  const wanted = new Set(interests.map((i) => i.trim().toLowerCase()).filter(Boolean));
  if (wanted.size > 0) {
    // A story folded out of a thin lane still belongs to readers who picked it.
    primary = groups.filter((g) => isWanted(g, wanted));
    secondary = groups.filter((g) => !isWanted(g, wanted));
    lanes = LANE_ORDER.filter((lane) => wanted.has(lane));
  } else {
    primary = [...groups];
    secondary = [];
    lanes = [...LANE_ORDER];
  }

  const ordered = ranked(primary);
  const used = new Set<string>();
  let sections: Section[] = [];

  let releaseSlots = MODEL_RELEASE_SLOTS[bucket] ?? 0;
  if (count <= 5) releaseSlots = Math.min(releaseSlots, 1);
  if (releaseSlots) {
    const releases = ordered.filter((g) => g.model_release).slice(0, releaseSlots);
    if (releases.length) {
      releases.forEach((g) => used.add(g.topic_id));
      sections.push([MODEL_RELEASE_LANE, releases]);
    }
  }

  let remaining = count - sections.reduce((sum, [, stories]) => sum + stories.length, 0);

  const pattern = LANE_PATTERN[bucket] ?? [];
  for (const [position, lane] of lanes.entries()) {
    if (remaining <= 0) break;
    const quota = Math.min(position < pattern.length ? pattern[position] : 1, remaining);
    if (quota <= 0) continue;
    let laneItems = ordered.filter((g) => g.interest_id === lane && !used.has(g.topic_id));
    // Markets means the overall market: macro stories first.
    if (lane === 'markets') laneItems = [...laneItems].sort((a, b) => Number(!a.macro) - Number(!b.macro));
    laneItems = laneItems.slice(0, quota);
    if (!laneItems.length) continue;
    laneItems.forEach((g) => used.add(g.topic_id));
    sections.push([lane, laneItems]);
    remaining -= laneItems.length;
  }

  // Backfill any unfilled slots from the remaining lanes in priority order.
  if (remaining > 0) {
    const byLane = new Map<string, PoolStory[]>();
    for (const g of [...ordered, ...ranked(secondary)]) {
      if (used.has(g.topic_id)) continue;
      if (!byLane.has(g.interest_id)) byLane.set(g.interest_id, []);
      byLane.get(g.interest_id)!.push(g);
    }
    const known = new Set<string>(LANE_ORDER);
    const laneOrder = [
      ...LANE_ORDER.filter((lane) => byLane.has(lane)),
      ...[...byLane.keys()].filter((lane) => !known.has(lane)).sort(),
    ];
    for (const lane of laneOrder) {
      if (remaining <= 0) break;
      const got = (byLane.get(lane) ?? []).slice(0, remaining);
      if (got.length) {
        got.forEach((g) => used.add(g.topic_id));
        sections.push([lane, got]);
        remaining -= got.length;
      }
    }
  }

  // Backfill can reopen a lane the pattern already used; one heading per
  // lane reads better than "Top in AI" twice.
  const merged = new Map<string, PoolStory[]>();
  for (const [lane, stories] of sections) merged.set(lane, [...(merged.get(lane) ?? []), ...stories]);
  sections = [...merged.entries()];

  if (bucket === 'member' || bucket === 'winback') {
    const displayOrder = new Map(FULL_DISPLAY_ORDER.map((lane, index) => [lane, index]));
    sections.sort((a, b) =>
      (displayOrder.get(a[0]) ?? displayOrder.size) - (displayOrder.get(b[0]) ?? displayOrder.size));
  }
  return sections;
}
