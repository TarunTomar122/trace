import { MetadataRoute } from 'next'

const TRENDING_TOPICS = [
  'frontend-performance',
  'design',
  'ai-agents',
  'startups',
  'music-production',
  'vibe-coding',
] as const;
 
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.yourtrace.online'
  
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
      url: `${baseUrl}/feed`,
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
  ];

  // Trending topic pages - high priority for SEO
  const trendingPages: MetadataRoute.Sitemap = TRENDING_TOPICS.map((topic) => ({
    url: `${baseUrl}/trending/${topic}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...trendingPages];
}
