import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Sparkles,
  ArrowUpRight,
  BookOpen,
  MessageCircle,
  Newspaper,
  Youtube,
  Code,
  Rocket,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PublicHeader from '@/components/PublicHeader';
import { adminFirestore } from '@/lib/firebase-admin';

// Dynamic — fetches fresh data on each request
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // cache for 1 hour

export const metadata: Metadata = {
  title: "Today's Top Reads — Trace",
  description:
    "The most interesting articles from hundreds of sources, curated and summarized daily. Free to read.",
  keywords: [
    'daily reads',
    'curated articles',
    'content curation',
    'trending articles',
    'tech news',
    'RSS alternative',
    'Trace',
  ],
  alternates: {
    canonical: 'https://www.yourtrace.online/trending',
  },
  openGraph: {
    title: "Today's Top Reads — Trace",
    description:
      "The most interesting articles from hundreds of sources, curated daily. Free to read.",
    url: 'https://www.yourtrace.online/trending',
    type: 'website',
    siteName: 'Trace',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Today's Top Reads — Trace",
    description:
      "The most interesting articles from hundreds of sources, curated daily.",
  },
};

type TrendingItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  type: string;
  source: string;
  tags: string[];
  thumbnail?: string;
  fullSummary?: {
    short_article?: {
      subtitle?: string;
      body?: string;
      outline?: string[];
    };
  };
};

const typeConfig: Record<string, { icon: typeof BookOpen; color: string; label: string }> = {
  blog: { icon: BookOpen, color: 'text-emerald-600', label: 'Article' },
  news: { icon: Newspaper, color: 'text-orange-500', label: 'News' },
  discussion: { icon: MessageCircle, color: 'text-amber-500', label: 'Discussion' },
  video: { icon: Youtube, color: 'text-red-500', label: 'Video' },
  repo: { icon: Code, color: 'text-violet-500', label: 'Repo' },
  launch: { icon: Rocket, color: 'text-fuchsia-500', label: 'Launch' },
};


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


function shortHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}


async function getTodaysItems(): Promise<{ items: TrendingItem[]; date: string }> {
  if (!adminFirestore) {
    return { items: [], date: getTodayIstDate() };
  }

  // Use latest trending_news date (same source as mobile app)
  const today = getTodayIstDate();
  const latestDate = await getLatestTrendingDate();
  const dateToUse = latestDate || today;

  const topicsSnapshot = await adminFirestore
    .collection('trending_news')
    .doc(dateToUse)
    .collection('topics')
    .get();

  if (topicsSnapshot.empty) {
    return { items: [], date: dateToUse };
  }

  type RawArticle = {
    title?: string;
    subtitle?: string;
    details?: string;
    url?: string;
    source_domain?: string;
    thumbnail?: string;
    published_date?: string;
  };

  const allArticles: RawArticle[] = [];
  topicsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const articles = (data?.articles || []) as RawArticle[];
    allArticles.push(...articles);
  });

  // Dedupe + latest-first, then cap at 6 to match mobile
  const seen = new Set<string>();
  const deduped = allArticles.filter((a) => {
    const url = (a.url || '').trim();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  deduped.sort((a, b) =>
    String(b.published_date || '').localeCompare(String(a.published_date || ''))
  );

  const items: TrendingItem[] = deduped.slice(0, 6).map((item, idx) => ({
    id: item.url ? `trending-${idx}-${shortHash(item.url)}` : `trending-${idx}`,
    title: item.title || '',
    url: item.url || '',
    summary: item.details || '',
    type: 'news',
    source: item.source_domain || '',
    tags: [],
    thumbnail: item.thumbnail || undefined,
    fullSummary: (item.subtitle || item.details)
      ? {
          short_article: {
            subtitle: item.subtitle || '',
            body: item.details || '',
            outline: [],
          },
        }
      : undefined,
  }));

  return { items, date: dateToUse };
}


function ItemCard({ item, index }: { item: TrendingItem; index: number }) {
  const config = typeConfig[item.type] || typeConfig.blog;
  const Icon = config.icon;
  const host = (() => {
    try {
      return new URL(item.url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  })();

  return (
    <article className="py-6 first:pt-0">
      <div className="flex items-start gap-4">

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Icon size={13} className={config.color} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>
                {config.label}
              </span>
            </div>
            {host && (
              <span className="text-[10px] font-mono text-secondary/40">
                {host}
              </span>
            )}
          </div>

          {/* Title */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group"
          >
            <h2 className="text-xl font-semibold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors">
              {item.title}
              <ArrowUpRight
                size={14}
                className="inline ml-1 opacity-0 group-hover:opacity-60 transition-opacity"
              />
            </h2>
          </a>

          {/* Subtitle */}
          {item.fullSummary?.short_article?.subtitle && (
            <p className="text-base text-secondary/70 italic mb-3">
              {item.fullSummary.short_article.subtitle}
            </p>
          )}

          {/* Article image */}
          {item.thumbnail && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="block mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.thumbnail}
                alt=""
                className="w-full h-auto rounded-lg border border-border/30 object-cover max-h-72"
                loading="lazy"
              />
            </a>
          )}

          {/* Full summary (markdown) or fallback to abbreviated HTML */}
          {item.fullSummary?.short_article?.body ? (
            <div className="prose prose-sm max-w-none text-secondary/80 prose-headings:font-semibold prose-headings:text-foreground prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-p:leading-relaxed prose-p:mb-3 prose-ul:my-2 prose-li:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {item.fullSummary.short_article.body}
              </ReactMarkdown>
            </div>
          ) : item.summary ? (
            <div
              className="text-sm text-secondary/80 leading-relaxed [&_strong]:text-foreground [&_strong]:font-semibold [&_ul]:mt-1.5 [&_ul]:ml-4 [&_ul]:list-disc [&_li]:text-sm [&_li]:text-secondary/70 [&_li]:mb-0.5"
              dangerouslySetInnerHTML={{ __html: item.summary }}
            />
          ) : null}

          {/* Read more */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-xs font-semibold text-foreground hover:text-primary transition-colors"
          >
            Read full article →
          </a>
        </div>
      </div>
    </article>
  );
}


export default async function TrendingPage() {
  const { items, date } = await getTodaysItems();

  // Format date nicely
  const displayDate = (() => {
    try {
      const d = new Date(date + 'T00:00:00');
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  })();

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showHome={true} backHref="/" backLabel="Back to Home" />

      <main className="w-full mt-6 md:mt-12">
        <div className="max-w-2xl mx-auto px-4 md:px-6">
          {/* Header */}
          <div className="mb-8 md:mb-10">
            <p className="text-xs font-medium uppercase tracking-widest text-secondary/50 mb-2">
              {displayDate}
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-2">
              Today&apos;s Top Reads
            </h1>
            <p className="text-sm text-secondary">
              The most interesting reads from hundreds of sources, curated and summarized daily. Free to read.
            </p>
          </div>

          {/* Items */}
          {items.length > 0 ? (
            <div className="divide-y divide-gray-400 dark:divide-gray-600 mb-12">
              {items.map((item, i) => (
                <ItemCard key={item.id || i} item={item} index={i} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles size={24} className="text-foreground" />
              </div>
              <p className="text-lg font-semibold text-foreground mb-2">
                Today&apos;s reads are on the way
              </p>
              <p className="text-sm text-secondary max-w-sm mx-auto">
                We pull the best content from hundreds of sources every morning. Check back soon — or subscribe to get them in your inbox.
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 md:p-8 text-center mb-12">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={22} className="text-foreground" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Want a feed curated just for you?
            </h2>
            <p className="text-sm text-secondary mb-6 max-w-lg mx-auto">
              Sign up for Trace and get content from hundreds of sources — filtered by your interests, summarized, and delivered daily.
            </p>
            <Link href="/">
              <button className="bg-foreground text-background px-6 py-3 rounded-full text-sm font-medium hover:bg-foreground/90 transition-all">
                Build your feed
              </button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
