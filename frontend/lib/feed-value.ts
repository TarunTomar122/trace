import type { TrendingTopic } from './firestore';

/**
 * Jev's send-worthiness verdict gate, shared by every surface that renders the
 * trending pool (web feed, mobile feed, Chrome extension, home preview).
 *
 * The pipeline stores `jev_send_worthy` on each topic: 0 means no reader value
 * (puzzle answers, executive appointments, opinion pieces, shopping filler).
 *
 * Kept dependency-free on purpose — importing these from a module that pulls in
 * firebase-admin breaks the plain `node --test` suites.
 */
export function filterSendWorthyTopics<T>(topics: T[] | undefined): T[] {
  return (topics || []).filter(
    (topic) => (topic as { jev_send_worthy?: number | null } | null)?.jev_send_worthy !== 0,
  );
}

/** URLs covered by rejected topics, so flat rows for the same story go too. */
export function rejectedStoryUrls(topics: TrendingTopic[] | undefined): Set<string> {
  const urls = new Set<string>();
  (topics || []).forEach((topic) => {
    if (topic?.jev_send_worthy !== 0) return;
    (topic?.articles || []).forEach((article) => {
      const url = String(article?.url || '').trim();
      if (url) urls.add(url);
    });
  });
  return urls;
}
