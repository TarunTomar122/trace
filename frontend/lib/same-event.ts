/**
 * Same-event detection for live-feed topics. The feed can carry one event as
 * several topics ("Meta Unveils Muse Wonder AI Models" / "Meta Introduces Muse
 * Wonder AI Model"); different events often share Title Case words ("OpenAI
 * Raises $40 Billion" / "Anthropic Raises $13 Billion"), so a shared word or
 * two is not enough. Two titles are one event when they lead with the same
 * entity and most of their meaningful words match.
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by', 'from',
  'as', 'is', 'are', 'its', 'it', 'this', 'that', 'new', 'now', 'how', 'why', 'what', 'who', 'after',
  'over', 'into', 'up', 'says', 'say', 'will', 'can', 'has', 'have', 'be',
  // launch verbs: the same event is reported as "unveils", "launches", ...
  'unveil', 'unveils', 'unveiled', 'launch', 'launches', 'launched', 'introduce', 'introduces',
  'introduced', 'release', 'releases', 'released', 'announce', 'announces', 'announced', 'debut',
  'debuts', 'ship', 'ships', 'reveal', 'reveals', 'rolls', 'out',
]);

function stem(word: string): string {
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

export function titleTokens(title: string): string[] {
  return (title.toLowerCase().match(/[a-z0-9][a-z0-9.+-]*/g) || [])
    .map((word) => word.replace(/[.+-]+$/, ''))
    .filter((word) => word && !STOPWORDS.has(word))
    .map(stem);
}

export function sameEvent(a: string, b: string): boolean {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.length < 2 || tb.length < 2 || ta[0] !== tb[0]) return false;
  const setA = new Set(ta);
  const setB = new Set(tb);
  const shared = [...setA].filter((word) => setB.has(word)).length;
  const union = new Set([...setA, ...setB]).size;
  return shared >= 3 && shared / union >= 0.5;
}
