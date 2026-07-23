import { MetadataRoute } from 'next'
import { blogPosts } from './blog/content'
import { standaloneBlogPosts } from './blog/standalone-content'
import { adminFirestore } from '@/lib/firebase-admin'
import { comparePages } from './compare/content'
import { getDailyArchiveEntries } from '@/lib/daily-archive'
import { solutionsContent } from './solutions/content'
import { useCasesContent } from './use-cases/content'
import { newslettersContent } from './newsletters/content'

const FALLBACK_TOPICS: string[] = []

const ARTICLE_POOLS = [
  { collection: 'v3_for_you_pool', prefix: 'fy' },
  { collection: 'v3_deep_dive_pool', prefix: 'dd' },
  { collection: 'v3_trending_pool', prefix: 'tr' },
] as const

type SitemapTopicCandidate = {
  id?: string
  topic_key?: string
  title?: string
  display_name?: string
  name?: string
  article_count?: number
  source_count?: number
  timeline?: Array<unknown>
  key_points?: string[]
  articles?: Array<unknown>
}

type SitemapArticleCandidate = {
  title?: string
  summary?: {
    short_article?: {
      subtitle?: string
      slides?: string[]
      body?: string
      key_takeaways?: string[]
      why_it_matters?: string
    }
  }
}

function normalizeTopicSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim().toLowerCase()
  if (!cleaned) return null
  return cleaned.replace(/\s+/g, '-')
}

function looksLikeRawSource(value: string): boolean {
  return /(^|[-_/])(rss|feed)([-_/]|$)|\.com|\.ai|blog-rss/i.test(value)
}

function isIndexableTopic(candidate: {
  slug: string
  label: string
  articleCount?: number
  sourceCount?: number
  timelineCount?: number
  keyPointCount?: number
}): boolean {
  const hasContent =
    (candidate.articleCount ?? 0) > 0 ||
    (candidate.sourceCount ?? 0) > 0 ||
    (candidate.timelineCount ?? 0) > 0 ||
    (candidate.keyPointCount ?? 0) > 0

  if (!hasContent) return false
  if (looksLikeRawSource(candidate.slug) || looksLikeRawSource(candidate.label)) return false
  return true
}

function formatTopicLabel(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeText(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function isIndexableArticle(candidate: SitemapArticleCandidate): boolean {
  const title = normalizeText(candidate.title).toLowerCase()
  const shortArticle = candidate.summary?.short_article
  const subtitle = normalizeText(shortArticle?.subtitle)
  const body = normalizeText(shortArticle?.body)
  const whyItMatters = normalizeText(shortArticle?.why_it_matters)
  const slides = Array.isArray(shortArticle?.slides)
    ? shortArticle.slides.map((slide) => normalizeText(slide)).filter(Boolean)
    : []
  const keyTakeaways = Array.isArray(shortArticle?.key_takeaways)
    ? shortArticle.key_takeaways.map((item) => normalizeText(item)).filter(Boolean)
    : []

  return (
    (body.length > 80 && body.toLowerCase() !== title) ||
    (subtitle.length > 40 && subtitle.toLowerCase() !== title) ||
    whyItMatters.length > 40 ||
    slides.some((slide) => slide.length > 30 && slide.toLowerCase() !== title) ||
    keyTakeaways.some((item) => item.length > 20 && item.toLowerCase() !== title)
  )
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
      const trendingTopics: SitemapTopicCandidate[] = Array.isArray(data.trending_topics) ? data.trending_topics : []
      for (const topic of trendingTopics) {
        const slug = normalizeTopicSlug(topic?.topic_key ?? topic?.id)
        const label = typeof topic?.title === 'string' && topic.title.trim()
          ? topic.title.trim()
          : slug
            ? formatTopicLabel(slug)
            : ''
        if (slug && isIndexableTopic({
          slug,
          label,
          articleCount: topic.article_count,
          sourceCount: topic.source_count,
          timelineCount: topic.timeline?.length,
          keyPointCount: topic.key_points?.length,
        })) {
          topics.add(slug)
        }
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
        const data = doc.data() as SitemapTopicCandidate
        const slug = normalizeTopicSlug(data.topic_key ?? data.id ?? doc.id)
        const rawLabel = data.display_name || data.name
        const label = typeof rawLabel === 'string' && rawLabel.trim()
          ? rawLabel.trim()
          : slug
            ? formatTopicLabel(slug)
            : ''
        if (slug && isIndexableTopic({
          slug,
          label,
          articleCount: data.article_count ?? data.articles?.length,
        })) {
          topics.add(slug)
        }
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
        const data = doc.data() as SitemapArticleCandidate
        if (!isIndexableArticle(data)) return
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
  const [topics, articlePages, dailyArchiveEntries] = await Promise.all([
    getTopicSlugs(),
    getPublicArticlePages(baseUrl),
    getDailyArchiveEntries(365),
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
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/solutions`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/use-cases`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/resources`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/newsletters`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/how-it-works`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/trending`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
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
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/delete-account`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/daily`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  const topicPages: MetadataRoute.Sitemap = topics.map((topic) => ({
    url: `${baseUrl}/topics/${topic}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.75,
  }))

  const blogCategoryArchives: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/blog/category/comparisons`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/blog/category/guides`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/blog/category/ai-tools`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/blog/category/research`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
  ];

  const blogPages: MetadataRoute.Sitemap = [
    ...blogPosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...standaloneBlogPosts
      .filter((post) => !blogPosts.some((candidate) => candidate.slug === post.slug))
      .map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: new Date(post.date),
        changeFrequency: 'monthly' as const,
        priority: 0.75,
      })),
    ...blogCategoryArchives,
  ];

  const compareDetailPages: MetadataRoute.Sitemap = comparePages.map((page) => ({
    url: `${baseUrl}/compare/${page.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.72,
  }));

  const solutionsDetailPages: MetadataRoute.Sitemap = solutionsContent.map((page) => ({
    url: `${baseUrl}/solutions/${page.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.72,
  }));

  const useCasesDetailPages: MetadataRoute.Sitemap = useCasesContent.map((page) => ({
    url: `${baseUrl}/use-cases/${page.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.72,
  }));

  const newslettersDetailPages: MetadataRoute.Sitemap = newslettersContent.map((page) => ({
    url: `${baseUrl}/newsletters/${page.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.72,
  }));

  const dailyArchivePages: MetadataRoute.Sitemap = dailyArchiveEntries.map((entry) => ({
    url: `${baseUrl}/daily/${entry.date}`,
    lastModified: entry.assembledAt ? new Date(entry.assembledAt) : new Date(`${entry.date}T00:00:00Z`),
    changeFrequency: 'weekly' as const,
    priority: 0.68,
  }));

  return [
    ...staticPages,
    ...topicPages,
    ...blogPages,
    ...compareDetailPages,
    ...solutionsDetailPages,
    ...useCasesDetailPages,
    ...newslettersDetailPages,
    ...articlePages,
    ...dailyArchivePages,
  ];
}
