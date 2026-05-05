import { NextRequest, NextResponse } from 'next/server';
import { getDailyArchiveFeed, getTodaysFeed } from '@/lib/daily-archive';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
  }

  // "today" keyword or today's actual date → use getTodaysFeed
  const isToday = date === 'today';

  try {
    const feed = isToday ? await getTodaysFeed() : await getDailyArchiveFeed(date);

    if (!feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    return NextResponse.json({
      date: feed.date,
      assembledAt: feed.assembledAt || null,
      trending: feed.trending.map((item) => ({
        id: item.id || item.url || '',
        title: item.title || '',
        url: item.url || '',
        thumbnail: item.thumbnail || null,
        source: item.source_name || item.source || '',
        summary: {
          short_article: {
            body: item.summary?.short_article?.body || '',
            subtitle: item.summary?.short_article?.subtitle || '',
            key_takeaways: item.summary?.short_article?.key_takeaways || [],
          },
        },
        published_date: item.published_date || '',
        metadata: {
          source_count: item.metadata?.source_count || item.sources?.length || 0,
        },
      })),
      trendingTopics: feed.trendingTopics.map((topic) => ({
        id: topic.id,
        title: topic.title || '',
        summary: topic.summary || '',
        source_count: topic.source_count || 0,
        article_count: topic.article_count || topic.articles?.length || 0,
        key_points: topic.key_points || [],
      })),
    });
  } catch (error) {
    console.error('[api/daily-feed] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
