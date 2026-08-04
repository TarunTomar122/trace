export const HOME_PRODUCT_DESCRIPTION =
  'Trace is a focused AI and developer news aggregator for technology news, open-source projects, technical discussions, videos, and independent writing.';

export const HOME_FAQ_ITEMS = [
  {
    q: 'What is Trace?',
    a: 'Trace is a focused AI and developer news aggregator. It combines technology news with open-source projects, technical discussions, videos, and independent practitioner writing.',
  },
  {
    q: 'Which sources does Trace bring together?',
    a: 'Trace follows developer-focused sources including Hacker News, GitHub, independent engineering blogs, AI research and product teams, technical creators, and product launch communities.',
  },
  {
    q: 'How does Trace reduce information overload?',
    a: 'Trace groups related coverage, summarizes the useful context, and keeps original source links attached. The live Pulse shows what is moving while the daily Edition gives you a finite catch-up view.',
  },
  {
    q: 'Can I personalize Trace for my interests?',
    a: 'Yes. After signing in, you can build a feed around the technology and builder topics you care about instead of following one generic news homepage.',
  },
  {
    q: 'Can I explore Trace without an account?',
    a: 'Yes. You can browse homepage previews, guides, comparisons, and daily archive pages without an account. Sign in to open the live feed and use personalized reading features.',
  },
  {
    q: 'What does Trace Pro include?',
    a: 'Trace Pro includes the complete feed, every summary and key takeaway, source links, bookmarks, and read-only Agent Access. You can try it for 3 days with no charge during the trial.',
  },
  {
    q: 'Where can I use Trace?',
    a: 'Trace is available on the web and as an Android app on Google Play.',
  },
] as const;

export const HOME_COMPARISON_ROWS = [
  {
    label: 'Daily catch-up',
    manual: 'Open and refresh separate news sites, repositories, blogs, and community feeds.',
    trace: 'Scan one live Pulse or finish a finite daily Edition.',
  },
  {
    label: 'Duplicate coverage',
    manual: 'Work out which links describe the same story and what each source adds.',
    trace: 'Related coverage is grouped into one story with its source trail intact.',
  },
  {
    label: 'Developer context',
    manual: 'Track news, projects, discussions, videos, and practitioner writing separately.',
    trace: 'See those surfaces together in one builder-focused feed.',
  },
  {
    label: 'Going deeper',
    manual: 'Keep a personal tab stack or reading backlog.',
    trace: 'Open the original source only when a story deserves more time.',
  },
] as const;

export const HOME_INTENT_LINKS = [
  { href: '/blog/free-news-aggregators-for-developers', label: 'News aggregators for developers' },
  { href: '/blog/how-to-stay-updated-on-tech-without-doomscrolling', label: 'Stay current without doomscrolling' },
  { href: '/compare/rss-reader-alternative', label: 'Trace vs RSS readers' },
  { href: '/blog/ai-news-for-developers', label: 'AI news for developers' },
] as const;

export function generateHomeApplicationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': 'https://www.yourtrace.online/#software-application',
    name: 'Trace',
    url: 'https://www.yourtrace.online/',
    description: HOME_PRODUCT_DESCRIPTION,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web, Android',
    downloadUrl: 'https://play.google.com/store/apps/details?id=online.yourtrace.app',
    featureList: [
      'AI and developer news aggregation',
      'Related story grouping with source links',
      'Open-source project discovery',
      'Technical discussion and video summaries',
      'Live Pulse and finite daily Edition',
      'Read-only Agent Access for AI tools',
    ],
    audience: {
      '@type': 'Audience',
      audienceType: 'Software developers and technology professionals',
    },
    publisher: {
      '@id': 'https://www.yourtrace.online/#organization',
    },
    sameAs: [
      'https://play.google.com/store/apps/details?id=online.yourtrace.app',
    ],
  };
}
