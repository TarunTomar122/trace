import type { FeedItem } from '@/lib/firestore';

export type PulseLiveItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  preview?: string;
  signal?: string;
  published_date?: string;
};

function hashId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return `live-${Math.abs(hash).toString(36)}`;
}

export async function fetchHnTopStories(limit = 6): Promise<PulseLiveItem[]> {
  const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
    next: { revalidate: 900 },
  });
  if (!res.ok) return [];
  const ids = (await res.json()) as number[];
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const stories = await Promise.all(
    ids.slice(0, limit).map(async (id) => {
      try {
        const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          next: { revalidate: 900 },
        });
        if (!itemRes.ok) return null;
        return itemRes.json() as Promise<{
          id?: number;
          title?: string;
          url?: string;
          score?: number;
          time?: number;
        }>;
      } catch {
        return null;
      }
    }),
  );

  return stories
    .filter((story): story is NonNullable<typeof story> => Boolean(story?.title))
    .map((story) => ({
      id: hashId(`hn-${story.id}`),
      title: String(story.title || '').trim(),
      url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
      source: 'Hacker News',
      preview: undefined,
      signal: typeof story.score === 'number' ? `${story.score} points` : undefined,
      published_date: story.time
        ? new Date(story.time * 1000).toISOString()
        : undefined,
    }));
}

export async function fetchGithubTrending(limit = 6): Promise<PulseLiveItem[]> {
  try {
    const res = await fetch('https://github.com/trending', {
      headers: { 'User-Agent': 'TracePulse/1.0 (+https://www.yourtrace.online)' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const items: PulseLiveItem[] = [];
    const rowRe = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    let match: RegExpExecArray | null;

    while ((match = rowRe.exec(html)) !== null && items.length < limit) {
      const chunk = match[1];
      if (/Sponsor/i.test(chunk)) continue;

      const hrefMatch = chunk.match(/<h2[^>]*>\s*<a[^>]+href="(\/[^"]+)"/i);
      if (!hrefMatch) continue;
      const href = hrefMatch[1].trim();
      if (!href.startsWith('/') || href.split('/').filter(Boolean).length < 2) continue;

      const titleMatch = chunk.match(/<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
      const title = (titleMatch?.[1] || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!title) continue;

      const descMatch = chunk.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      const preview = (descMatch?.[1] || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const starsMatch = chunk.match(/([\d,]+)\s+stars?\s+today/i);
      const signal = starsMatch ? `${starsMatch[1]} stars today` : undefined;

      items.push({
        id: hashId(`gh-${href}`),
        title,
        url: `https://github.com${href}`,
        source: 'GitHub Trending',
        preview: preview || undefined,
        signal,
      });
    }

    return items;
  } catch {
    return [];
  }
}

export function pulseLiveToFeedItem(item: PulseLiveItem): FeedItem {
  const signalCount = item.signal
    ? Number.parseInt(item.signal.replace(/[^\d]/g, ''), 10) || undefined
    : undefined;
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    source: item.source,
    source_name: item.source,
    published_date: item.published_date,
    summary: item.preview
      ? { short_article: { body: item.preview, subtitle: item.preview } }
      : undefined,
    metadata: signalCount ? { signal_count: signalCount } : undefined,
  };
}
