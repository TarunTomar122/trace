"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Loader2, Lock, ArrowRight, ChevronRight, ArrowLeft,
  Flame, Compass, GraduationCap, Share2, Check,
} from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';
import Header from '@/components/Header';
import {
  getV3UserFeed, V3UserFeed, FeedItem, TrendingTopic,
  TopicTimelineEvent, recordLastActive,
} from '@/lib/firestore';
import { getArticleImage } from '@/lib/fallback-images';

type FeedTab = 'trending' | 'for_you';

const TAB_CONFIG: { key: FeedTab; label: string; icon: React.ElementType }[] = [
  { key: 'trending', label: 'Trending', icon: Flame },
  { key: 'for_you', label: 'For You', icon: Compass },
];

const FREE_LIMITS = { for_you: 2, deep_dives: 1 };
const FEED_TOPIC_CACHE_KEY = 'trace_feed_selected_topic';
const ARTICLE_RETURN_TO_KEY = 'trace_article_returnTo';

const INTEREST_LABELS: Record<string, string> = {
  technology: 'Tech & Gadgets',
  ai: 'AI & Machine Learning',
  business: 'Business & Markets',
  startups: 'Startups',
  experience: 'Design & UX',
  engineering: 'Engineering',
  'business-market': 'Business & Markets',
  leadership: 'Leadership',
  marketing: 'Marketing & Growth',
  productivity: 'Productivity',
  fintech: 'Fintech',
  health: 'Health & Wellness',
  web3: 'Web3 & Crypto',
  climate: 'Climate & Energy',
};

const feedFetcher = (uid: string) => getV3UserFeed(uid);

function parseFeedTab(value: string | null): FeedTab | null {
  if (value === 'trending' || value === 'for_you') return value;
  return null;
}

const trendingFetcher = async () => {
  const res = await fetch('/api/public/trending');
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.items)) return [];
  return data.items.map((item: any): FeedItem => ({
    id: item.id,
    title: item.title,
    url: item.url,
    thumbnail: item.thumbnail,
    source_name: item.source,
    summary: { short_article: { subtitle: item.summary } },
  }));
};

function stripMarkdown(text: string): string {
  return (text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*#+\s*/gm, "")
    .trim();
}

function getTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const ts = new Date(dateStr).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 45%, 55%)`;
}

function getSourceInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function FeedBuildingLoader() {
  const steps = [
    'Scanning sources for fresh content...',
    'Matching articles to your interests...',
    'Generating personalized summaries...',
    'Almost there, assembling your feed...',
  ];
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setStepIdx((i) => (i + 1) % steps.length), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Loader2 size={28} className="animate-spin mb-4 text-secondary/40" />
      <p className="text-sm text-secondary/70 font-medium">{steps[stepIdx]}</p>
      <p className="text-xs text-secondary/40 mt-2">This usually takes about a minute</p>
    </div>
  );
}

/* ─── Trending Topic Cards ─── */

function TopicFeaturedCard({
  topic,
  onPress,
}: {
  topic: TrendingTopic;
  onPress: () => void;
}) {
  const imageUrl = getArticleImage(topic.thumbnail, topic.title);
  const fallbackUrl = getArticleImage(null, topic.title);
  const [showFallback, setShowFallback] = useState(false);

  return (
    <button onClick={onPress} className="w-full text-left group mb-6">
      <div className="relative aspect-[1.3/1] sm:aspect-[1.6/1] rounded-2xl overflow-hidden bg-surface-secondary">
        <img src={fallbackUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {!showFallback && (
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={() => setShowFallback(true)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
          <div className="flex items-center gap-2 mb-2">
            <Flame size={14} className="text-white/60" />
            <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wide">Featured</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white leading-snug line-clamp-2 mb-1">
            {topic.title}
          </h2>
          <p className="text-sm text-white/50 line-clamp-2 leading-relaxed max-w-xl">
            {stripMarkdown(topic.summary || '')}
          </p>
          <p className="text-xs text-white/40 mt-2">
            {topic.source_count} sources · {topic.article_count} updates
          </p>
        </div>
      </div>
    </button>
  );
}

function TopicListRow({
  topic,
  onPress,
}: {
  topic: TrendingTopic;
  onPress: () => void;
}) {
  const imageUrl = getArticleImage(topic.thumbnail, topic.title);
  const fallbackUrl = getArticleImage(null, topic.title);
  const [showFallback, setShowFallback] = useState(false);
  const summary = stripMarkdown(topic.summary || '');

  return (
    <button
      onClick={onPress}
      className="w-full text-left flex items-center gap-4 p-3.5 rounded-2xl hover:bg-surface-secondary transition-colors group"
    >
      <div className="relative w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-xl overflow-hidden bg-surface-secondary shrink-0">
        <img src={fallbackUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {!showFallback && (
          <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setShowFallback(true)} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[15px] leading-snug line-clamp-2 group-hover:text-secondary transition-colors">
          {topic.title}
        </h3>
        {summary && (
          <p className="text-sm text-secondary/50 line-clamp-1 leading-relaxed mt-1">
            {summary}
          </p>
        )}
        <p className="text-xs text-secondary/40 mt-1">
          {topic.source_count} sources · {topic.article_count} updates
        </p>
      </div>
      <ChevronRight size={16} className="text-secondary/30 shrink-0" />
    </button>
  );
}

/* ─── Topic Detail View (overview + key points + timeline) ─── */

function TopicDetailView({
  topic,
  onBack,
  onOpenArticle,
}: {
  topic: TrendingTopic;
  onBack: () => void;
  onOpenArticle: (item: FeedItem, options?: { returnTo?: string }) => void;
}) {
  const imageUrl = getArticleImage(topic.thumbnail, topic.title);
  const fallbackUrl = getArticleImage(null, topic.title);
  const [showFallback, setShowFallback] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    const slug = topic.topic_key || topic.id;
    const shareUrl = `https://www.yourtrace.online/topics/${slug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch { /* nothing */ }
  };

  const sortedTimeline = useMemo(() => {
    if (!topic.timeline) return [];
    return [...topic.timeline].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [topic.timeline]);

  const findArticle = useCallback((event: TopicTimelineEvent): FeedItem | null => {
    if (!event.article_url || !topic.articles) return null;
    return topic.articles.find(
      a => a.url === event.article_url && a.summary?.short_article?.body
    ) || null;
  }, [topic.articles]);

  return (
    <div>
      {/* Hero */}
      <div className="relative aspect-[1.2/1] sm:aspect-[1.4/1] rounded-2xl overflow-hidden bg-surface-secondary mb-6">
        <img src={fallbackUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {!showFallback && (
          <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setShowFallback(true)} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 transition-colors text-white text-xs font-medium"
          >
            {shareCopied ? <Check size={14} className="text-green-400" /> : <Share2 size={14} />}
            {shareCopied ? 'Copied!' : 'Share'}
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
          <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-1">
            {topic.title}
          </h1>
          <p className="text-xs text-white/40">
            {topic.source_count} sources · {topic.article_count} updates
          </p>
        </div>
      </div>

      {/* Overview */}
      {topic.summary && (
        <div className="mb-6">
          <div className="prose prose-sm dark:prose-invert max-w-none text-secondary leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{topic.summary}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Key Points */}
      {topic.key_points && topic.key_points.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-foreground mb-3">Key Points</h3>
          <div className="space-y-2.5">
            {topic.key_points.slice(0, 6).map((point, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary/30 mt-2 shrink-0" />
                <div className="text-sm text-secondary leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{point}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {sortedTimeline.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-foreground mb-4">Timeline</h3>
          <div className="relative pl-6 border-l-2 border-border/30">
            {sortedTimeline.map((event, i) => {
              const article = findArticle(event);
              const isClickable = !!article;

              return (
                <div key={event.id || i} className="relative pb-6 last:pb-0">
                  <div className={`absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 ${
                    i === 0 ? 'bg-foreground border-foreground' : 'bg-background border-secondary/30'
                  }`} />
                  {isClickable ? (
                    <button
                      onClick={() => {
                        const slug = topic.topic_key || topic.id;
                        sessionStorage.setItem(FEED_TOPIC_CACHE_KEY, JSON.stringify(topic));
                        onOpenArticle(article!, { returnTo: `/feed?topic=${encodeURIComponent(slug)}` });
                      }}
                      className="w-full text-left group hover:bg-surface-secondary rounded-xl p-3 -m-3 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] text-secondary/40">{getTimeAgo(event.timestamp)}</span>
                        {event.source_name && (
                          <>
                            <span className="text-secondary/20">·</span>
                            <span className="text-[11px] text-secondary/40">{event.source_name}</span>
                          </>
                        )}
                      </div>
                      <h4 className="text-sm font-medium text-foreground leading-snug mb-1 group-hover:text-secondary transition-colors">
                        {event.title}
                      </h4>
                      {event.summary && (
                        <p className="text-xs text-secondary/50 line-clamp-2 leading-relaxed">{stripMarkdown(event.summary)}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1.5 text-secondary/30">
                        <span className="text-[10px]">Read summary</span>
                        <ChevronRight size={12} />
                      </div>
                    </button>
                  ) : (
                    <div className="p-3 -m-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] text-secondary/40">{getTimeAgo(event.timestamp)}</span>
                        {event.source_name && (
                          <>
                            <span className="text-secondary/20">·</span>
                            <span className="text-[11px] text-secondary/40">{event.source_name}</span>
                          </>
                        )}
                      </div>
                      <h4 className="text-sm font-medium text-foreground leading-snug mb-1">
                        {event.title}
                      </h4>
                      {event.summary && (
                        <p className="text-xs text-secondary/50 line-clamp-2 leading-relaxed">{stripMarkdown(event.summary)}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── For You List Row (with source chip) ─── */

function ForYouListRow({
  item,
  onPress,
  onHover,
}: {
  item: FeedItem;
  onPress: () => void;
  onHover?: () => void;
}) {
  const fallbackUrl = getArticleImage(null, item.title);
  const [showFallback, setShowFallback] = useState(false);
  const imageUrl = getArticleImage(item.thumbnail, item.title);
  const hasHovered = useRef(false);
  const hasImage = item.thumbnail && !item.thumbnail.includes('placeholder');
  const subtitle = stripMarkdown(item.summary?.short_article?.subtitle || item.description || '');

  return (
    <button
      onClick={onPress}
      onMouseEnter={() => {
        if (!hasHovered.current && onHover) { hasHovered.current = true; onHover(); }
      }}
      className="w-full text-left flex items-center gap-4 p-3.5 rounded-2xl hover:bg-surface-secondary transition-colors group"
    >
      <div className="relative w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-xl overflow-hidden bg-surface-secondary shrink-0">
        {hasImage && !showFallback ? (
          <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setShowFallback(true)} />
        ) : item.source_name ? (
          <div
            className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: hashColor(item.source_name) }}
          >
            {getSourceInitials(item.source_name)}
          </div>
        ) : (
          <img src={fallbackUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[15px] leading-snug line-clamp-2 group-hover:text-secondary transition-colors">
          {item.title}
        </h3>
        {subtitle && (
          <p className="text-sm text-secondary/50 line-clamp-1 leading-relaxed mt-1">
            {subtitle}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {item.source_name && (
            <span className="text-xs text-secondary/40">{item.source_name}</span>
          )}
          {item.source_name && item.published_date && <span className="text-secondary/20">·</span>}
          {item.published_date && (
            <span className="text-xs text-secondary/40">{getTimeAgo(item.published_date)}</span>
          )}
        </div>
      </div>
      <ChevronRight size={16} className="text-secondary/30 shrink-0" />
    </button>
  );
}

/* ─── Deep Dive Row ─── */

function DeepDiveRow({
  item,
  onPress,
  onHover,
}: {
  item: FeedItem;
  onPress: () => void;
  onHover?: () => void;
}) {
  const fallbackUrl = getArticleImage(null, item.title);
  const [showFallback, setShowFallback] = useState(false);
  const imageUrl = getArticleImage(item.thumbnail, item.title);
  const hasHovered = useRef(false);
  const subtitle = stripMarkdown(item.summary?.deep_dive?.subtitle || item.summary?.short_article?.subtitle || item.description || '');
  const chapterCount = item.summary?.deep_dive?.chapters?.length || 0;

  return (
    <button
      onClick={onPress}
      onMouseEnter={() => {
        if (!hasHovered.current && onHover) { hasHovered.current = true; onHover(); }
      }}
      className="w-full text-left p-4 rounded-2xl bg-surface-secondary hover:bg-surface-secondary/70 transition-colors group"
    >
      <div className="flex items-start gap-4">
        <div className="relative w-24 h-20 sm:w-28 sm:h-24 rounded-xl overflow-hidden bg-surface shrink-0">
          {!showFallback ? (
            <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setShowFallback(true)} />
          ) : (
            <img src={fallbackUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <GraduationCap size={12} className="text-secondary/40" />
            <span className="text-[11px] font-medium text-secondary/50 uppercase tracking-wide">Deep Dive</span>
          </div>
          <h3 className="font-semibold text-[15px] leading-snug line-clamp-2 group-hover:text-secondary transition-colors">
            {item.title}
          </h3>
          {subtitle && (
            <p className="text-xs text-secondary/40 line-clamp-1 mt-1">{subtitle}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-secondary/30">
            {chapterCount > 0 && <span>{chapterCount} chapters</span>}
            {item.sources && item.sources.length > 0 && (
              <>
                {chapterCount > 0 && <span>·</span>}
                <span>{item.sources.length} sources</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight size={16} className="text-secondary/30 shrink-0 mt-2" />
      </div>
    </button>
  );
}

/* ─── Featured For You Card ─── */

function ForYouFeaturedCard({
  item,
  onPress,
  onHover,
}: {
  item: FeedItem;
  onPress: () => void;
  onHover?: () => void;
}) {
  const fallbackUrl = getArticleImage(null, item.title);
  const [showFallback, setShowFallback] = useState(false);
  const imageUrl = getArticleImage(item.thumbnail, item.title);
  const subtitle = stripMarkdown(item.summary?.short_article?.subtitle || item.description || '');
  const hasHovered = useRef(false);

  return (
    <button
      onClick={onPress}
      onMouseEnter={() => {
        if (!hasHovered.current && onHover) { hasHovered.current = true; onHover(); }
      }}
      className="w-full text-left group mb-6"
    >
      <div className="relative aspect-[1.3/1] sm:aspect-[1.6/1] rounded-2xl overflow-hidden bg-surface-secondary">
        <img src={fallbackUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {!showFallback && (
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={() => setShowFallback(true)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
          <div className="flex items-center gap-2 mb-2">
            <Compass size={14} className="text-white/60" />
            <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wide">Top Pick</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white leading-snug line-clamp-2 mb-1">
            {item.title}
          </h2>
          {subtitle && (
            <p className="text-sm text-white/50 line-clamp-2 leading-relaxed max-w-xl">{subtitle}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {item.source_name && (
              <span className="text-xs text-white/40">{item.source_name}</span>
            )}
            {item.published_date && (
              <>
                <span className="text-white/20">·</span>
                <span className="text-xs text-white/40">{getTimeAgo(item.published_date)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ─── Interest group types ─── */

type InterestGroup = { id: string; label: string; items: FeedItem[] };
type ForYouSection =
  | { type: 'interest'; group: InterestGroup }
  | { type: 'deep_dive'; item: FeedItem };

function groupByInterest(items: FeedItem[]): InterestGroup[] {
  const groups = new Map<string, FeedItem[]>();
  for (const item of items) {
    const id = item.interest_id || '_general';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(item);
  }
  return Array.from(groups.entries()).map(([id, list]) => ({
    id,
    label: INTEREST_LABELS[id] || 'Picks for You',
    items: list,
  }));
}

function buildForYouSections(
  feed: V3UserFeed,
  isSubscribed: boolean,
  featuredId?: string,
): ForYouSection[] {
  const forYouItems = isSubscribed
    ? feed.for_you
    : feed.for_you.slice(0, (FREE_LIMITS.for_you ?? 2));
  const deepDiveItems = isSubscribed
    ? feed.deep_dives
    : feed.deep_dives.slice(0, (FREE_LIMITS.deep_dives ?? 1));

  const filtered = featuredId
    ? forYouItems.filter(i => i.id !== featuredId)
    : forYouItems;

  const interests = groupByInterest(filtered);
  const result: ForYouSection[] = [];

  let ddIdx = 0;
  for (let i = 0; i < interests.length; i++) {
    result.push({ type: 'interest', group: interests[i] });
    if (ddIdx < deepDiveItems.length) {
      result.push({ type: 'deep_dive', item: deepDiveItems[ddIdx] });
      ddIdx++;
    }
  }
  while (ddIdx < deepDiveItems.length) {
    result.push({ type: 'deep_dive', item: deepDiveItems[ddIdx] });
    ddIdx++;
  }

  return result;
}

/* ─── Main Feed Page ─── */

function FeedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading } = useAuth();
  const tabParam = parseFeedTab(searchParams.get('tab'));
  const topicParam = searchParams.get('topic');

  const [activeTab, setActiveTab] = useState<FeedTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const topic = params.get('topic');
      if (topic) return 'trending';
      const tabFromUrl = parseFeedTab(params.get('tab'));
      if (tabFromUrl) return tabFromUrl;
      const saved = sessionStorage.getItem('trace_feed_tab');
      if (saved === 'for_you' || saved === 'trending') return saved;
    }
    return 'trending';
  });

  const [selectedTopic, setSelectedTopic] = useState<TrendingTopic | null>(() => {
    if (typeof window === 'undefined') return null;
    const topic = new URLSearchParams(window.location.search).get('topic');
    if (!topic) return null;
    const raw = sessionStorage.getItem(FEED_TOPIC_CACHE_KEY);
    if (!raw) return null;
    try {
      const cached = JSON.parse(raw) as TrendingTopic;
      return (cached.topic_key === topic || cached.id === topic) ? cached : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    sessionStorage.setItem('trace_feed_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const nextTab: FeedTab = topicParam ? 'trending' : (tabParam || 'trending');
    if (activeTab !== nextTab) {
      setActiveTab(nextTab);
    }
    if (!topicParam && selectedTopic) {
      setSelectedTopic(null);
      sessionStorage.removeItem(FEED_TOPIC_CACHE_KEY);
    }
  }, [activeTab, tabParam, topicParam, selectedTopic]);

  const { data: v3Feed, isLoading: feedLoading, mutate: mutateFeed } = useSWR<V3UserFeed | null>(
    user?.uid ? `feed-${user.uid}` : null,
    () => feedFetcher(user!.uid),
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60000 }
  );

  const { data: fallbackTrending = [] } = useSWR<FeedItem[]>(
    'public-trending',
    trendingFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  const prefetchArticle = useCallback((item: FeedItem) => {
    sessionStorage.setItem(`trace_article_${item.id}`, JSON.stringify(item));
  }, []);

  const openArticle = useCallback((item: FeedItem, options?: { returnTo?: string }) => {
    sessionStorage.setItem("trace_article", JSON.stringify(item));
    const params = new URLSearchParams();
    if (activeTab === 'for_you') params.set('tab', 'for_you');
    if (activeTab === 'trending' && topicParam) params.set('topic', topicParam);
    const defaultReturnTo = params.toString() ? `/feed?${params.toString()}` : '/feed';
    const returnTo = options?.returnTo || defaultReturnTo;
    sessionStorage.setItem(ARTICLE_RETURN_TO_KEY, returnTo);

    const articleParams = new URLSearchParams();
    articleParams.set('returnTo', returnTo);
    router.push(`/feed/article?${articleParams.toString()}`);
  }, [activeTab, topicParam, router]);

  const navigateFeedState = useCallback((
    nextTab: FeedTab,
    options?: { topic?: string | null; replace?: boolean; scroll?: boolean }
  ) => {
    const params = new URLSearchParams();
    if (nextTab === 'for_you') params.set('tab', 'for_you');
    if (nextTab === 'trending' && options?.topic) params.set('topic', options.topic);
    const query = params.toString();
    const href = query ? `/feed?${query}` : '/feed';
    const shouldScroll = options?.scroll ?? false;
    if (options?.replace) router.replace(href, { scroll: shouldScroll });
    else router.push(href, { scroll: shouldScroll });
  }, [router]);

  const openTopic = useCallback((topic: TrendingTopic) => {
    const slug = topic.topic_key || topic.id;
    sessionStorage.setItem(FEED_TOPIC_CACHE_KEY, JSON.stringify(topic));
    navigateFeedState('trending', { topic: slug, scroll: true });
  }, [navigateFeedState]);

  const closeTopic = useCallback(() => {
    setSelectedTopic(null);
    sessionStorage.removeItem(FEED_TOPIC_CACHE_KEY);
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    navigateFeedState('trending', { replace: true });
  }, [navigateFeedState, router]);

  const handleTabChange = useCallback((tab: FeedTab) => {
    if (tab === 'for_you') {
      if (activeTab === 'for_you' && !topicParam) return;
      setSelectedTopic(null);
      sessionStorage.removeItem(FEED_TOPIC_CACHE_KEY);
      setActiveTab('for_you');
      navigateFeedState('for_you');
      return;
    }

    if (activeTab === 'trending' && !topicParam) return;
    setActiveTab('trending');
    navigateFeedState('trending');
  }, [activeTab, navigateFeedState, topicParam]);

  const isSubscribed = profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trial'
    || profile?.appSubscriptionStatus === 'active' || profile?.appSubscriptionStatus === 'trial';

  const isFeedBuilding = (() => {
    if (profile?.feedBuildStatus !== 'building') return false;
    const raw = profile?.feedBuildRequestedAt;
    if (!raw) return false;
    const ts = typeof raw === 'string' ? new Date(raw).getTime()
      : raw?.toDate ? raw.toDate().getTime()
      : raw?.seconds ? raw.seconds * 1000 : 0;
    return ts > 0 && Date.now() - ts < 5 * 60 * 1000;
  })();

  useEffect(() => {
    if (!isAlphaMode()) { router.push(user ? '/waitlist' : '/'); return; }
    if (!loading && !user) { router.push('/'); return; }
    if (user && profile?.onboarded) recordLastActive(user.uid);
    else if (user && !loading && !profile?.onboarded) router.push('/onboarding');
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!isFeedBuilding || !user) return;
    const interval = setInterval(() => mutateFeed(), 15000);
    return () => clearInterval(interval);
  }, [isFeedBuilding, user, mutateFeed]);

  // Trending topics (sorted like mobile)
  const trendingTopics = useMemo(() => {
    const topics = v3Feed?.trending_topics || [];
    return [...topics].sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return (b.popularity_score || 0) - (a.popularity_score || 0);
    });
  }, [v3Feed?.trending_topics]);

  useEffect(() => {
    if (!topicParam) return;
    const decoded = decodeURIComponent(topicParam);
    const match = trendingTopics.find((t) => t.topic_key === decoded || t.id === decoded);
    if (match) {
      setSelectedTopic(match);
      sessionStorage.setItem(FEED_TOPIC_CACHE_KEY, JSON.stringify(match));
      if (activeTab !== 'trending') setActiveTab('trending');
      return;
    }
    const raw = sessionStorage.getItem(FEED_TOPIC_CACHE_KEY);
    if (!raw) return;
    try {
      const cached = JSON.parse(raw) as TrendingTopic;
      if (cached.topic_key === decoded || cached.id === decoded) {
        setSelectedTopic(cached);
        if (activeTab !== 'trending') setActiveTab('trending');
      }
    } catch {
      // no-op: malformed cache
    }
  }, [topicParam, trendingTopics, activeTab]);

  const featuredTopic = trendingTopics[0] || null;
  const restTopics = trendingTopics.slice(1).filter(t => {
    if (!featuredTopic) return true;
    if (t.id === featuredTopic.id) return false;
    if (t.topic_key === featuredTopic.topic_key) return false;
    // fuzzy title dedup: if >50% of significant words overlap, treat as same topic
    const stopWords = new Set(['the','a','an','and','or','in','on','at','to','of','for','is','are','was','its','with','as']);
    const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g,'').split(' ').filter(w => w.length > 2 && !stopWords.has(w));
    const wa = new Set(words(featuredTopic.title));
    const wb = words(t.title);
    if (wa.size === 0 || wb.length === 0) return true;
    const overlap = wb.filter(w => wa.has(w)).length;
    return overlap / Math.max(wa.size, wb.length) < 0.5;
  });

  // For You sections
  const forYouFeatured = useMemo(() => {
    if (!v3Feed?.for_you?.length) return null;
    return v3Feed.for_you[0];
  }, [v3Feed?.for_you]);

  const forYouSections = useMemo(() => {
    if (!v3Feed) return [];
    return buildForYouSections(v3Feed, !!isSubscribed, forYouFeatured?.id);
  }, [v3Feed, isSubscribed, forYouFeatured?.id]);

  // Fallback: flat trending items if no topics available
  const flatTrendingItems = useMemo(() => {
    if (trendingTopics.length > 0) return [];
    return v3Feed?.trending || [];
  }, [v3Feed?.trending, trendingTopics.length]);

  const isTabLimited = !isSubscribed && activeTab === 'for_you' && v3Feed != null;
  const isLoading = loading || (feedLoading && !v3Feed);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary/40" />
      </div>
    );
  }

  const hasContent =
    (activeTab === 'trending' && (trendingTopics.length > 0 || flatTrendingItems.length > 0)) ||
    (activeTab === 'for_you' && (forYouFeatured || forYouSections.length > 0));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto px-4 max-w-3xl">
        {/* Tabs */}
        <div className="pt-6 pb-5">
          <div className="flex items-center gap-1 bg-surface-secondary rounded-full p-1 self-start w-fit">
            {TAB_CONFIG.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                    active
                      ? 'bg-surface text-foreground shadow-sm'
                      : 'text-secondary/50 hover:text-secondary'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Building banner */}
        {isFeedBuilding && isSubscribed && hasContent && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-6 bg-surface-secondary">
            <Loader2 size={16} className="animate-spin text-secondary/50" />
            <p className="text-xs text-secondary/60 font-medium">
              Your full feed is building — refresh in a minute
            </p>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-secondary/40" />
          </div>
        ) : selectedTopic ? (
          /* Topic Detail View */
          <TopicDetailView
            topic={selectedTopic}
            onBack={closeTopic}
            onOpenArticle={openArticle}
          />
        ) : hasContent ? (
          <>
            {/* ─── TRENDING ─── */}
            {activeTab === 'trending' && trendingTopics.length > 0 && (
              <>
                {featuredTopic && (
                  <TopicFeaturedCard
                    topic={featuredTopic}
                    onPress={() => openTopic(featuredTopic)}
                  />
                )}
                {restTopics.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-secondary/40 uppercase tracking-wide px-1 mb-2">
                      More stories
                    </h3>
                    <div className="flex flex-col gap-1">
                      {restTopics.map((topic) => (
                        <TopicListRow
                          key={topic.id}
                          topic={topic}
                          onPress={() => openTopic(topic)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Flat trending fallback (if no topics) */}
            {activeTab === 'trending' && trendingTopics.length === 0 && flatTrendingItems.length > 0 && (
              <div className="flex flex-col gap-1">
                {flatTrendingItems.map((item, i) => (
                  <ForYouListRow
                    key={`flat-${item.id || i}`}
                    item={item}
                    onPress={() => openArticle(item)}
                    onHover={() => prefetchArticle(item)}
                  />
                ))}
              </div>
            )}

            {/* ─── FOR YOU ─── */}
            {activeTab === 'for_you' && (
              <>
                {forYouFeatured && (
                  <ForYouFeaturedCard
                    item={forYouFeatured}
                    onPress={() => openArticle(forYouFeatured)}
                    onHover={() => prefetchArticle(forYouFeatured)}
                  />
                )}
                {forYouSections.map((section, si) => {
                  if (section.type === 'interest') {
                    return (
                      <div key={`interest-${section.group.id}`} className="mb-6">
                        <h3 className="text-xs font-semibold text-secondary/40 uppercase tracking-wide px-1 mb-2">
                          {section.group.label}
                        </h3>
                        <div className="flex flex-col gap-1">
                          {section.group.items.map((item, ii) => (
                            <ForYouListRow
                              key={`fy-${item.id || ii}`}
                              item={item}
                              onPress={() => openArticle(item)}
                              onHover={() => prefetchArticle(item)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={`dd-${si}`} className="mb-6">
                      <DeepDiveRow
                        item={section.item}
                        onPress={() => openArticle(section.item)}
                        onHover={() => prefetchArticle(section.item)}
                      />
                    </div>
                  );
                })}
              </>
            )}

            {/* Paywall upsell */}
            {isTabLimited && (
              <div className="mt-10 p-6 rounded-2xl bg-surface-secondary text-center">
                <Lock size={18} className="mx-auto mb-2 text-secondary/40" />
                <p className="font-semibold text-sm mb-1">
                  Unlock all personalized stories & deep dives
                </p>
                <p className="text-xs text-secondary/50 mb-4 max-w-sm mx-auto">
                  Start a free trial to get unlimited access to content tailored to your interests.
                </p>
                <Link
                  href="/profile?tab=subscription"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
                >
                  Start Free Trial
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </>
        ) : fallbackTrending.length > 0 && activeTab === 'trending' ? (
          <>
            {isFeedBuilding && (
              <div className="flex items-center gap-3 p-4 rounded-xl mb-6 bg-surface-secondary">
                <Loader2 size={18} className="animate-spin text-secondary/50" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Building your personalized feed...</p>
                  <p className="text-xs text-secondary/50">Meanwhile, here&apos;s what&apos;s trending today</p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {fallbackTrending.map((item, i) => (
                <ForYouListRow
                  key={`fb-${item.id || i}`}
                  item={item}
                  onPress={() => openArticle(item)}
                  onHover={() => prefetchArticle(item)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-24">
            <p className="text-sm text-secondary/50">No items yet. Check back soon.</p>
          </div>
        )}

        <div className="h-16" />
      </main>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary/40" />
      </div>
    }>
      <FeedPageContent />
    </Suspense>
  );
}
