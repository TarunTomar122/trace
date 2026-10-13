/**
 * Same-story detection for feed list items. The character ratio is difflib's,
 * as in backend/v3/lib/diversity.py, but here it also needs a shared word.
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'in', 'is',
  'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'what', 'when', 'where',
  'who', 'why', 'with',
]);

const BROAD_TOPIC_TOKENS = new Set([
  'war', 'conflict', 'crisis', 'election', 'politics', 'government', 'military',
  'market', 'markets', 'stocks', 'economy',
]);

// Words that say nothing about which story it is.
const FILLER_TOKENS = new Set(['update', 'updates', 'news', 'latest']);

const TRENDING_SIMILARITY_THRESHOLD = 0.58;
// One shared word is often just the company: "OpenAI Raises $40B" vs "OpenAI Releases GPT-6".
const ONE_WORD_SIMILARITY_THRESHOLD = 0.7;

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, ' ').trim();
}

function storyTokens(title: string): Set<string> {
  const cleaned = normalizeTitle(title).replace(/[^a-z0-9\s]/g, ' ');
  const tokens: string[] = [];
  for (const token of cleaned.split(/\s+/)) {
    if (token.length < 4) continue;
    if (STOPWORDS.has(token) || BROAD_TOPIC_TOKENS.has(token) || FILLER_TOKENS.has(token)) continue;
    tokens.push(token);
  }
  return new Set(tokens);
}

/** Characters in matching blocks: longest common run, then each side of it. */
function matchingChars(a: string, b: string): number {
  let prev = new Uint16Array(b.length + 1);
  let curr = new Uint16Array(b.length + 1);
  // Row slot j + 1 holds the run ending at b[j]; slot b0 is the zero edge.
  const count = (a0: number, a1: number, b0: number, b1: number): number => {
    if (a0 >= a1 || b0 >= b1) return 0;
    prev.fill(0, b0, b1 + 1);
    curr[b0] = 0;
    let best = 0;
    let aStart = a0;
    let bStart = b0;
    for (let i = a0; i < a1; i++) {
      const ch = a.charCodeAt(i);
      for (let j = b0; j < b1; j++) {
        const run = ch === b.charCodeAt(j) ? prev[j] + 1 : 0;
        curr[j + 1] = run;
        if (run > best) {
          best = run;
          aStart = i - run + 1;
          bStart = j - run + 1;
        }
      }
      [prev, curr] = [curr, prev];
    }
    if (!best) return 0;
    return best + count(a0, aStart, b0, bStart) + count(aStart + best, a1, bStart + best, b1);
  };
  return count(0, a.length, 0, b.length);
}

/** difflib's SequenceMatcher ratio, as the backend uses. */
function sequenceSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return (2 * matchingChars(na, nb)) / (na.length + nb.length);
}

export function isSameStoryTitle(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  if (normalizeTitle(a) === normalizeTitle(b)) return true;

  const ct = storyTokens(a);
  const kt = storyTokens(b);
  if (ct.size === 0 || kt.size === 0) return false;

  let shared = 0;
  for (const token of ct) {
    if (kt.has(token)) shared += 1;
  }
  // Without a shared word, look-alike spelling is chance: "Soon and Anthropic"
  // and "Seed and Bytedance" match on " and " alone.
  if (!shared) return false;
  const threshold = shared === 1 ? ONE_WORD_SIMILARITY_THRESHOLD : TRENDING_SIMILARITY_THRESHOLD;
  if (sequenceSimilarity(a, b) >= threshold) return true;
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
