import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { 
  Youtube, 
  BookOpen, 
  MessageCircle,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import { adminFirestore } from '@/lib/firebase-admin';

// Use dynamic rendering to avoid build-time API calls
export const dynamic = 'force-dynamic';
export const revalidate = 14400; // Revalidate every 4 hours

const ALLOWED_TOPICS = [
  'frontend-performance',
  'design',
  'ai-agents',
  'startups',
  'music-production',
  'vibe-coding',
] as const;

const TOPIC_DISPLAY_NAMES: Record<string, string> = {
  'frontend-performance': 'Frontend Performance',
  'design': 'Design',
  'ai-agents': 'AI Agents',
  'startups': 'Startups',
  'music-production': 'Music Production',
  'vibe-coding': 'Vibe Coding',
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
};

function FeedCard({ item }: { item: FeedItem }) {
  const itemKind = item.type || 'blog';
  const config = sourceConfig[itemKind] || sourceConfig.blog;
  const Icon = config.icon;

  return (
    <article className="group py-4 md:py-6 hover:bg-foreground/1 transition-colors">
      <div className="flex items-start gap-3 md:gap-4">
        {/* Source icon */}
        <div className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shrink-0 ${config.color} bg-current/5 border border-current/10`}>
          <Icon size={16} className={`${config.color} md:hidden`} strokeWidth={1.5} />
          <Icon size={18} className={`${config.color} hidden md:block`} strokeWidth={1.5} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Source label */}
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <span className={`text-[10px] font-mono uppercase tracking-widest ${config.color}`}>
              {config.label}
            </span>
          </div>
          
          {/* Title */}
          <a 
            href={item.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="group/link block mb-1.5 md:mb-2"
          >
            <h3 className="text-base md:text-lg font-serif leading-snug text-foreground group-hover/link:text-primary transition-colors">
              {item.title}
              <ArrowUpRight 
                size={14} 
                className="inline ml-1 opacity-40 md:opacity-0 group-hover/link:opacity-60 transition-opacity -translate-y-0.5" 
              />
            </h3>
          </a>

          {/* Description if available */}
          {item.description && (
            <p className="text-sm text-secondary/70 leading-relaxed font-mono mb-2">
              {item.description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
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

    console.log('[getTopicData] Fetching topic from Firestore:', topicId);
    
    // Fetch directly from Firestore
    const topicDoc = await adminFirestore
      .collection('topics')
      .doc(topicId)
      .get();

    if (!topicDoc.exists) {
      console.log('[getTopicData] Topic not found in Firestore:', topicId);
      return null;
    }

    const topicData = topicDoc.data();
    const latest = topicData?.latest || {};

    // Extract content - max 4 items total per topic
    const blogs = (latest.blogs || []).slice(0, 2);
    const discussions = (latest.discussions || []).slice(0, 1);
    const videos = (latest.videos || []).slice(0, 1);

    // Combine and format items
    const items = [
      ...blogs.map((item: any, idx: number) => ({
        id: `${topicId}_blog_${idx}`,
        type: 'blog',
        title: item.title || '',
        description: '',
        url: item.url || '',
        tags: [topicId],
        source: 'exa',
        metadata: {
          why_relevant: `Latest in ${TOPIC_DISPLAY_NAMES[topicId]}`,
        },
      })),
      ...discussions.map((item: any, idx: number) => ({
        id: `${topicId}_discussion_${idx}`,
        type: 'discussion',
        title: item.title || '',
        description: '',
        url: item.url || '',
        tags: [topicId],
        source: 'exa',
        metadata: {
          why_relevant: `Latest in ${TOPIC_DISPLAY_NAMES[topicId]}`,
        },
      })),
      ...videos.map((item: any, idx: number) => ({
        id: `${topicId}_video_${idx}`,
        type: 'video',
        title: item.title || '',
        description: '',
        url: item.url || '',
        thumbnail: item.thumbnail || null,
        tags: [topicId],
        source: 'youtube',
        metadata: {
          why_relevant: `Latest in ${TOPIC_DISPLAY_NAMES[topicId]}`,
        },
      })),
    ];

    console.log('[getTopicData] Topic data fetched, items count:', items.length);

    return {
      topic_id: topicId,
      display_name: topicData?.display_name || TOPIC_DISPLAY_NAMES[topicId],
      items,
      updated_at: topicData?.updated_at || null,
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

  // Structured data for SEO
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${displayName} - Trending`,
    description: `Latest ${displayName.toLowerCase()} articles, discussions, and videos`,
    url: `https://www.yourtrace.online/trending/${topic}`,
    publisher: {
      '@type': 'Organization',
      name: 'Trace',
      url: 'https://www.yourtrace.online',
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <PublicHeader backHref="/trending" backLabel="Back to Trending" />

      <main className="w-full mt-6 md:mt-12">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 md:mb-12">

            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-light tracking-tight text-foreground uppercase">
                {displayName}
              </h1>
            </div>
            
            <p className="text-sm md:text-base font-mono text-secondary/70">
              Latest articles, discussions, and videos curated from across the web
            </p>
          </div>

          {/* Content */}
          {items.length > 0 ? (
            <>
              <div className="divide-y divide-border/20">
                {items.map((item: FeedItem) => (
                  <FeedCard key={item.id} item={item} />
                ))}
              </div>

              {/* CTA to sign in */}
              <div className="py-8 md:py-12 border-t border-border/20">
                <div className="border-2 border-primary bg-primary/5 p-6 md:p-8 text-center">
                  <Sparkles size={24} className="text-primary mx-auto mb-4" strokeWidth={1.5} />
                  <p className="text-sm md:text-base font-serif text-foreground mb-2">
                    Want the complete feed?
                  </p>
                  <p className="text-xs md:text-sm font-mono text-secondary/70 mb-6">
                    Sign in to get personalized content curated daily for your interests
                  </p>
                  <Link href="/">
                    <button className="bg-primary text-primary-foreground px-6 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.25em] hover:bg-primary/90 transition-all active:scale-95">
                      Start Free Trial
                    </button>
                  </Link>
                </div>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="py-16 text-center">
              <div className="w-12 h-12 bg-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={24} className="text-primary" />
              </div>
              <p className="text-lg font-serif mb-2">No content yet</p>
              <p className="text-sm font-mono text-secondary">
                Check back soon for fresh content!
              </p>
            </div>
          )}
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
    description: `Latest ${displayName.toLowerCase()} articles, discussions, and videos curated from across the web. Stay updated with the newest trends and insights.`,
    keywords: [
      displayName,
      `${displayName} news`,
      `${displayName} articles`,
      `${displayName} trends`,
      'curated content',
      'tech news',
      'developer resources',
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