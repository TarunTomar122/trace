export const HOME_PRODUCT_DESCRIPTION =
  'Trace groups AI and technology news into a short personalized feed, so you can catch model launches, company changes, layoffs, security updates, and new trends in five minutes.';

export function generateHomeApplicationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': 'https://www.yourtrace.online/#software-application',
    name: 'Trace',
    url: 'https://www.yourtrace.online/',
    description: HOME_PRODUCT_DESCRIPTION,
    applicationCategory: 'NewsApplication',
    operatingSystem: 'Web, Chrome, Android',
    downloadUrl: 'https://chromewebstore.google.com/detail/cblkklekbejbbpcaihfogdmaoofmikbk',
    featureList: [
      'AI and technology news aggregation',
      'Related story grouping with source links',
      'Personalized AI and technology news feed',
      'AI summaries for major technology stories',
      'Bookmarks synced across web devices',
      'Read-only Agent Access for AI tools',
    ],
    audience: {
      '@type': 'Audience',
      audienceType: 'People who follow artificial intelligence and technology news',
    },
    publisher: {
      '@id': 'https://www.yourtrace.online/#organization',
    },
    sameAs: [
      'https://chromewebstore.google.com/detail/cblkklekbejbbpcaihfogdmaoofmikbk',
      'https://play.google.com/store/apps/details?id=online.yourtrace.app',
    ],
  };
}
