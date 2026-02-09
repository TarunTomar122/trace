import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Sparkles, Calendar, Youtube, BookOpen, MessageCircle, ArrowUpRight, Newspaper } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import { adminFirestore } from '@/lib/firebase-admin';

// Use dynamic rendering to avoid build-time API calls
export const dynamic = 'force-dynamic';
export const revalidate = 14400; // Revalidate every 4 hours

const ALLOWED_TOPICS = [
  'mental-wellness',
  'health-fitness',
  'relationships',
  'money',
  'career',
  'learning',
  'productivity',
  'creativity',
  'travel',
  'culture',
] as const;

const TOPIC_DISPLAY_NAMES: Record<string, string> = {
  'mental-wellness': 'Mental Wellness',
  'health-fitness': 'Health & Fitness',
  'relationships': 'Relationships',
  'money': 'Money & Personal Finance',
  'career': 'Career & Work',
  'learning': 'Learning & Skills',
  'productivity': 'Productivity',
  'creativity': 'Creativity',
  'travel': 'Travel & Adventure',
  'culture': 'Culture & Entertainment',
};

type FeedItem = {
  id: string;
  type: string;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string | null;
  tags?: string[];
  metadata?: {
    why_relevant?: string;
  };
};

const sourceConfig: Record<string, { icon: typeof Youtube; color: string; label: string }> = {
  video: { icon: Youtube, color: 'text-red-500', label: 'Video' },
  blog: { icon: BookOpen, color: 'text-emerald-500', label: 'Article' },
  discussion: { icon: MessageCircle, color: 'text-amber-500', label: 'Discussion' },
  news: { icon: Newspaper, color: 'text-sky-500', label: 'News' },
};

function FeedCard({ item }: { item: FeedItem }) {
  const itemKind = item.type || 'blog';
  const config = sourceConfig[itemKind] || sourceConfig.blog;
  const host = (() => {
    try {
      return new URL(item.url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  })();

  const bgColors: Record<string, string> = {
    video: 'bg-red-50 dark:bg-red-950',
    blog: 'bg-emerald-50 dark:bg-emerald-950',
    discussion: 'bg-amber-50 dark:bg-amber-950',
    news: 'bg-sky-50 dark:bg-sky-950',
  };

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block p-4 md:p-5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer"
    >
      <div className="flex items-start gap-3 md:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <span className={`text-[10px] font-medium uppercase tracking-wider ${config.color}`}>
              {config.label}
            </span>
            {host && (
              <span className="text-[10px] font-mono text-secondary/50">
                {host}
              </span>
            )}
          </div>

          <div className="mb-2 md:mb-3">
            <h3 className="text-base md:text-lg font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {item.title}
              <ArrowUpRight
                size={14}
                className="inline ml-1 opacity-40 md:opacity-0 group-hover:opacity-60 transition-opacity"
              />
            </h3>
          </div>

          {item.metadata?.why_relevant && (
            <p className="text-[11px] text-primary/70">
              {item.metadata.why_relevant}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}


function getTodayIstDate(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}


async function getLatestTrendingDate(): Promise<string | null> {
  if (!adminFirestore) return null;
  const snapshot = await adminFirestore
    .collection('trending_news')
    .orderBy('date', 'desc')
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id || snapshot.docs[0].data().date || null;
}


async function getTopicData(topicId: string) {
  // Validate topic
  if (!ALLOWED_TOPICS.includes(topicId as typeof ALLOWED_TOPICS[number])) {
    console.log('[getTopicData] Topic not allowed:', topicId);
    return null;
  }

  try {
    if (!adminFirestore) {
      console.error('[getTopicData] Firebase Admin not initialized');
      return null;
    }

    console.log('[getTopicData] Fetching trending topic from Firestore:', topicId);

    const today = getTodayIstDate();
    const latestDate = await getLatestTrendingDate();
    const dateToUse = latestDate || today;

    const topicDoc = await adminFirestore
      .collection('trending_news')
      .doc(dateToUse)
      .collection('topics')
      .doc(topicId)
      .get();

    if (!topicDoc.exists) {
      console.log('[getTopicData] Topic not found in trending_news:', topicId);
      return null;
    }

    const topicData = topicDoc.data();
    const articles = (topicData?.articles || []).slice(0, 10);

    const items = articles.map((item: any, idx: number) => ({
      id: `${topicId}_news_${idx}`,
      type: 'news',
      title: item.title || '',
      description: item.content || '',
      url: item.url || '',
      tags: [topicId],
      source: 'tavily',
      metadata: {
        why_relevant: `Trending in ${TOPIC_DISPLAY_NAMES[topicId]}`,
      },
    }));

    console.log('[getTopicData] Topic data fetched, items count:', items.length);

    return {
      topic_id: topicId,
      display_name: topicData?.display_name || TOPIC_DISPLAY_NAMES[topicId],
      items,
      updated_at: topicData?.generated_at || null,
      total: items.length,
    };
  } catch (error) {
    console.error('[getTopicData] Error fetching topic:', error);
    return null;
  }
}

export default async function TrendingTopicPage({ 
  params 
}: { 
  params: Promise<{ topic: string }> 
}) {
  const { topic } = await params;
  
  // Validate topic is allowed - 404 if not
  if (!ALLOWED_TOPICS.includes(topic as typeof ALLOWED_TOPICS[number])) {
    notFound();
  }
  
  const topicData = await getTopicData(topic);
  const { items = [], display_name } = topicData || {};
  const displayName = display_name || TOPIC_DISPLAY_NAMES[topic] || topic;
  const updatedAtRaw = topicData?.updated_at;
  const updatedAt = (() => {
    if (!updatedAtRaw) return null;
    if (typeof updatedAtRaw === 'string' || typeof updatedAtRaw === 'number') {
      const date = new Date(updatedAtRaw);
      return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
    }
    if (typeof updatedAtRaw === 'object' && typeof updatedAtRaw.seconds === 'number') {
      const date = new Date(updatedAtRaw.seconds * 1000);
      return date.toLocaleDateString();
    }
    return null;
  })();

  // Structured data for SEO
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${displayName} - Trending`,
    description: `Latest ${displayName.toLowerCase()} articles curated from across the web`,
    url: `https://www.yourtrace.online/trending/${topic}`,
    publisher: {
      '@type': 'Organization',
      name: 'Trace',
      url: 'https://www.yourtrace.online',
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Trending',
          item: 'https://www.yourtrace.online/trending',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: displayName,
          item: `https://www.yourtrace.online/trending/${topic}`,
        },
      ],
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.slice(0, 10).map((item: FeedItem, index: number) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': item.type === 'video' ? 'VideoObject' : 'Article',
          name: item.title,
          url: item.url,
          description: item.description || '',
        },
      })),
    },
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <PublicHeader backHref="/trending" backLabel="Back to Trending" />

      <main className="w-full mt-6 md:mt-12">
        <div className="max-w-2xl mx-auto px-4 md:px-6">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-2">
              {displayName}
            </h1>
            <p className="text-sm text-secondary">
              Latest articles curated from across the web — free to browse.
            </p>
            {updatedAt && (
              <div className="mt-3 flex items-center gap-2 text-xs text-secondary/70">
                <Calendar size={14} className="text-secondary/50" />
                Updated {updatedAt}
              </div>
            )}
          </div>

          {/* Value summary */}
            <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 md:p-6 mb-8">
            <h2 className="text-base md:text-lg font-semibold text-foreground mb-2">
              Why this topic matters
            </h2>
            <p className="text-sm text-secondary leading-relaxed">
              Trace curates the most relevant {displayName.toLowerCase()} signal so you can stay informed without getting lost in noise.
              Use this page to scan what’s trending — then unlock a personalized feed when you want it tailored to you.
            </p>
          </div>

          {/* Content */}
          {items.length > 0 ? (
            <div className="divide-y divide-border/10 mb-8">
              {items.map((item: FeedItem) => (
                <FeedCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles size={24} className="text-foreground" />
              </div>
              <p className="text-lg font-semibold text-foreground mb-2">No content yet</p>
              <p className="text-sm text-secondary">
                Check back soon for fresh content!
              </p>
            </div>
          )}

          {/* CTA to sign in */}
          <div className="py-8 md:py-12">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 md:p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={22} className="text-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-base font-semibold text-foreground mb-2">
                Want the complete feed?
              </p>
              <p className="text-sm text-secondary mb-6">
                Sign in to get a feed pulling from hundreds of sources — curated around your interests.
              </p>
              <Link href="/">
                <button className="bg-foreground text-background px-6 py-3 rounded-full text-sm font-medium hover:bg-foreground/90 transition-all">
                  Unlock full feed
                </button>
              </Link>
            </div>
          </div>

          {/* Related topics */}
          <div className="pb-12">
            <h3 className="text-base font-semibold text-foreground mb-3">Explore related topics</h3>
            <div className="flex flex-wrap gap-2">
              {ALLOWED_TOPICS.filter((t) => t !== topic).map((t) => (
                <Link
                  key={t}
                  href={`/trending/${t}`}
                  className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-secondary/80 hover:text-foreground hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {TOPIC_DISPLAY_NAMES[t]}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Allow dynamic params - pages generated on first request
export const dynamicParams = true;

// Generate metadata for SEO
export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ topic: string }> 
}): Promise<Metadata> {
  const { topic } = await params;
  const displayName = TOPIC_DISPLAY_NAMES[topic] || topic;
  
  return {
    title: `${displayName} - Trending on Trace`,
    description: `Latest ${displayName.toLowerCase()} articles curated from across the web. Stay updated without the noise.`,
    keywords: [
      displayName,
      `${displayName} news`,
      `${displayName} articles`,
      `${displayName} trends`,
      'curated content',
      'curated topics',
      'focus',
      'wellness',
    ],
    openGraph: {
      title: `${displayName} - Trending on Trace`,
      description: `Latest ${displayName.toLowerCase()} content curated from across the web`,
      type: 'website',
      url: `https://www.yourtrace.online/trending/${topic}`,
      siteName: 'Trace',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName} - Trending on Trace`,
      description: `Latest ${displayName.toLowerCase()} content curated from across the web`,
    },
    alternates: {
      canonical: `https://www.yourtrace.online/trending/${topic}`,
    },
  };
}
