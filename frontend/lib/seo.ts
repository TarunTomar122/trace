/**
 * Shared SEO utilities for structured data, canonical URLs, and metadata.
 * Keep all SEO helpers in one place so they're easy to audit and update.
 */

// ─── Base URL ────────────────────────────────────────────────────────────────
export const SITE_BASE_URL = 'https://www.yourtrace.online';
export const SITE_NAME = 'Trace';
export const SITE_DESCRIPTION =
  'Stories, conversations, and product launches from 50+ sources — grouped into one scannable daily pulse so you stay current without the tab stack.';
export const SITE_LOGO_URL = `${SITE_BASE_URL}/trace.png`;
export const DEFAULT_OG_IMAGE = {
  url: `${SITE_BASE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: 'Trace — Your daily tech, in one place',
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BlogPostStructuredData {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  authorUrl?: string;
  imageUrl?: string;
  publisherName?: string;
  publisherLogoUrl?: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

// ─── Structured Data Generators ──────────────────────────────────────────────

/**
 * Generates JSON-LD BlogPosting structured data for blog and article pages.
 */
export function generateBlogPostingSchema(data: BlogPostStructuredData): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: data.headline,
    description: data.description,
    url: data.url,
    datePublished: data.datePublished,
    dateModified: data.dateModified || data.datePublished,
    author: {
      '@type': 'Person',
      name: data.authorName || 'Tarun Tomar',
      url: data.authorUrl || 'https://x.com/tarat_211',
    },
    publisher: {
      '@type': 'Organization',
      name: data.publisherName || SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: data.publisherLogoUrl || SITE_LOGO_URL,
      },
    },
    ...(data.imageUrl
      ? {
          image: {
            '@type': 'ImageObject',
            url: data.imageUrl,
          },
        }
      : {}),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': data.url,
    },
    isAccessibleForFree: true,
    inLanguage: 'en-US',
  };
}

/**
 * Generates JSON-LD BreadcrumbList structured data.
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Generates JSON-LD FAQPage structured data.
 */
export function generateFAQSchema(faqs: FAQItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generates JSON-LD CollectionPage / Blog listing schema.
 */
export function generateCollectionPageSchema(
  name: string,
  description: string,
  url: string,
  itemUrls: string[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url,
    hasPart: itemUrls.map((itemUrl) => ({
      '@type': 'BlogPosting',
      url: itemUrl,
    })),
  };
}

// ─── Metadata Helpers ────────────────────────────────────────────────────────

/**
 * Canonical URL for a given path.
 */
export function canonicalUrl(path: string): string {
  return `${SITE_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Standard OpenGraph article tags.
 */
export function openGraphArticle(
  title: string,
  description: string,
  url: string,
  publishedTime: string,
  modifiedTime?: string,
) {
  return {
    type: 'article' as const,
    title,
    description,
    url,
    siteName: SITE_NAME,
    locale: 'en_US',
    publishedTime,
    modifiedTime: modifiedTime || publishedTime,
    authors: ['https://x.com/tarat_211'],
    images: [DEFAULT_OG_IMAGE],
  };
}

/**
 * Standard Twitter Card metadata (summary_large_image).
 */
export function twitterCard(title: string, description: string) {
  return {
    card: 'summary_large_image' as const,
    title,
    description,
    images: [`${SITE_BASE_URL}/twitter-image`],
    creator: '@tarat_211',
  };
}

/**
 * Generates a complete metadata-description for a blog post from front-matter style data.
 */
export function buildBlogPostMetadata(args: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  keywords?: string[];
}): {
  title: string;
  description: string;
  keywords: string[];
  alternates: { canonical: string };
  openGraph: Record<string, unknown>;
  twitter: Record<string, unknown>;
} {
  const url = canonicalUrl(args.path);
  return {
    title: args.title,
    description: args.description,
    keywords: args.keywords || [],
    alternates: { canonical: url },
    openGraph: openGraphArticle(args.title, args.description, url, args.datePublished, args.dateModified),
    twitter: twitterCard(args.title, args.description),
  };
}
