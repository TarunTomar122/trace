import { MetadataRoute } from 'next';

/**
 * Public marketing + SEO pages (/, /daily, /trending, /articles, /topics, /blog, /compare, /tools, /contact, etc.)
 * are allowed. Only app-authenticated, API, and internal routes are disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/feed',
          '/feed/',
          '/auth/',
          '/profile',
          '/onboarding',
          '/bookmarks',
          '/dev',
        ],
      },
    ],
    sitemap: 'https://www.yourtrace.online/sitemap.xml',
  };
}

