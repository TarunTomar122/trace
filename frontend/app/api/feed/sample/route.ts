import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

type FeedItem = {
  id: string;
  type: 'blog' | 'discussion' | 'video';
  title: string;
  description?: string;
  url: string;
  thumbnail?: string | null;
  tags?: string[];
  metadata?: {
    why_relevant?: string;
    feed_category?: string;
  };
};

const MAX_TOPICS = 50;

const pickItems = (
  items: FeedItem[],
  limit: number,
  seenUrls: Set<string>
) => {
  const picked: FeedItem[] = [];
  for (const item of items) {
    if (!item.url || seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
};

export async function GET(request: NextRequest) {
  try {
    if (!adminAuth || !adminFirestore) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await adminAuth.verifyIdToken(token);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '10', 10),
      50
    );

    const topicsSnapshot = await adminFirestore
      .collection('topics')
      .limit(MAX_TOPICS)
      .get();

    if (topicsSnapshot.empty) {
      return NextResponse.json({ items: [], count: 0, source: 'topics' });
    }

    const topics: any[] = topicsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    topics.sort((a: any, b: any) => {
      const aDate = a.updated_at || a.latest?.generated_at || '';
      const bDate = b.updated_at || b.latest?.generated_at || '';
      return String(bDate).localeCompare(String(aDate));
    });

    const seenUrls = new Set<string>();
    const items: FeedItem[] = [];

    for (const topic of topics) {
      if (items.length >= limit) break;
      const latest = topic.latest || {};
      const topicId = topic.topic_id || topic.id;
      const displayName = topic.display_name || topicId;

      const blogs = (latest.blogs || []).map((item: any, idx: number) => ({
        id: `${topicId}_blog_${idx}`,
        type: 'blog',
        title: item.title || '',
        description: '',
        url: item.url || '',
        tags: [topicId],
        metadata: {
          why_relevant: `Trending in ${displayName}`,
          feed_category: 'sample',
        },
      }));

      const discussions = (latest.discussions || []).map(
        (item: any, idx: number) => ({
          id: `${topicId}_discussion_${idx}`,
          type: 'discussion',
          title: item.title || '',
          description: '',
          url: item.url || '',
          tags: [topicId],
          metadata: {
            why_relevant: `Trending in ${displayName}`,
            feed_category: 'sample',
          },
        })
      );

      const videos = (latest.videos || []).map((item: any, idx: number) => ({
        id: `${topicId}_video_${idx}`,
        type: 'video',
        title: item.title || '',
        description: '',
        url: item.url || '',
        thumbnail: item.thumbnail || null,
        tags: [topicId],
        metadata: {
          why_relevant: `Trending in ${displayName}`,
          feed_category: 'sample',
        },
      }));

      const combined = [...blogs, ...discussions, ...videos];
      const picked = pickItems(combined, 1, seenUrls);
      items.push(...picked);
    }

    return NextResponse.json({
      items: items.slice(0, limit),
      count: Math.min(items.length, limit),
      source: 'topics',
    });
  } catch (error: any) {
    console.error('Error fetching sample feed:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

