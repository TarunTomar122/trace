import { MetadataRoute } from 'next'
import { researchPosts } from './research/content'
import { adminFirestore } from '@/lib/firebase-admin'

const FALLBACK_TOPICS = [
  'technology',
  'business-market',
  'experience',
  'productivity',
]

const ARTICLE_POOLS = [
  { collection: 'v3_for_you_pool', prefix: 'fy' },
  { collection: 'v3_deep_dive_pool', prefix: 'dd' },
  { collection: 'v3_trending_pool', prefix: 'tr' },
] as const

function normalizeTopicSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim().toLowerCase()
  if (!cleaned) return null
  return cleaned.replace(/\s+/g, '-')
}

async function getTopicSlugs(): Promise<string[]> {
  const topics = new Set<string>(FALLBACK_TOPICS)
  if (!adminFirestore) return Array.from(topics)

  try {
    const globalFeed = await adminFirestore
      .collection('v3_user_feeds')
      .doc('_global')
      .collection('daily')
      .orderBy('__name__', 'desc')
      .limit(1)
      .get()

    if (!globalFeed.empty) {
      const data = globalFeed.docs[0].data()
      const trendingTopics = Array.isArray(data.trending_topics) ? data.trending_topics : []
      for (const topic of trendingTopics) {
        const slug = normalizeTopicSlug(topic?.topic_key ?? topic?.id)
        if (slug) topics.add(slug)
      }
    }
  } catch (error) {
    console.error('[sitemap] Failed to fetch global feed topics:', error)
  }

  try {
    const latestTrending = await adminFirestore
      .collection('trending_news')
      .orderBy('date', 'desc')
      .limit(1)
      .get()
    if (!latestTrending.empty) {
      const topicDocs = await latestTrending.docs[0].ref.collection('topics').get()
      topicDocs.forEach((doc) => {
        const data = doc.data()
        const slug = normalizeTopicSlug(data.topic_key ?? data.id ?? doc.id)
        if (slug) topics.add(slug)
      })
    }
  } catch (error) {
    console.error('[sitemap] Failed to fetch trending_news topics:', error)
  }

  return Array.from(topics)
}

async function getPublicArticlePages(baseUrl: string): Promise<MetadataRoute.Sitemap> {
  if (!adminFirestore) return []
  const pages: MetadataRoute.Sitemap = []

  for (const pool of ARTICLE_POOLS) {
    try {
      const snapshot = await adminFirestore
        .collection(pool.collection)
        .limit(250)
        .get()

      snapshot.forEach((doc) => {
        const id = `${pool.prefix}_${doc.id}`
        pages.push({
          url: `${baseUrl}/articles/${id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
        })
      })
    } catch (error) {
      console.error(`[sitemap] Failed to fetch ${pool.collection}:`, error)
    }
  }

  return pages
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.yourtrace.online'
  const [topics, articlePages] = await Promise.all([
    getTopicSlugs(),
    getPublicArticlePages(baseUrl),
  ])
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/trending`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/waitlist`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/research`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  // Topic pages - high priority for SEO
  const trendingPages: MetadataRoute.Sitemap = topics.map((topic) => ({
    url: `${baseUrl}/trending/${topic}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const topicPages: MetadataRoute.Sitemap = topics.map((topic) => ({
    url: `${baseUrl}/topics/${topic}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.75,
  }))

  const researchPages: MetadataRoute.Sitemap = researchPosts.map((post) => ({
    url: `${baseUrl}/research/${post.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...trendingPages, ...topicPages, ...researchPages, ...articlePages];
}
