import { MetadataRoute } from 'next'
import { blogPosts } from './blog/content'
import { standaloneBlogPosts } from './blog/standalone-content'
import { adminFirestore } from '@/lib/firebase-admin'
import { comparePages } from './compare/content'
import { solutionsContent } from './solutions/content'
import { useCasesContent } from './use-cases/content'
import { newslettersContent } from './newsletters/content'
import { listEditionDates } from '@/lib/daily-editions'

// Rebuilt hourly: a new /brief edition is published every morning.
export const revalidate = 3600


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

function looksLikeRawSource(value: string): boolean {
  return /(^|[-_/])(rss|feed)([-_/]|$)|\.com|\.ai|blog-rss/i.test(value)
}

function normalizeText(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim()
}

// Only emit lastModified when we have a source-backed content date. A deployment
// timestamp on every URL makes the whole sitemap look freshly changed every day.
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

// The sitemap is prerendered at build, and Next fails the whole deploy if a
// page takes over 60s. A slow database gets the static pages only; the hourly
// revalidate fills the rest in later.
const DATA_TIMEOUT_MS = 20_000

function withTimeout<T>(work: Promise<T>, fallback: T, label: string): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.error(`[sitemap] ${label} took over ${DATA_TIMEOUT_MS / 1000}s; left out this time`)
      resolve(fallback)
    }, DATA_TIMEOUT_MS)
    work.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); console.error(`[sitemap] ${label} failed:`, error); resolve(fallback) },
    )
  })
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.yourtrace.online'
  const [articlePages, editions] = await Promise.all([
    withTimeout(getPublicArticlePages(baseUrl), [], 'article pages'),
    withTimeout(listEditionDates(365), [], 'brief editions'),
  ])

  // One public page per daily brief, plus the archive. lastModified is the
  // publish time, a real content date.
  const dailyPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/brief`, changeFrequency: 'daily', priority: 0.85 },
    ...editions.map((edition) => ({
      url: `${baseUrl}/brief/${edition.date}`,
      ...(edition.published_at ? { lastModified: edition.published_at } : {}),
      changeFrequency: 'never' as const,
      priority: 0.6,
    })),
  ]
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/compare`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/solutions`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/use-cases`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/resources`,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/agents`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/newsletters`,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/how-it-works`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/delete-account`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/blog`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  const blogCategoryArchives: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/blog/category/comparisons`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/blog/category/guides`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/blog/category/ai-tools`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/blog/category/research`, changeFrequency: 'weekly' as const, priority: 0.8 },
  ];

  const blogPages: MetadataRoute.Sitemap = [
    ...blogPosts.map((post) => {
      const changed = Date.parse(post.updated || post.date)
      const isRecent = Number.isFinite(changed) && changed > Date.now() - 45 * 24 * 60 * 60 * 1000
      return {
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: Number.isFinite(changed) ? new Date(changed) : new Date(),
        changeFrequency: (isRecent ? 'weekly' : 'monthly') as 'weekly' | 'monthly',
        priority: isRecent ? 0.85 : 0.7,
      }
    }),
    ...standaloneBlogPosts
      .filter((post) => !blogPosts.some((candidate) => candidate.slug === post.slug))
      .map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: new Date(post.updated || post.date),
        changeFrequency: 'monthly' as const,
        priority: 0.75,
      })),
    ...blogCategoryArchives,
  ];

  const compareDetailPages: MetadataRoute.Sitemap = comparePages.map((page) => ({
    url: `${baseUrl}/compare/${page.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.72,
  }));

  const solutionsDetailPages: MetadataRoute.Sitemap = solutionsContent.map((page) => ({
    url: `${baseUrl}/solutions/${page.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.72,
  }));

  const useCasesDetailPages: MetadataRoute.Sitemap = useCasesContent.map((page) => ({
    url: `${baseUrl}/use-cases/${page.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.72,
  }));

  const newslettersDetailPages: MetadataRoute.Sitemap = newslettersContent.map((page) => ({
    url: `${baseUrl}/newsletters/${page.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.72,
  }));



  return [
    ...staticPages,
    ...dailyPages,
    ...blogPages,
    ...compareDetailPages,
    ...solutionsDetailPages,
    ...useCasesDetailPages,
    ...newslettersDetailPages,
    ...articlePages,
  ];
}
