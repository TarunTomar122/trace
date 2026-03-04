import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { adminFirestore } from '@/lib/firebase-admin';
import ArticleContent from './ArticleContent';

// Pool collection mapping based on article ID prefix
const POOL_MAP: Record<string, string> = {
  'fy': 'v3_for_you_pool',
  'dd': 'v3_deep_dive_pool',
  'tr': 'v3_trending_pool',
};

const FEED_TYPE_MAP: Record<string, string> = {
  'fy': 'for_you',
  'dd': 'deep_dives',
  'tr': 'trending',
};

const SUMMARY_CACHE = 'v3_summary_cache';

interface ArticleData {
  id: string;
  url: string;
  title: string;
  type: string;
  source: string;
  source_name: string;
  interest_id: string;
  feed_type: string;
  published_date: string;
  thumbnail: string | null;
  summary: {
    short_article?: {
      subtitle?: string;
      outline?: string[];
      body?: string;
      key_takeaways?: string[];
      why_it_matters?: string;
    };
    reading_time_minutes?: number;
  };
  metadata: {
    feed_type: string;
    source_description?: string;
  };
}

async function getArticle(id: string): Promise<ArticleData | null> {
  if (!id || id.length < 4 || !adminFirestore) {
    return null;
  }

  const prefix = id.substring(0, 2);
  const docId = id.substring(3);
  const poolCollection = POOL_MAP[prefix];

  if (!poolCollection) {
    return null;
  }

  try {
    const articleDoc = await adminFirestore
      .collection(poolCollection)
      .doc(docId)
      .get();

    if (!articleDoc.exists) {
      return null;
    }

    const data = articleDoc.data();
    if (!data) {
      return null;
    }

    // Try to fetch summary from cache
    let summary = data.summary || {};
    const articleUrl = data.url || '';

    if (articleUrl && (!summary || !summary.short_article)) {
      // Query summary cache by URL to find any cached summary
      const cacheQuery = await adminFirestore
        .collection(SUMMARY_CACHE)
        .where('url', '==', articleUrl)
        .limit(1)
        .get();

      if (!cacheQuery.empty) {
        const cacheData = cacheQuery.docs[0].data();
        if (cacheData?.summary) {
          summary = cacheData.summary;
        }
      }
    }

    return {
      id,
      url: articleUrl,
      title: data.title || '',
      type: data.type || 'blog',
      source: data.source || '',
      source_name: data.source_name || '',
      interest_id: data.interest_id || '',
      feed_type: FEED_TYPE_MAP[prefix] || 'for_you',
      published_date: data.published_date || '',
      thumbnail: data.og_image || data.thumbnail || null,
      summary,
      metadata: {
        feed_type: FEED_TYPE_MAP[prefix] || 'for_you',
        source_description: data.source_description || '',
      },
    };
  } catch (error) {
    console.error('Error fetching article:', error);
    return null;
  }
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id);
  const canonicalUrl = `https://www.yourtrace.online/articles/${id}`;

  if (!article) {
    return {
      title: 'Article Not Found | Trace',
      description: 'This article could not be found.',
    };
  }

  const description = article.summary?.short_article?.subtitle
    || article.summary?.short_article?.key_takeaways?.[0]
    || `Read this article from ${article.source_name || 'Trace'}`;

  return {
    title: `${article.title} | Trace`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: article.title,
      description,
      type: 'article',
      url: canonicalUrl,
      images: article.thumbnail ? [{ url: article.thumbnail }] : [],
      siteName: 'Trace',
    },
    twitter: {
      card: article.thumbnail ? 'summary_large_image' : 'summary',
      title: article.title,
      description,
      images: article.thumbnail ? [article.thumbnail] : [],
    },
  };
}

export default async function PublicArticlePage({ params }: PageProps) {
  const { id } = await params;
  const article = await getArticle(id);

  if (!article) {
    notFound();
  }

  const canonicalUrl = `https://www.yourtrace.online/articles/${id}`;
  const publishedIso = (() => {
    if (!article.published_date) return undefined;
    const parsed = new Date(article.published_date);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  })();
  const articleStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description:
      article.summary?.short_article?.subtitle ||
      article.summary?.short_article?.key_takeaways?.[0] ||
      `Read this article from ${article.source_name || 'Trace'}`,
    mainEntityOfPage: canonicalUrl,
    datePublished: publishedIso,
    dateModified: publishedIso,
    author: {
      '@type': 'Organization',
      name: article.source_name || article.source || 'Trace',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Trace',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.yourtrace.online/trace.png',
      },
    },
    image: article.thumbnail ? [article.thumbnail] : undefined,
    url: canonicalUrl,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleStructuredData) }}
      />
      <ArticleContent article={article} />
    </>
  );
}
