import { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { adminFirestore } from '@/lib/firebase-admin';
import TopicContent from './TopicContent';

export const revalidate = 300;

interface TopicData {
  id: string;
  topic_key: string;
  title: string;
  summary: string;
  /** ISO date (YYYY-MM-DD) of the global daily or trending doc this topic was resolved from, for internal links. */
  sourceArchiveDate?: string;
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

interface TrendingNewsArticle {
  id?: string;
  url?: string;
  title?: string;
  subtitle?: string;
  details?: string;
  content?: string;
  source_domain?: string;
  source_name?: string;
  thumbnail?: string;
  published_date?: string;
}

function looksLikeRawSource(value: string): boolean {
  return /(^|[-_/])(rss|feed)([-_/]|$)|\.com|\.ai|blog-rss/i.test(value);
}

function normalizeTopicId(value: string): string {
  return value.trim().toLowerCase();
}

function buildFallbackTopicSummary(title: string, articleCount: number): string {
  const countText = articleCount > 0 ? `${articleCount} recent updates` : 'recent updates';
  return `Trace groups ${countText} for ${title} into one page so you can catch up faster without checking multiple sites.`;
}

function hasMeaningfulTopicContent(topic: TopicData | null): topic is TopicData {
  if (!topic) return false;

  const slug = normalizeTopicId(topic.topic_key || topic.id || '');
  const title = topic.title || '';
  const hasArticles = (topic.article_count ?? 0) > 0 || (topic.articles?.length ?? 0) > 0;
  const hasTimeline = (topic.timeline?.length ?? 0) > 0;
  const hasKeyPoints = (topic.key_points?.length ?? 0) > 0;
  const hasSources = (topic.source_count ?? 0) > 0;

  if (looksLikeRawSource(slug) || looksLikeRawSource(title)) {
    return false;
  }

  return hasArticles || hasTimeline || hasKeyPoints || hasSources;
}

async function getTopicFromGlobalFeed(
  id: string,
): Promise<{ topic: TopicData; archiveDate: string } | null> {
  if (!adminFirestore) return null;

  const globalFeedRef = adminFirestore
    .collection('v3_user_feeds')
    .doc('_global')
    .collection('daily');

  const snapshot = await globalFeedRef.orderBy('__name__', 'desc').limit(5).get();
  if (snapshot.empty) return null;

  for (const doc of snapshot.docs) {
    const feedData = doc.data();
    const trendingTopics = feedData.trending_topics as TopicData[] | undefined;
    if (!Array.isArray(trendingTopics) || trendingTopics.length === 0) continue;

    const match = trendingTopics.find(
      (topic) =>
        normalizeTopicId(topic.id) === id ||
        normalizeTopicId(topic.topic_key) === id
    );
    if (match) return { topic: match, archiveDate: doc.id };
  }

  return null;
}

async function getTopicFromTrendingNews(
  id: string,
): Promise<{ topic: TopicData; archiveDate: string } | null> {
  if (!adminFirestore) return null;

  const latestTrendingSnapshot = await adminFirestore
    .collection('trending_news')
    .orderBy('date', 'desc')
    .limit(1)
    .get();

  if (latestTrendingSnapshot.empty) {
    return null;
  }

  const archiveDate = String(latestTrendingSnapshot.docs[0].id || '');

  const topicDoc = await latestTrendingSnapshot.docs[0].ref
    .collection('topics')
    .doc(id)
    .get();

  if (!topicDoc.exists) {
    return null;
  }

  const topicData = topicDoc.data() || {};
  const rawArticles: TrendingNewsArticle[] = Array.isArray(topicData.articles)
    ? topicData.articles
    : [];
  const displayTitle =
    topicData.display_name ||
    topicData.name ||
    id
      .split('-')
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const articles = rawArticles
    .filter((article) => article?.url && article?.title)
    .map((article, index: number) => ({
      id: article.id || `${id}-${index}`,
      url: article.url || '',
      title: article.title || '',
      source_name: article.source_domain || article.source_name || undefined,
      thumbnail: article.thumbnail || undefined,
      summary: {
        short_article: {
          body: article.details || article.content || article.subtitle || '',
          subtitle: article.subtitle || article.details || '',
        },
      },
    }));

  const timeline = rawArticles
    .filter((article) => article?.url && article?.title)
    .map((article, index: number) => ({
      id: article.id || `${id}-event-${index}`,
      title: article.title || '',
      summary: article.subtitle || article.details || '',
      timestamp: article.published_date || topicData.generated_at || latestTrendingSnapshot.docs[0].id,
      source_name: article.source_domain || article.source_name || undefined,
      source_url: article.url,
      article_url: article.url,
    }))
    .sort((a: { timestamp: string }, b: { timestamp: string }) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

  const sourceCount = new Set(
    rawArticles
      .map((article) => article?.source_domain || article?.source_name)
      .filter(Boolean)
  ).size;

  return {
    topic: {
      id,
      topic_key: id,
      title: displayTitle,
      summary: buildFallbackTopicSummary(displayTitle, rawArticles.length),
      thumbnail: rawArticles.find((article) => article?.thumbnail)?.thumbnail || undefined,
      source_count: sourceCount,
      article_count: rawArticles.length,
      timeline,
      articles,
    },
    archiveDate,
  };
}

async function getTopic(id: string): Promise<TopicData | null> {
  if (!id || !adminFirestore) {
    return null;
  }

  const normalizedId = normalizeTopicId(id);

  try {
    const globalResult = await getTopicFromGlobalFeed(normalizedId);
    if (globalResult && hasMeaningfulTopicContent(globalResult.topic)) {
      return {
        ...globalResult.topic,
        sourceArchiveDate: globalResult.archiveDate,
      };
    }

    const fallbackResult = await getTopicFromTrendingNews(normalizedId);
    if (fallbackResult && hasMeaningfulTopicContent(fallbackResult.topic)) {
      return {
        ...fallbackResult.topic,
        sourceArchiveDate: fallbackResult.archiveDate,
      };
    }
    return null;
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
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonicalUrl = `https://www.yourtrace.online/topics/${topic.topic_key || topic.id}`;

  return {
    title: `${topic.title} | Trace`,
    description: topic.summary?.slice(0, 160),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: topic.title,
      description: topic.summary?.slice(0, 160),
      type: 'article',
      url: canonicalUrl,
      images: topic.thumbnail ? [topic.thumbnail] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: topic.title,
      description: topic.summary?.slice(0, 160),
      images: topic.thumbnail ? [topic.thumbnail] : undefined,
    },
    robots: {
      index: true,
      follow: true,
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

  const canonicalUrl = `https://www.yourtrace.online/topics/${topic.topic_key || topic.id}`;
  const topicSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: topic.title,
    description: topic.summary,
    image: topic.thumbnail || undefined,
    mainEntityOfPage: canonicalUrl,
    publisher: {
      '@type': 'Organization',
      name: 'Trace',
      url: 'https://www.yourtrace.online',
    },
    about: (topic.key_points || []).slice(0, 4),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.yourtrace.online' },
      { '@type': 'ListItem', position: 2, name: 'Trending', item: 'https://www.yourtrace.online/trending' },
      { '@type': 'ListItem', position: 3, name: topic.title, item: canonicalUrl },
    ],
  };

  return (
    <>
      <Script
        id="topic-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(topicSchema) }}
      />
      <Script
        id="topic-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <TopicContent topic={topic} />
    </>
  );
}
