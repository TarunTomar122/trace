import { MetadataRoute } from 'next';

/**
 * Public pages (/, /brief, /blog, /compare, /newsletters, /tools, /contact, etc.) are allowed.
 * Disallowed: the app feed, signed-in and OAuth routes, the API, dev pages and private
 * sponsor stats (/sponsor/<id>). Served as /robots.txt; don't add a public/robots.txt, it would win.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          /* In-app feed shell (not public /articles/ topic pages) */
          '/feed',
          '/feed/',
          '/auth/',
          '/profile',
          '/onboarding',
          '/oauth/',
          '/bookmarks',
          '/dev',
          '/sponsor/',
        ],
      },
    ],
    sitemap: 'https://www.yourtrace.online/sitemap.xml',
  };
}

