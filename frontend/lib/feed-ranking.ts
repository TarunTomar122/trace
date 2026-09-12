// Profile-aware story ranking for the web feed. Ordering only — the same
// global stories are shown, but interest matches and role-primary topics
// float up. Kept pure so it can be unit-tested and reused.

export type SortableStory = {
  cat: string;
  ts: number;
  sources: string[];
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

export function rankStoriesForProfile<T extends SortableStory>(
  stories: T[],
  profile: { interests?: string[] | null; role?: string | null },
): T[] {
  const interests = profile.interests || [];
  const roleInterests = rolePrimaryInterests(profile.role);
  return stories
    .map((story, index) => ({
      story,
      index,
      score: (story.sources?.length || 0) + storyBoost(story.cat, interests, roleInterests),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.story.ts || 0) - (a.story.ts || 0) ||
        a.index - b.index,
    )
    .map((row) => row.story);
}
