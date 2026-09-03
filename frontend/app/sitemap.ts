import { MetadataRoute } from 'next'
import { blogPosts } from './blog/content'
import { standaloneBlogPosts } from './blog/standalone-content'
import { adminFirestore } from '@/lib/firebase-admin'
import { comparePages } from './compare/content'
import { solutionsContent } from './solutions/content'
import { useCasesContent } from './use-cases/content'
import { newslettersContent } from './newsletters/content'


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
  const [articlePages] = await Promise.all([
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
      url: `${baseUrl}/agents`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
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
  ];

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



  return [
    ...staticPages,
    ...blogPages,
    ...compareDetailPages,
    ...solutionsDetailPages,
    ...useCasesDetailPages,
    ...newslettersDetailPages,
    ...articlePages,
  ];
}
