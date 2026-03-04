import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { adminFirestore } from '@/lib/firebase-admin';
import TopicContent from './TopicContent';

// Cache page for 5 minutes - prevents Firestore spam
export const revalidate = 300;

interface TopicData {
  id: string;
  topic_key: string;
  title: string;
  summary: string;
  key_points?: string[];
  thumbnail?: string;
  source_count?: number;
  article_count?: number;
  popularity_score?: number;
  is_featured?: boolean;
  timeline?: Array<{
    id: string;
    title: string;
    summary?: string;
    timestamp: string;
    source_name?: string;
    source_url?: string;
    article_url?: string;
  }>;
  articles?: Array<{
    id: string;
    url: string;
    title: string;
    source_name?: string;
    thumbnail?: string;
    summary?: {
      short_article?: {
        body?: string;
        subtitle?: string;
      };
    };
  }>;
}

async function getTopic(id: string): Promise<TopicData | null> {
  if (!id || !adminFirestore) {
    return null;
  }

  try {
    // Fetch from global feed's trending_topics
    const globalFeedRef = adminFirestore
      .collection('v3_user_feeds')
      .doc('_global')
      .collection('daily');

    const snapshot = await globalFeedRef.orderBy('__name__', 'desc').limit(1).get();

    if (snapshot.empty) {
      return null;
    }

    const feedData = snapshot.docs[0].data();
    const trendingTopics = feedData.trending_topics as TopicData[] | undefined;

    if (!trendingTopics || !Array.isArray(trendingTopics)) {
      return null;
    }

    // Find topic by ID or topic_key
    const topic = trendingTopics.find(
      (t) => t.id === id || t.topic_key === id
    );

    return topic || null;
  } catch (error) {
    console.error('Error fetching topic:', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const topic = await getTopic(id);

  if (!topic) {
    return {
      title: 'Topic Not Found | Trace',
    };
  }

  return {
    title: `${topic.title} | Trace`,
    description: topic.summary?.slice(0, 160),
    openGraph: {
      title: topic.title,
      description: topic.summary?.slice(0, 160),
      type: 'article',
      images: topic.thumbnail ? [topic.thumbnail] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: topic.title,
      description: topic.summary?.slice(0, 160),
      images: topic.thumbnail ? [topic.thumbnail] : undefined,
    },
  };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const topic = await getTopic(id);

  if (!topic) {
    notFound();
  }

  return <TopicContent topic={topic} />;
}
