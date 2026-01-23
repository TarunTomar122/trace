import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';

// Enable ISR with 4 hour revalidation
export const revalidate = 14400;

// Curated list of allowed topics for public viewing
const ALLOWED_TOPICS = [
  'frontend-performance',
  'design',
  'ai-agents',
  'startups',
  'music-production',
  'vibe-coding',
] as const;

type AllowedTopic = typeof ALLOWED_TOPICS[number];

// Topic display names for better UX
const TOPIC_DISPLAY_NAMES: Record<AllowedTopic, string> = {
  'frontend-performance': 'Frontend Performance',
  'design': 'Design',
  'ai-agents': 'AI Agents',
  'startups': 'Startups',
  'music-production': 'Music Production',
  'vibe-coding': 'Vibe Coding',
};

/**
 * Public endpoint to fetch topic content for trending pages.
 * No authentication required.
 * 
 * Returns latest blogs, discussions, and videos for a specific topic.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topic: string }> }
) {
  try {
    const { topic: topicId } = await params;

    // Validate topic is in allowed list
    if (!ALLOWED_TOPICS.includes(topicId as AllowedTopic)) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    if (!adminFirestore) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Fetch topic document from Firestore
    const topicDoc = await adminFirestore
      .collection('topics')
      .doc(topicId)
      .get();

    if (!topicDoc.exists) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    const topicData = topicDoc.data();
    const latest = topicData?.latest || {};

    // Extract content from latest generation - max 4 items total per topic
    const blogs = (latest.blogs || []).slice(0, 2);
    const discussions = (latest.discussions || []).slice(0, 1);
    const videos = (latest.videos || []).slice(0, 1);

    // Combine and format items
    const items = [
      ...blogs.map((item: any, idx: number) => ({
        id: `${topicId}_blog_${idx}`,
        type: 'blog',
        title: item.title || '',
        description: '',
        url: item.url || '',
        tags: [topicId],
        source: 'exa',
        metadata: {
          why_relevant: `Latest in ${TOPIC_DISPLAY_NAMES[topicId as AllowedTopic]}`,
        },
      })),
      ...discussions.map((item: any, idx: number) => ({
        id: `${topicId}_discussion_${idx}`,
        type: 'discussion',
        title: item.title || '',
        description: '',
        url: item.url || '',
        tags: [topicId],
        source: 'exa',
        metadata: {
          why_relevant: `Latest in ${TOPIC_DISPLAY_NAMES[topicId as AllowedTopic]}`,
        },
      })),
      ...videos.map((item: any, idx: number) => ({
        id: `${topicId}_video_${idx}`,
        type: 'video',
        title: item.title || '',
        description: '',
        url: item.url || '',
        thumbnail: item.thumbnail || null,
        tags: [topicId],
        source: 'youtube',
        metadata: {
          why_relevant: `Latest in ${TOPIC_DISPLAY_NAMES[topicId as AllowedTopic]}`,
        },
      })),
    ];

    // Return with proper caching headers for SEO and performance
    return NextResponse.json({
      topic_id: topicId,
      display_name: topicData?.display_name || TOPIC_DISPLAY_NAMES[topicId as AllowedTopic],
      items,
      updated_at: topicData?.updated_at || null,
      total: items.length,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=14400, stale-while-revalidate=86400',
        'CDN-Cache-Control': 'public, s-maxage=14400',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=14400',
      },
    });
  } catch (error: any) {
    console.error('Error fetching topic:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

