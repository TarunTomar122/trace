import { CHROME_EXTENSION_URL } from './product-links.ts';

export const HOME_PRODUCT_DESCRIPTION =
  'Trace groups AI and technology news into a short personalized feed, so you can catch model launches, company changes, layoffs, security updates, and new trends in five minutes.';

export const HOME_FAQ_ITEMS = [
  {
    q: 'Is Trace free?',
    a: 'Yes. The free plan includes your AI and technology news feed, five unique AI summaries each day, original source links, and bookmarks with a free account.',
  },
  {
    q: 'What counts as one AI summary?',
    a: 'Opening a new story summary counts once. You can reopen the same summary without using another read, and original publisher links remain available without a limit.',
  },
  {
    q: 'Where does Trace get its news?',
    a: 'Trace follows established technology publications, company announcements, research teams, and useful independent sources. Related reports are grouped while every original link stays attached.',
  },
  {
    q: 'Does Trace link to the original publisher?',
    a: 'Yes. Every story keeps its original publisher link, so you can read the complete report and support the publication that produced it.',
  },
  {
    q: 'Where can I use Trace?',
    a: 'Trace is available as a Chrome new-tab extension, a web feed, and an Android app. On iPhone or iPad, open Trace in Safari and use Add to Home Screen for an app-like shortcut.',
  },
  {
    q: 'What does Trace Pro include?',
    a: 'Trace Pro includes unlimited AI summaries in the web feed, search across your complete saved archive, the complete daily archive, the full personalized feed, and read-only Agent Access. It is $2.99 a month after a 3-day free trial.',
  },
] as const;

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
    downloadUrl: CHROME_EXTENSION_URL,
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
      CHROME_EXTENSION_URL,
      'https://play.google.com/store/apps/details?id=online.yourtrace.app',
    ],
  };
}
