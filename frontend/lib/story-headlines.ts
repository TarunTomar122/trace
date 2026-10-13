/** Group distinct topics under a headline when they share a storyline.

Topics are already same-event cards. A headline is 2–3 of those cards that
are one unfolding story. Labels are real news headlines from the LLM (or a member title as
fallback) — never a one-word tag.

TODO: this overlap packer is brittle. It tokenizes titles and merges on
"2 specific nouns" or "company + one 5+ letter noun", which is why two
unrelated Google stories grouped on a shared "they". Come back with a
real storyline signal (embeddings / LLM-only groups / entity+event) instead
of more stopword patches. See also backend/v3/lib/story_headlines.py.
*/

export type Headlineable = {
  id: string;
  title: string;
};

export type HeadlineRef = {
  id: string;
  label: string;
  topicIds: string[];
  relatedIds?: string[];
};

export type FeedRow<T extends Headlineable = Headlineable> =
  | { kind: 'headline'; id: string; label: string; stories: T[]; related: Headlineable[] }
  | { kind: 'story'; story: T };

const MIN_GROUP = 2;
const MAX_GROUP = 3;
const MAX_RELATED = 2;
const MAX_HEADLINES = 6;
const MAX_LABEL = 96;
const MIN_HEADLINE_WORDS = 4;

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'what', 'when', 'where', 'who', 'why', 'with', 'this', 'new', 'says',
  'after', 'over', 'into', 'just', 'more', 'than', 'will', 'can', 'may',
  'has', 'have', 'had', 'not', 'but', 'about', 'up', 'out', 'one', 'two',
  'first', 'latest', 'today', 'report', 'reports', 'update', 'updates',
  'they', 'them', 'their', 'we', 'you', 'he', 'she', 'his', 'her',
  'our', 'your', 'or', 'if', 'so', 'do', 'does', 'did', 'been', 'being',
  'would', 'should', 'could', 'get', 'got', 'then',
  'launch', 'launches', 'launched', 'announce', 'announces', 'announced',
  'release', 'releases', 'released', 'introduces', 'introduced',
  'unveils', 'unveiled', 'reveals', 'revealed', 'enhances', 'enhanced',
  'feature', 'features', 'beta',
]);

/** Company/product names are too weak to be a storyline by themselves. */
const COMPANY_TOKENS = new Set([
  'openai', 'anthropic', 'google', 'meta', 'apple', 'nvidia', 'microsoft',
  'amazon', 'tesla', 'xai', 'huggingface', 'hugging', 'deepmind', 'mistral',
  'claude', 'chatgpt', 'gemini', 'grok', 'copilot', 'siri', 'iphone',
  'android', 'pixel', 'tsmc', 'samsung', 'intel', 'amd',
]);

const GENERIC = new Set(['ai', 'tech', 'app', 'apps', 'model', 'models']);

/** Fine as supporting words, too generic to name a bucket alone. */
const WEAK = new Set([
  'chip', 'chips', 'gpu', 'gpus', 'job', 'jobs', 'million', 'billion',
  'trillion', 'market', 'markets', 'stock', 'stocks', 'deal', 'deals',
  'data', 'cloud', 'server', 'servers', 'tool', 'tools', 'product',
  'products', 'user', 'users', 'company', 'companies', 'startup', 'startups',
  'software', 'hardware', 'platform', 'price', 'prices', 'news', 'raise',
  'raises', 'cut', 'cuts', 'plan', 'plans', 'secure', 'secures', 'secured',
  'expansion', 'expands', 'expanded', 'expand', 'explore', 'explores',
  'call', 'calls', 'take', 'takes', 'learn', 'learns', 'amid', 'insight',
  'insights', 'reject', 'rejects', 'regulation', 'regulations', 'capability',
  'capabilities', 'challenge', 'challenges', 'framework', 'development',
  'media', 'health', 'chief', 'chiefs', 'memory',
  'ban', 'bans', 'production', 'manufacturing', 'agent', 'agents',
]);

const COSTUME_LABELS = new Set([
  'also today', 'more today', 'other news', 'more news', 'the rest',
  'rest of today', 'leftover', 'everything else', 'also', 'today',
]);

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().match(/[a-z0-9]+/g) || []) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue;
    out.add(raw);
    if (raw.length > 4 && raw.endsWith('s') && !raw.endsWith('ss')) {
      out.add(raw.slice(0, -1));
    }
  }
  return out;
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isCostumeLabel(label: string): boolean {
  const normalized = normalizeLabel(label);
  if (!normalized) return true;
  if (COSTUME_LABELS.has(normalized)) return true;
  if (/^(also|more|other|rest|leftover)\b/.test(normalized)) return true;
  return false;
}

/** Newsletter recaps name-drop several stories; they are not a second topic. */
function isDigestTitle(title: string): boolean {
  const text = title.trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  if (/\b(and more|morning squawk|round-?up|wrap-?up|recap|in brief|what we know)\b/.test(lower)) {
    return true;
  }
  return (text.match(/,/g) || []).length >= 2 && /\band\b/i.test(text);
}

function contentTokens(tok: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const word of tok) {
    if (COMPANY_TOKENS.has(word) || GENERIC.has(word)) continue;
    out.add(word);
  }
  return collapseStems(out);
}

function collapseStems(tok: Set<string>): Set<string> {
  const out = new Set(tok);
  for (const word of tok) {
    if (out.has(word) && out.has(`${word}s`)) out.delete(word);
  }
  return out;
}

function uniqueIds(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function wordCount(text: string): number {
  return (text.trim().match(/[a-z0-9]+/gi) || []).length;
}

function isThinLabel(label: string): boolean {
  return wordCount(label) < MIN_HEADLINE_WORDS;
}

function clipHeadline(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= MAX_LABEL) return trimmed;
  const cut = trimmed.slice(0, MAX_LABEL);
  const at = cut.lastIndexOf(' ');
  return (at >= 24 ? cut.slice(0, at) : cut).replace(/[-–—,;:]+$/g, '');
}

function intersect(sets: Set<string>[]): Set<string> {
  if (!sets.length) return new Set();
  const out = new Set(sets[0]);
  for (const next of sets.slice(1)) {
    for (const word of [...out]) {
      if (!next.has(word)) out.delete(word);
    }
  }
  return out;
}

function specificTokens(tok: Set<string>): string[] {
  return [...contentTokens(tok)].filter((word) => !WEAK.has(word));
}

/** Shared tokens that can name a storyline — not a company, not "also news". */
export function sharedStoryTokens(a: Set<string> | string, b: Set<string> | string, _df?: Map<string, number>): Set<string> | null {
  const left = typeof a === 'string' ? tokens(a) : a;
  const right = typeof b === 'string' ? tokens(b) : b;
  const shared = intersect([left, right]);
  const specific = specificTokens(shared);
  const companies = [...shared].filter((word) => COMPANY_TOKENS.has(word));
  // Two specific nouns (safety + evals, quantum + encryption) are a storyline.
  // Company + one specific noun covers the same fundraising round, same model.
  // A single shared word (camera, trump, warn, funding, incidents-in-a-recap)
  // is just a coincidence.
  if (specific.length >= 2) return shared;
  // Company + "they"/"used" is a coincidence. Need a real noun (5+ letters).
  if (companies.length && specific.some((word) => word.length >= 5)) return shared;
  return null;
}

/** Fallback when the LLM is missing: use a real title, never a 1–2 word tag. */
function labelFromTitles(titles: string[]): string {
  const usable = titles
    .map((title) => clipHeadline(title))
    .filter((title) => !isThinLabel(title) && !isCostumeLabel(title));
  if (!usable.length) return '';
  return [...usable].sort((a, b) => a.length - b.length)[0] || '';
}

function documentFrequency<T extends Headlineable>(pool: T[], tokenMap: Map<string, Set<string>>): Map<string, number> {
  const df = new Map<string, number>();
  for (const topic of pool) {
    for (const word of tokenMap.get(topic.id) || []) {
      df.set(word, (df.get(word) || 0) + 1);
    }
  }
  return df;
}

/** A headline has to be sayable from the cards — not a costume. */
export function headlineGrounded(label: string, titles: string[]): boolean {
  const trimmed = label.trim();
  if (!trimmed || titles.length < MIN_GROUP) return false;
  if (isCostumeLabel(trimmed) || isThinLabel(trimmed) || isDigestTitle(trimmed)) return false;
  if (titles.some((title) => isDigestTitle(title))) return false;

  const labelTok = tokens(trimmed);
  if (!specificTokens(labelTok).length) return false;

  const supports = titles.map((title) => {
    const overlap = new Set<string>();
    for (const word of tokens(title)) {
      if (labelTok.has(word)) overlap.add(word);
    }
    return overlap;
  });
  if (supports.some((set) => set.size === 0)) return false;
  const common = intersect(supports);
  return specificTokens(common).length > 0;
}

export function parseHeadlines(raw: unknown): HeadlineRef[] {
  if (!Array.isArray(raw)) return [];
  const out: HeadlineRef[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    if (item.leftover === true) continue;
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    if (!label || isCostumeLabel(label) || isThinLabel(label) || !specificTokens(tokens(label)).length) continue;
    const idsRaw = Array.isArray(item.topic_ids)
      ? item.topic_ids
      : Array.isArray(item.topicIds)
        ? item.topicIds
        : Array.isArray(item.story_ids)
          ? item.story_ids
          : [];
    const topicIds = uniqueIds(
      idsRaw.filter((id): id is string => typeof id === 'string' && id.length > 0),
    ).slice(0, MAX_GROUP);
    if (topicIds.length < MIN_GROUP) continue;
    const lead = topicIds[0];
    if (!lead) continue;
    const relatedRaw = Array.isArray(item.related_ids)
      ? item.related_ids
      : Array.isArray(item.relatedIds)
        ? item.relatedIds
        : [];
    const relatedIds = uniqueIds(
      relatedRaw.filter((id): id is string => typeof id === 'string' && id.length > 0),
    ).slice(0, MAX_RELATED);
    out.push({
      id: typeof item.id === 'string' && item.id ? item.id : `hl_${lead}`,
      label: label.slice(0, MAX_LABEL),
      topicIds,
      relatedIds: relatedIds.length ? relatedIds : undefined,
    });
  }
  return out;
}

function mergeByLabel(refs: HeadlineRef[]): HeadlineRef[] {
  const out: HeadlineRef[] = [];
  const index = new Map<string, HeadlineRef>();
  for (const ref of refs) {
    const key = normalizeLabel(ref.label);
    const existing = index.get(key);
    if (existing) {
      existing.topicIds = uniqueIds([...existing.topicIds, ...ref.topicIds]).slice(0, MAX_GROUP);
      existing.relatedIds = uniqueIds([
        ...(existing.relatedIds || []),
        ...(ref.relatedIds || []),
      ]).slice(0, MAX_RELATED);
      if (!existing.relatedIds.length) delete existing.relatedIds;
      continue;
    }
    const copy: HeadlineRef = {
      ...ref,
      topicIds: [...ref.topicIds],
      relatedIds: ref.relatedIds ? [...ref.relatedIds] : undefined,
    };
    index.set(key, copy);
    out.push(copy);
  }
  return out.slice(0, MAX_HEADLINES);
}

export function packHeadlines<T extends Headlineable>(topics: T[]): HeadlineRef[] {
  const pool = topics.filter((topic) => topic.id && topic.title && !isDigestTitle(topic.title));
  if (!pool.length) return [];

  const tokenMap = new Map<string, Set<string>>();
  for (const topic of pool) tokenMap.set(topic.id, tokens(topic.title));
  const df = documentFrequency(pool, tokenMap);

  const placed = new Set<string>();
  const headlines: HeadlineRef[] = [];

  for (const lead of pool) {
    if (headlines.length >= MAX_HEADLINES) break;
    if (placed.has(lead.id)) continue;
    const leadTok = tokenMap.get(lead.id) || new Set();
    const group: T[] = [lead];
    let shared: Set<string> | null = null;
    for (const other of pool) {
      if (other.id === lead.id || placed.has(other.id)) continue;
      const pair = sharedStoryTokens(leadTok, tokenMap.get(other.id) || new Set(), df);
      if (!pair) continue;
      if (shared) {
        const next = intersect([shared, pair]);
        if (!sharedStoryTokens(next, next, df)) continue;
        shared = next;
      } else {
        shared = pair;
      }
      group.push(other);
      if (group.length >= MAX_GROUP) break;
    }
    if (!shared || group.length < MIN_GROUP) continue;
    const label = labelFromTitles(group.map((topic) => topic.title));
    if (!label || !headlineGrounded(label, group.map((topic) => topic.title))) continue;
    const ids = group.map((topic) => topic.id);
    for (const id of ids) placed.add(id);
    headlines.push({ id: `hl_${lead.id}`, label, topicIds: ids });
  }

  return mergeByLabel(headlines);
}

export function applyHeadlines<T extends Headlineable>(
  topics: T[],
  refs: HeadlineRef[],
): HeadlineRef[] {
  const byId = new Map(topics.map((topic) => [topic.id, topic]));
  const order = new Map(topics.map((topic, index) => [topic.id, index]));
  const seen = new Set<string>();
  const out: HeadlineRef[] = [];
  for (const ref of refs) {
    if (out.length >= MAX_HEADLINES) break;
    const members = uniqueIds(ref.topicIds)
      .map((id) => byId.get(id))
      .filter((topic): topic is T => topic != null && !seen.has(topic.id) && !isDigestTitle(topic.title))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .slice(0, MAX_GROUP);
    if (members.length < MIN_GROUP) continue;
    if (!headlineGrounded(ref.label, members.map((topic) => topic.title))) continue;
    const lead = members[0];
    if (!lead) continue;
    for (const topic of members) seen.add(topic.id);
    out.push({
      id: ref.id || `hl_${lead.id}`,
      label: ref.label.slice(0, MAX_LABEL),
      topicIds: members.map((topic) => topic.id),
      relatedIds: ref.relatedIds,
    });
  }
  return mergeByLabel(out);
}

/** Fold conversations into a headline when they share it. */
export function attachRelated<T extends Headlineable>(
  headlines: HeadlineRef[],
  stories: T[],
  related: Headlineable[],
): HeadlineRef[] {
  if (!headlines.length || !related.length) return headlines;
  const byId = new Map(stories.map((story) => [story.id, story]));
  const used = new Set(headlines.flatMap((headline) => headline.topicIds));
  return headlines.map((headline) => {
    const members = headline.topicIds
      .map((id) => byId.get(id))
      .filter((story): story is T => story != null);
    if (members.length < MIN_GROUP) return headline;
    const memberTok = members.map((story) => tokens(story.title));
    const extras: string[] = [];
    for (const item of related) {
      if (used.has(item.id) || extras.length >= MAX_RELATED) continue;
      const itemTok = tokens(item.title);
      const fits = memberTok.some((tok) => sharedStoryTokens(tok, itemTok));
      if (!fits) continue;
      extras.push(item.id);
      used.add(item.id);
    }
    if (!extras.length) return headline;
    return { ...headline, relatedIds: uniqueIds([...(headline.relatedIds || []), ...extras]).slice(0, MAX_RELATED) };
  });
}

export function resolveHeadlines<T extends Headlineable>(
  topics: T[],
  pipeline?: unknown,
  related?: Headlineable[],
): HeadlineRef[] {
  const fromPipeline = applyHeadlines(topics, parseHeadlines(pipeline));
  const used = new Set(fromPipeline.flatMap((headline) => headline.topicIds));
  const rest = topics.filter((topic) => !used.has(topic.id));
  const packed = mergeByLabel([...fromPipeline, ...packHeadlines(rest)]).slice(0, MAX_HEADLINES);
  return related?.length ? attachRelated(packed, topics, related) : packed;
}

export function layoutFeed<T extends Headlineable>(
  stories: T[],
  headlines: HeadlineRef[],
  related: Headlineable[] = [],
): FeedRow<T>[] {
  const byId = new Map(stories.map((story) => [story.id, story]));
  const relatedById = new Map(related.map((item) => [item.id, item]));
  const blockByStory = new Map<string, { id: string; label: string; stories: T[]; related: Headlineable[] }>();

  for (const headline of headlines) {
    const members = uniqueIds(headline.topicIds)
      .map((id) => byId.get(id))
      .filter((story): story is T => story != null)
      .slice(0, MAX_GROUP);
    if (members.length < MIN_GROUP) continue;
    if (!headlineGrounded(headline.label, members.map((story) => story.title))) continue;
    const extras = uniqueIds(headline.relatedIds || [])
      .map((id) => relatedById.get(id))
      .filter((item): item is Headlineable => item != null)
      .slice(0, MAX_RELATED);
    const block = { id: headline.id, label: headline.label, stories: members, related: extras };
    for (const story of members) blockByStory.set(story.id, block);
  }

  const placed = new Set<string>();
  const rows: FeedRow<T>[] = [];
  for (const story of stories) {
    if (placed.has(story.id)) continue;
    const block = blockByStory.get(story.id);
    if (block) {
      rows.push({
        kind: 'headline',
        id: block.id,
        label: block.label,
        stories: block.stories,
        related: block.related,
      });
      for (const member of block.stories) placed.add(member.id);
      continue;
    }
    rows.push({ kind: 'story', story });
    placed.add(story.id);
  }
  return rows;
}

/** Keep storyline groups together when cutting a tab down to N cards. */
export function takeFeedRows<T extends Headlineable>(rows: FeedRow<T>[], cap: number): FeedRow<T>[] {
  if (cap <= 0) return [];
  const out: FeedRow<T>[] = [];
  let count = 0;
  for (const row of rows) {
    const size = row.kind === 'headline' ? row.stories.length : 1;
    if (count >= cap) break;
    out.push(row);
    count += size;
  }
  return out;
}

export function flattenRows<T extends Headlineable>(rows: FeedRow<T>[]): T[] {
  return rows.flatMap((row) => (row.kind === 'headline' ? row.stories : [row.story]));
}

/** Drop pinned stories (e.g. story of the day) so they are not listed twice. */
export function omitStoryFromRows<T extends Headlineable>(
  rows: FeedRow<T>[],
  storyIds?: Iterable<string> | string | null,
): FeedRow<T>[] {
  const ids = new Set(
    typeof storyIds === 'string' ? [storyIds] : storyIds ? [...storyIds] : [],
  );
  if (!ids.size) return rows;
  const out: FeedRow<T>[] = [];
  for (const row of rows) {
    if (row.kind === 'story') {
      if (!ids.has(row.story.id)) out.push(row);
      continue;
    }
    const stories = row.stories.filter((story) => !ids.has(story.id));
    if (stories.length >= 2) {
      out.push({ ...row, stories });
    } else if (stories.length === 1) {
      out.push({ kind: 'story', story: stories[0] });
    }
  }
  return out;
}
