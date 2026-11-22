// Which pages Google should index (2026-11-22 recovery after the September spam update): one
// strong page per topic, and nothing templated or off-topic. Pages left out here still render and
// still pass links on (noindex, follow) but stay out of the sitemap.

/** Compare pages that say something a reader can't get from a blog comparison. */
export const INDEXED_COMPARE_SLUGS = new Set([
  'trace-vs-inoreader',
  'trace-vs-google-news',
  'trace-vs-readwise-reader',
  'ai-news-aggregator',
  'hacker-news-digest',
]);

export const NOINDEX_ROBOTS = { index: false, follow: true } as const;
