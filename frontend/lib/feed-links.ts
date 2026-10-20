// Shareable feed lane links: /feed?tab=markets (or the friendly alias
// /feed?q=market). Kept dependency-free so it can be unit-tested.

export const FEED_TAB_LABELS: Record<string, string> = {
  ai: 'AI',
  markets: 'Markets',
  tech: 'Tech',
  'ux-design': 'Design',
  startups: 'Startups',
  robotics: 'Robotics',
  conversations: 'Top articles',
};

const FEED_TAB_ALIASES: Record<string, string> = {
  all: 'all',
  home: 'all',
  feed: 'all',
  latest: 'all',
  ai: 'ai',
  'artificial-intelligence': 'ai',
  market: 'markets',
  markets: 'markets',
  finance: 'markets',
  'us-markets': 'markets',
  stock: 'markets',
  stocks: 'markets',
  tech: 'tech',
  technology: 'tech',
  design: 'ux-design',
  ux: 'ux-design',
  'ux-design': 'ux-design',
  'product-design': 'ux-design',
  startup: 'startups',
  startups: 'startups',
  venture: 'startups',
  robotics: 'robotics',
  robot: 'robotics',
  robots: 'robotics',
  humanoid: 'robotics',
  humanoids: 'robotics',
  'physical-ai': 'robotics',
  'self-driving': 'robotics',
  robotaxi: 'robotics',
  robotaxis: 'robotics',
  'autonomous-vehicles': 'robotics',
  drones: 'robotics',
  'embodied-ai': 'robotics',
  // Engineering was retired as a lane; its stories now sit in Tech.
  engineering: 'tech',
  security: 'security',
  bookmarks: 'bookmarks',
  saved: 'bookmarks',
  profile: 'profile',
  conversations: 'conversations',
  pulse: 'conversations',
  discussion: 'conversations',
  discussions: 'conversations',
  reading: 'conversations',
  'worth-reading': 'conversations',
  blogs: 'conversations',
  hn: 'conversations',
  'top-hn': 'conversations',
  tophn: 'conversations',
  'hacker-news': 'conversations',
  hackernews: 'conversations',
  articles: 'conversations',
  'top-articles': 'conversations',
};

// Own keys only: a URL value like "constructor" must not hit Object.prototype.
function lookup(map: Record<string, string>, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

/**
 * Normalize a URL value (tab or q) into an internal feed tab id.
 * Unknown values fall back to `all` when the set of available categories is
 * known, so a stale shared link never opens an empty feed.
 */
export function normalizeFeedTab(
  value?: string | null,
  availableCats?: Iterable<string> | null,
): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'all';
  const mapped = lookup(FEED_TAB_ALIASES, raw) || raw;
  if (mapped === 'profile' || mapped === 'bookmarks' || mapped === 'all' || mapped === 'conversations') {
    return mapped;
  }
  if (availableCats) {
    for (const cat of availableCats) {
      if (cat === mapped) return mapped;
    }
    return 'all';
  }
  return mapped;
}

// Lanes Trace no longer publishes, and where their stories live now. Archived
// days still carry them, so the feed must not grow a tab for a retired lane.
const RETIRED_LANES: Record<string, string> = {
  engineering: 'tech',
};

/** A story's lane as the feed shows it today; missing means tech. */
export function canonicalLane(lane?: string | null): string {
  const value = String(lane || '').trim().toLowerCase();
  if (!value) return 'tech';
  return lookup(RETIRED_LANES, value) || value;
}

/** Human label for a lane slug, used in metadata for shared links. */
export function feedTabLabel(tab: string): string {
  return lookup(FEED_TAB_LABELS, tab) || 'Top';
}

/**
 * Split the available lanes into the reader's chosen ones (in their profile
 * order) and the rest. Home is built from `mine`; the rail shows `mine`
 * first and files `others` under a group label.
 */
export function partitionFeedCats(
  cats: string[],
  interests: string[] | null | undefined,
): { mine: string[]; others: string[] } {
  const selected = (interests || []).filter((cat) => cats.includes(cat));
  return {
    mine: selected,
    others: cats.filter((cat) => !selected.includes(cat)),
  };
}
