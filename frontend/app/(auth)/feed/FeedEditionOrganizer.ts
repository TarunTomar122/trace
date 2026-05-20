import type { FeedListItem } from './FeedUi';
import { INTEREST_LABEL } from './FeedUi';

/** Section display order: ai → startups → markets → everything else → tech last. */
const DEFAULT_INTEREST_ORDER = [
  'ai',
  'startups',
  'markets',
  'engineering',
  'ux-design',
  'products',
  'the-world',
  'tech',
] as const;

const SECTION_INTEREST_RANK: Record<string, number> = {
  ai: 0,
  startups: 10,
  markets: 20,
  engineering: 30,
  'ux-design': 40,
  design: 40,
  products: 45,
  'the-world': 50,
  tech: 1000,
};

function sectionInterestRank(id: string): number {
  return SECTION_INTEREST_RANK[id] ?? 100;
}

function sortInterestIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => sectionInterestRank(a) - sectionInterestRank(b));
}

export function normalizeInterestOrder(interestOrder: string[]): string[] {
  const base = interestOrder.length > 0 ? interestOrder : [...DEFAULT_INTEREST_ORDER];
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of base) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  return sortInterestIds(ordered);
}
/** Minimum stories in an interest lane to render its own section (not Latest). */
export const SECTION_MIN_STORIES = 2;
const HERO_SIDEBAR_COUNT = 2;

export type EditionHero = {
  lead: FeedListItem;
  sidebar: FeedListItem[];
};

export type EditionSection = {
  interestId: string;
  label: string;
  stories: FeedListItem[];
};

export type EditionFeed = {
  hero: EditionHero | null;
  sections: EditionSection[];
  latest: FeedListItem[];
  totalCount: number;
  readMinutes: number;
};

function matchesInterest(item: FeedListItem, interestId: string): boolean {
  if (item.interestId === interestId) return true;
  return item.tags?.includes(interestId) ?? false;
}

function interestLabel(id: string): string {
  return INTEREST_LABEL[id] ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function storyTimestamp(item: FeedListItem): number {
  if (!item.timestamp) return 0;
  const ts = new Date(item.timestamp).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function sortByRecency(items: FeedListItem[]): FeedListItem[] {
  return [...items].sort((a, b) => storyTimestamp(b) - storyTimestamp(a));
}

function estimateReadMinutes(count: number): number {
  return Math.max(3, Math.min(12, Math.round(count * 0.12)));
}

function collectInterestIds(
  storyList: FeedListItem[],
  interestOrder: string[],
): string[] {
  const seen = new Set<string>();
  const ordered = normalizeInterestOrder(interestOrder);
  for (const id of ordered) seen.add(id);

  for (const item of storyList) {
    const id = item.interestId ?? item.tags?.[0];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  return sortInterestIds(ordered);
}

/** News-only edition layout (trending / topics / for_you). Pulse is excluded. */
export function organizeEditionFeed(
  storyList: FeedListItem[],
  interestOrder: string[],
): EditionFeed {
  const usedIds = new Set<string>();
  const markUsed = (items: FeedListItem[]) => {
    for (const item of items) usedIds.add(item.id);
  };
  const available = (items: FeedListItem[]) =>
    sortByRecency(items.filter((item) => !usedIds.has(item.id)));

  const sortedNews = sortByRecency(storyList);
  let hero: EditionHero | null = null;

  if (sortedNews.length > 0) {
    const lead = sortedNews[0];
    const sidebar = sortedNews.slice(1, 1 + HERO_SIDEBAR_COUNT);
    markUsed([lead, ...sidebar]);
    hero = { lead, sidebar };
  }

  const sections: EditionSection[] = [];
  const latest: FeedListItem[] = [];
  const interestIds = collectInterestIds(sortedNews, interestOrder);

  for (const interestId of interestIds) {
    const pool = available(
      sortedNews.filter((item) => matchesInterest(item, interestId)),
    );
    if (pool.length === 0) continue;

    if (pool.length >= SECTION_MIN_STORIES) {
      markUsed(pool);
      sections.push({
        interestId,
        label: interestLabel(interestId).toUpperCase(),
        stories: pool,
      });
    } else {
      markUsed(pool);
      latest.push(...pool);
    }
  }

  latest.push(...available(sortedNews));

  const dedupedLatest = sortByRecency(
    latest.filter((item, index, arr) => arr.findIndex((entry) => entry.id === item.id) === index),
  );

  const totalCount = storyList.length;

  return {
    hero,
    sections,
    latest: dedupedLatest,
    totalCount,
    readMinutes: estimateReadMinutes(totalCount),
  };
}
