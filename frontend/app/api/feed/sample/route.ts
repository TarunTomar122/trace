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

type TopicLatestItem = {
  title?: string;
  url?: string;
  thumbnail?: string | null;
};

type TopicLatest = {
  blogs?: TopicLatestItem[];
  discussions?: TopicLatestItem[];
  videos?: TopicLatestItem[];
  generated_at?: string;
};

type TopicDoc = {
  id: string;
  topic_id?: string;
  display_name?: string;
  latest?: TopicLatest;
  updated_at?: string;
};


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
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      await adminAuth.verifyIdToken(token);
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '10', 10),
      50
    );
    const topicsParam = searchParams.get('topics') || '';
    const preferredTopics = topicsParam
      .split(',')
      .map(topic => topic.trim())
      .filter(topic => topic.length > 0);
    const defaultTopics = ['ai', 'design', 'productivity', 'startups', 'frontend'];
    const topicIds = (preferredTopics.length > 0 ? preferredTopics : defaultTopics).slice(0, limit);

    const topicRefs = topicIds.map((topicId) =>
      adminFirestore!.collection('topics').doc(topicId)
    );
    const topicDocs = await adminFirestore!.getAll(...topicRefs);
    const topics: TopicDoc[] = topicDocs
      .filter((doc) => doc.exists)
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<TopicDoc, 'id'>),
      }));

    const seenUrls = new Set<string>();
    const items: FeedItem[] = [];

    for (const topic of topics) {
      if (items.length >= limit) break;
      const latest = topic.latest || {};
      const topicId = topic.topic_id || topic.id;
      const displayName = topic.display_name || topicId;

      const blogs: FeedItem[] = (latest.blogs || []).map((item, idx) => ({
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

      const picked = pickItems(blogs, 1, seenUrls);
      items.push(...picked);
    }

    return NextResponse.json({
      items: items.slice(0, limit),
      count: Math.min(items.length, limit),
      source: 'topics',
    });
  } catch (error: unknown) {
    console.error('Error fetching sample feed:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

