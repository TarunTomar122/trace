import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { isInstagramStudioAuthorized } from '@/lib/instagram-studio-auth';
import { loadStudioNewsFeed, markCoveredKeys } from '@/lib/instagram-studio-feed';

type Topic = Record<string, unknown>;

const AI_INTEREST_IDS = new Set(['ai']);
const TECH_INTEREST_IDS = new Set([
  'tech', 'engineering', 'startups', 'business', 'science',
  'ux-design', 'product-design', 'design',
]);
const WORLD_INTEREST_IDS = new Set(['world', 'the-world', 'markets', 'policy', 'politics', 'geopolitics']);

function inferCategory(topic: Topic): 'ai' | 'tech' | 'world' {
  const id = String(topic.interest_id || '').trim().toLowerCase();
  if (AI_INTEREST_IDS.has(id)) return 'ai';
  if (WORLD_INTEREST_IDS.has(id)) return 'world';
  if (TECH_INTEREST_IDS.has(id)) return 'tech';
  return 'tech';
}

function norm(value: unknown): string {
  return String(value || '')
    .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function coveredTrendingKeys(topics: Topic[]): { ids: Set<string>; urls: Set<string> } {
  const ids = new Set<string>();
  const urls = new Set<string>();
  for (const topic of topics) {
    const articles = Array.isArray(topic.articles) ? topic.articles : [];
    for (const raw of articles) {
      if (!raw || typeof raw !== 'object') continue;
      const article = raw as Record<string, unknown>;
      const id = String(article.id || '').trim();
      const url = String(article.url || '').trim();
      if (id) ids.add(id);
      if (url) urls.add(url);
    }
    const timeline = Array.isArray(topic.timeline) ? topic.timeline : [];
    for (const raw of timeline) {
      if (!raw || typeof raw !== 'object') continue;
      const event = raw as Record<string, unknown>;
      const id = String(event.id || '').trim();
      const url = String(event.article_url || '').trim();
      if (id) ids.add(id);
      if (url) urls.add(url);
    }
  }
  return { ids, urls };
}

async function loadLatestFeed() {
  return loadStudioNewsFeed('developer');
}

export async function GET(request: NextRequest) {
  try {
    if (!isInstagramStudioAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Server Firebase Admin not configured' }, { status: 500 });
    }

    const { date, forYou, topics, trending } = await loadLatestFeed();
    if (!forYou.length && !topics.length && !trending.length) {
      return NextResponse.json({ error: 'No trending stories available' }, { status: 404 });
    }

    const shapedForYou = forYou
      .filter((item) => norm(item.title))
      .map((item, index) => ({
        id: String(item.id || item.url || `for-you-${index}`),
        title: norm(item.title),
        thumbnail: String(item.thumbnail || ''),
        category: inferCategory(item),
        sourceCount: 1,
        articleCount: 1,
        kind: 'item' as const,
      }))
      .filter((t) => t.id && t.title);

    const shapedTopics = topics
      .filter((t) => norm(t.title))
      .map((t) => ({
        id: String(t.id || ''),
        title: norm(t.title),
        thumbnail: String(t.thumbnail || ''),
        category: inferCategory(t),
        sourceCount: Number(t.source_count || 0),
        articleCount: Number(t.article_count || 0),
        kind: 'group',
      }))
      .filter((t) => t.id && t.title);

    const covered = coveredTrendingKeys(topics);
    markCoveredKeys(covered, forYou);
    const shapedItems = trending
      .filter((item) => {
        const itemId = String(item.id || '').trim();
        const itemUrl = String(item.url || '').trim();
        return norm(item.title) && !covered.ids.has(itemId) && !covered.urls.has(itemUrl);
      })
      .map((item, index) => ({
        id: String(item.id || item.url || `trending-item-${index}`),
        title: norm(item.title),
        thumbnail: String(item.thumbnail || ''),
        category: inferCategory(item),
        sourceCount: 1,
        articleCount: 1,
        kind: 'item',
      }))
      .filter((t) => t.id && t.title);

    return NextResponse.json({ ok: true, date, topics: [...shapedForYou, ...shapedTopics, ...shapedItems] });
  } catch (error) {
    console.error('instagram studio topics error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load topics' },
      { status: 500 },
    );
  }
}
