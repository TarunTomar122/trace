import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/profile',
          '/onboarding',
          '/bookmarks',
          '/dev',
        ],
      },
    ],
    sitemap: 'https://www.yourtrace.online/sitemap.xml',
  }
}

