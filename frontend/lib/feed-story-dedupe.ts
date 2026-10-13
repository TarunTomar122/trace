/** Same-story detection for feed list items (mirrors backend/v3/lib/diversity.py). */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'in', 'is',
  'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'what', 'when', 'where',
  'who', 'why', 'with',
]);

const BROAD_TOPIC_TOKENS = new Set([
  'war', 'conflict', 'crisis', 'election', 'politics', 'government', 'military',
  'market', 'markets', 'stocks', 'economy',
]);

const TRENDING_SIMILARITY_THRESHOLD = 0.58;

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, ' ').trim();
}

function storyTokens(title: string): Set<string> {
  const cleaned = normalizeTitle(title).replace(/[^a-z0-9\s]/g, ' ');
  const tokens: string[] = [];
  for (const token of cleaned.split(/\s+/)) {
    if (token.length < 4) continue;
    if (STOPWORDS.has(token) || BROAD_TOPIC_TOKENS.has(token)) continue;
    tokens.push(token);
  }
  return new Set(tokens);
}

function sequenceSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  let matches = 0;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  const windowSize = Math.max(3, Math.floor(shorter.length * 0.15));

  for (let i = 0; i <= shorter.length - windowSize; i++) {
    if (longer.includes(shorter.slice(i, i + windowSize))) {
      matches += windowSize;
    }
  }

  return (2 * matches) / (na.length + nb.length);
}

export function isSameStoryTitle(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;

  const similarity = sequenceSimilarity(a, b);
  if (similarity >= TRENDING_SIMILARITY_THRESHOLD) return true;

  const ct = storyTokens(a);
  const kt = storyTokens(b);
  if (ct.size === 0 || kt.size === 0) return false;

  let shared = 0;
  for (const token of ct) {
    if (kt.has(token)) shared += 1;
  }
  if (shared < 2) return false;

  const overlap = shared / Math.max(1, Math.min(ct.size, kt.size));
  return overlap >= 0.5;
}

export function dedupeByStoryTitle<T extends { title: string }>(items: T[]): T[] {
  const kept: T[] = [];
  const keptTitles: string[] = [];

  for (const item of items) {
    const title = item.title?.trim();
    if (!title) continue;

    if (keptTitles.some((existing) => isSameStoryTitle(title, existing))) {
      continue;
    }

    kept.push(item);
    keptTitles.push(title);
  }

  return kept;
}
