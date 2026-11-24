// The Chrome new-tab extension's stories (GET /api/extension/stories, payload version 6).
// The same stories as the site's Home: one card per event (lib/feed-view.ts already folds
// same-event coverage), in the order the site's Home uses (selectBigThings, with
// pickStoryOfDay's lead first), plus the live sponsors. The older
// /api/extension/brief (versions 4-5, one card per article) stays for installs that
// haven't updated yet.

import type { FeedStory, PromotedTool } from '../components/feed-v2/FeedApp';
import { selectBigThings } from './big-things.ts';
import { pickStoryOfDay } from './retention.ts';
import { sponsorBlurb } from './sponsor-link.ts';

export const EXTENSION_STORY_LIMIT = 40;
const COVERAGE_LIMIT = 4;

const CAT_LABELS: Record<string, string> = {
  ai: 'AI',
  markets: 'Markets',
  'ux-design': 'Design',
  robotics: 'Robotics',
  tech: 'Tech',
  startups: 'Startups',
};

export type ExtensionStory = {
  id: string;
  title: string;
  body: string;
  /** The longer version for the reader (paragraphs separated by blank lines). */
  detail?: string;
  cat: string;
  cat_label: string;
  img?: string;
  source: string;
  source_count: number;
  /** The lead report. */
  url: string;
  /** The story on Trace. */
  trace_url: string;
  coverage: Array<{ title: string; source: string; url: string }>;
  ts?: number;
};

export type ExtensionSponsor = { id: string; title: string; sub: string; host: string; href: string };

export type ExtensionStories = {
  version: 6;
  feed_date: string;
  generated_at: string;
  stories: ExtensionStory[];
  sponsors: ExtensionSponsor[];
  /** Where "Your tool here" goes: the sponsor checkout on the site. */
  sponsor_url: string | null;
};

function webUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function toStory(story: FeedStory, origin: string): ExtensionStory | null {
  const url = webUrl(story.url) || story.coverage.map((c) => webUrl(c.url)).find(Boolean);
  const title = (story.title || '').trim();
  if (!url || !title || !story.id) return null;
  const img = webUrl(story.img);
  const coverage = story.coverage
    .filter((c) => webUrl(c.url) && c.title && webUrl(c.url) !== url && !c.earlier)
    .slice(0, COVERAGE_LIMIT)
    .map((c) => ({ title: c.title.trim(), source: (c.source || '').trim(), url: webUrl(c.url)! }));
  return {
    id: story.id,
    title,
    body: (story.body || '').trim(),
    ...(story.detail?.trim() ? { detail: story.detail.trim() } : {}),
    cat: story.cat || 'tech',
    cat_label: CAT_LABELS[story.cat] || story.cat || 'Tech',
    ...(img ? { img } : {}),
    source: story.source || hostOf(url),
    // Outlets, not articles: Fortune's five pieces count once (the site's own count).
    source_count: Math.max(1, story.sources?.length || 0),
    url,
    trace_url: new URL(`/story/${encodeURIComponent(story.id)}`, origin).toString(),
    coverage,
    ...(story.ts ? { ts: story.ts } : {}),
  };
}

export function buildExtensionStories(
  input: { stories: FeedStory[]; promoted: PromotedTool[]; feedDate: string },
  options: { origin: string; slots: number; now?: Date },
): ExtensionStories {
  const seen = new Set<string>();
  const now = options.now?.getTime() ?? Date.now();
  // Home's order: the verdict gate, launches first, lane quotas; then the story of the day on top.
  const ranked = selectBigThings(input.stories, { count: EXTENSION_STORY_LIMIT, now });
  const lead = pickStoryOfDay(ranked, now);
  const ordered = lead ? [lead, ...ranked.filter((story) => story.id !== lead.id)] : ranked;
  const stories = ordered
    .filter((story) => story.sendWorthy !== 0)
    .flatMap((story) => {
      const out = toStory(story, options.origin);
      if (!out || seen.has(out.id) || seen.has(out.url)) return [];
      seen.add(out.id);
      seen.add(out.url);
      return [out];
    })
    .slice(0, EXTENSION_STORY_LIMIT);
  const sponsors = input.promoted.flatMap((tool) => {
    if (!tool?.id || !tool.title || !webUrl(tool.url)) return [];
    const href = new URL('/api/tools/go', options.origin);
    href.searchParams.set('id', tool.id);
    href.searchParams.set('p', 'extension');
    return [{ id: tool.id, title: tool.title, sub: sponsorBlurb(tool.sub || ''), host: hostOf(tool.url), href: href.toString() }];
  }).slice(0, options.slots);
  return {
    version: 6,
    feed_date: input.feedDate,
    generated_at: (options.now || new Date()).toISOString(),
    stories,
    sponsors,
    sponsor_url: sponsors.length < options.slots ? new URL('/feed?sponsor=open', options.origin).toString() : null,
  };
}
