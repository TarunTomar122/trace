"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Share2, X, Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';
import {
  getV3UserFeed, V3UserFeed, FeedItem, TrendingTopic,
  recordLastActive,
} from '@/lib/firestore';
import { getArticleImage } from '@/lib/fallback-images';

type FeedTab = 'trending' | 'for_you';

const TAB_CONFIG: { key: FeedTab; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'for_you', label: 'For You' },
];

const FREE_LIMITS = { trending: 3, for_you: 1 };

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
  return data.items.map((item: Record<string, unknown>): FeedItem => ({
    id: String(item.id || ''),
    title: String(item.title || ''),
    url: String(item.url || ''),
    thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : null,
    source_name: typeof item.source === 'string' ? item.source : undefined,
    summary: { short_article: { subtitle: typeof item.summary === 'string' ? item.summary : '' } },
  }));
};

function stripMarkdown(text: string): string {
  return (text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*#+\s*/gm, "")
    .trim();
}

function getTimeLabel(dateStr?: string): string {
  if (!dateStr) return '';
  const ts = new Date(dateStr).getTime();
  if (Number.isNaN(ts)) return '';
  const now = new Date();
  const date = new Date(ts);
  const diffMin = Math.floor((now.getTime() - ts) / 60000);

  if (diffMin < 60) return `${diffMin}m ago`;

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTopicDisplay(topic: TrendingTopic) {
  const isSingleton = (topic.source_count ?? 0) <= 1 || (topic.article_count ?? 0) <= 1;
  const article = isSingleton ? (topic.articles?.[0] ?? null) : null;
  return {
    isSingleton,
    article,
    title: article?.title || topic.title,
    summary: article?.summary?.short_article?.body || topic.summary || '',
    subtitle: article?.summary?.short_article?.subtitle || topic.summary || '',
    readingTime: article?.summary?.reading_time_minutes,
  };
}

function getArticleSummary(item: FeedItem): string {
  return stripMarkdown(
    item.summary?.short_article?.body ||
    item.summary?.short_article?.subtitle ||
    item.description ||
    ''
  );
}

function getPreview(text: string, maxLen = 100): string {
  if (!text) return '';
  const clean = stripMarkdown(text);
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen).trim() + '...';
}

/* ─── Folder Tab ─── */
function FolderTab({
  label,
  active,
  onClick,
  isFirst,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  isFirst?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative px-6 py-2.5 text-[0.9375rem] font-medium transition-colors
        ${active ? 'text-foreground bg-surface z-10' : 'text-tab-inactive bg-surface-tertiary hover:text-foreground'}
        ${isFirst ? 'rounded-tl-lg' : ''}
      `}
      style={{
        clipPath: isFirst
          ? 'polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)'
          : 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)',
        marginLeft: isFirst ? 0 : '-6px',
      }}
    >
      {label}
    </button>
  );
}

/* ─── Sidebar Article Item ─── */
function SidebarItem({
  title,
  timestamp,
  source,
  selected,
  onClick,
}: {
  title: string;
  preview?: string;
  timestamp?: string;
  source?: string;
  thumbnail?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        article-list-item w-full text-left transition-all
        ${selected ? 'selected' : ''}
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        {timestamp && (
          <span className="text-[10px] text-secondary/50 uppercase tracking-wide">
            {getTimeLabel(timestamp)}
          </span>
        )}
        {source && timestamp && <span className="text-secondary/30 text-[10px]">·</span>}
        {source && (
          <span className="text-[10px] text-secondary/50 truncate">{source}</span>
        )}
      </div>
      <h3 className="text-[0.875rem] font-semibold text-foreground leading-snug line-clamp-2">
        {title}
      </h3>
    </button>
  );
}

/* ─── Timeline Event Type ─── */
type TimelineEvent = {
  id?: string;
  title: string;
  summary?: string;
  timestamp: string;
  source_name?: string;
};

const FEED_TYPE_PREFIX: Record<string, string> = {
  for_you: 'fy',
  deep_dives: 'dd',
  trending: 'tr',
};

function buildShareUrl(itemId: string, feedType?: string): string {
  const prefix = feedType ? FEED_TYPE_PREFIX[feedType] : 'tr';
  return `https://www.yourtrace.online/articles/${prefix}_${itemId}`;
}

/* ─── Main Content Panel ─── */
function ContentPanel({
  title,
  body,
  source,
  url,
  timestamp,
  keyPoints,
  thumbnail,
  timeline,
  sourceCount,
  itemId,
  feedType,
  onCopyLink,
}: {
  title: string;
  body: string;
  source?: string;
  url?: string;
  timestamp?: string;
  keyPoints?: string[];
  thumbnail?: string | null;
  timeline?: TimelineEvent[];
  sourceCount?: number;
  itemId?: string;
  feedType?: string;
  onCopyLink?: () => void;
}) {
  const imageUrl = thumbnail ? getArticleImage(thumbnail, title) : null;
  const hasTimeline = timeline && timeline.length > 0;
  const sortedTimeline = hasTimeline
    ? [...timeline].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  return (
    <div className="split-main w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 w-full">
        <div className="flex items-center gap-3 text-[12px] text-secondary/50">
          {timestamp && <span>{getTimeLabel(timestamp)}</span>}
          {source && <span>· {source}</span>}
          {sourceCount && sourceCount > 1 && <span>· {sourceCount} sources</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const shareUrl = itemId ? buildShareUrl(itemId, feedType) : url;
              if (shareUrl) {
                navigator.clipboard.writeText(shareUrl);
                onCopyLink?.();
              }
            }}
            className="p-1.5 rounded-lg text-secondary/40 hover:text-foreground hover:bg-surface-secondary transition-colors"
            title="Copy link"
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-[1.75rem] font-semibold text-foreground leading-tight mb-6">
        {title}
      </h1>

      {/* Image */}
      {imageUrl && (
        <div className="mb-6">
          <img
            src={imageUrl}
            alt=""
            className="max-h-[300px] object-contain"
          />
        </div>
      )}

      {/* Body */}
      <div className="text-secondary leading-relaxed mb-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>

      {/* Key Points */}
      {keyPoints && keyPoints.length > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-surface-secondary">
          <h3 className="text-xs font-semibold text-secondary/60 mb-3 uppercase tracking-wide">
            Key Points
          </h3>
          <div className="space-y-2">
            {keyPoints.map((point, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-secondary/30 font-mono text-xs mt-0.5">{i + 1}.</span>
                <p className="text-sm text-secondary leading-relaxed">{stripMarkdown(point)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {hasTimeline && (
        <div className="mb-6 overflow-hidden">
          <h3 className="text-xs font-semibold text-secondary/60 mb-4 uppercase tracking-wide">
            Timeline
          </h3>
          <div className="space-y-3">
            {sortedTimeline.slice(0, 8).map((event, i) => (
              <div key={event.id || i} className="pb-5 last:pb-0 pr-2">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] text-secondary/50">{getTimeLabel(event.timestamp)}</span>
                  {event.source_name && (
                    <>
                      <span className="text-secondary/20 text-[10px]">·</span>
                      <span className="text-[10px] text-secondary/50 truncate max-w-[120px]">{event.source_name}</span>
                    </>
                  )}
                </div>
                <h4 className="text-sm font-medium text-foreground leading-snug break-words">
                  {event.title}
                </h4>
                {event.summary && (
                  <p className="text-xs text-secondary/60 line-clamp-2 mt-1 break-words">{stripMarkdown(event.summary)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source Link */}
      {url && (
        <div className="pt-5 border-t border-sidebar-border">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-secondary/60 hover:text-foreground transition-colors"
          >
            Read original source →
          </a>
        </div>
      )}
    </div>
  );
}

/* ─── Empty State ─── */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="split-main flex items-center justify-center">
      <p className="text-secondary/50 text-sm">{message}</p>
    </div>
  );
}

/* ─── Upgrade CTA Card ─── */
function UpgradeCard({ lockedCount, type }: { lockedCount: number; type: 'trending' | 'for_you' }) {
  const message = type === 'trending'
    ? `${lockedCount}+ more trending stories`
    : `${lockedCount}+ personalized articles`;

  return (
    <div className="p-4 mx-4 my-3 rounded-xl bg-gradient-to-br from-foreground/5 to-foreground/10 border border-foreground/10">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center">
          <Lock size={14} className="text-foreground/60" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{message}</p>
          <p className="text-[11px] text-secondary/60">Unlock with Pro</p>
        </div>
      </div>
      <Link
        href="/profile?tab=subscription"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
      >
        <Sparkles size={14} />
        Start Free Trial
      </Link>
    </div>
  );
}

/* ─── Upgrade Banner for Content Area ─── */
function UpgradeBanner() {
  return (
    <div className="split-main flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <div className="w-14 h-14 rounded-2xl bg-foreground/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={24} className="text-foreground/60" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Unlock Your Full Feed
        </h3>
        <p className="text-sm text-secondary/60 mb-5">
          Get unlimited access to all trending topics, personalized articles, and AI summaries.
        </p>
        <Link
          href="/profile?tab=subscription"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          <Sparkles size={16} />
          Start 7-Day Free Trial
        </Link>
        <p className="text-[11px] text-secondary/40 mt-3">
          Cancel anytime · $2.99/month after trial
        </p>
      </div>
    </div>
  );
}

/* ─── Main Feed Page ─── */
function FeedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, profileResolved } = useAuth();
  const tabParam = parseFeedTab(searchParams.get('tab'));
  const [feedBuildNow] = useState(() => Date.now());

  const [activeTab, setActiveTab] = useState<FeedTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabFromUrl = parseFeedTab(params.get('tab'));
      if (tabFromUrl) return tabFromUrl;
      const saved = sessionStorage.getItem('trace_feed_tab');
      if (saved === 'for_you' || saved === 'trending') return saved;
    }
    return 'trending';
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMobileContent, setShowMobileContent] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const handleCopyLink = useCallback(() => {
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 2000);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('trace_feed_tab', activeTab);
  }, [activeTab]);

  // Sync tab from URL param (only on initial load or external navigation)
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

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

  const isSubscribed = profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trial'
    || profile?.appSubscriptionStatus === 'active' || profile?.appSubscriptionStatus === 'trial';

  const isFeedBuilding = (() => {
    if (profile?.feedBuildStatus !== 'building') return false;
    const raw = profile?.feedBuildRequestedAt;
    if (!raw) return false;
    const ts = typeof raw === 'string' ? new Date(raw).getTime()
      : raw?.toDate ? raw.toDate().getTime()
      : raw?.seconds ? raw.seconds * 1000 : 0;
    return ts > 0 && feedBuildNow - ts < 5 * 60 * 1000;
  })();

  useEffect(() => {
    if (!isAlphaMode()) { router.push(user ? '/waitlist' : '/'); return; }
    if (!loading && !user) { router.push('/'); return; }
    if (user && !profileResolved) return;
    if (user && profile?.onboarded) recordLastActive(user.uid);
    else if (user && !loading && !profile?.onboarded) router.push('/onboarding');
  }, [user, profile, loading, router, profileResolved]);

  useEffect(() => {
    if (!isFeedBuilding || !user) return;
    const interval = setInterval(() => mutateFeed(), 15000);
    return () => clearInterval(interval);
  }, [isFeedBuilding, user, mutateFeed]);

  // Trending topics
  const trendingTopics = useMemo(() => {
    const topics = v3Feed?.trending_topics || [];
    return [...topics].sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return (b.popularity_score || 0) - (a.popularity_score || 0);
    });
  }, [v3Feed?.trending_topics]);

  const visibleTrendingTopics = useMemo(() => (
    isSubscribed ? trendingTopics : trendingTopics.slice(0, FREE_LIMITS.trending)
  ), [isSubscribed, trendingTopics]);

  // For You items
  const forYouItems = useMemo(() => {
    if (!v3Feed?.for_you?.length) return [];
    return isSubscribed ? v3Feed.for_you : v3Feed.for_you.slice(0, FREE_LIMITS.for_you);
  }, [v3Feed?.for_you, isSubscribed]);

  // Locked counts for upgrade prompts
  const lockedTrendingCount = useMemo(() => {
    const total = trendingTopics.length || (v3Feed?.trending?.length || 0);
    return Math.max(0, total - FREE_LIMITS.trending);
  }, [trendingTopics.length, v3Feed?.trending?.length]);

  const lockedForYouCount = useMemo(() => {
    const total = v3Feed?.for_you?.length || 0;
    return Math.max(0, total - FREE_LIMITS.for_you);
  }, [v3Feed?.for_you?.length]);

  // Flat trending fallback
  const flatTrendingItems = useMemo(() => {
    if (trendingTopics.length > 0) return [];
    const items = v3Feed?.trending || [];
    return isSubscribed ? items : items.slice(0, FREE_LIMITS.trending);
  }, [v3Feed?.trending, trendingTopics.length, isSubscribed]);

  // Get current list based on active tab
  const currentList = useMemo(() => {
    if (activeTab === 'trending') {
      if (visibleTrendingTopics.length > 0) {
        return visibleTrendingTopics.map(topic => {
          const display = getTopicDisplay(topic);
          return {
            id: topic.id,
            type: 'topic' as const,
            title: display.title,
            preview: getPreview(display.subtitle || display.summary),
            timestamp: topic.articles?.[0]?.published_date,
            source: display.isSingleton ? display.article?.source_name : `${topic.source_count} sources`,
            thumbnail: display.isSingleton ? display.article?.thumbnail : topic.thumbnail,
            data: topic,
          };
        });
      }
      return (flatTrendingItems.length > 0 ? flatTrendingItems : fallbackTrending).map(item => ({
        id: item.id,
        type: 'article' as const,
        title: item.title,
        preview: getPreview(getArticleSummary(item)),
        timestamp: item.published_date,
        source: item.source_name,
        thumbnail: item.thumbnail,
        data: item,
      }));
    }

    if (activeTab === 'for_you') {
      return forYouItems.map(item => ({
        id: item.id,
        type: 'article' as const,
        title: item.title,
        preview: getPreview(getArticleSummary(item)),
        timestamp: item.published_date,
        source: item.source_name,
        thumbnail: item.thumbnail,
        data: item,
      }));
    }

    return [];
  }, [activeTab, visibleTrendingTopics, flatTrendingItems, fallbackTrending, forYouItems]);

  // Auto-select first item when list changes
  useEffect(() => {
    if (currentList.length > 0 && (!selectedId || !currentList.find(item => item.id === selectedId))) {
      setSelectedId(currentList[0].id);
    }
  }, [currentList, selectedId]);

  // Get selected item details
  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return currentList.find(item => item.id === selectedId) || null;
  }, [currentList, selectedId]);

  const selectedContent = useMemo(() => {
    if (!selectedItem) return null;

    if (selectedItem.type === 'topic') {
      const topic = selectedItem.data as TrendingTopic;
      const display = getTopicDisplay(topic);
      const articleId = display.isSingleton ? display.article?.id : topic.articles?.[0]?.id;
      const articleUrl = display.isSingleton ? display.article?.url : topic.articles?.[0]?.url;
      return {
        title: display.title,
        body: display.summary || display.subtitle,
        source: display.isSingleton ? display.article?.source_name : undefined,
        url: articleUrl,
        timestamp: topic.articles?.[0]?.published_date,
        keyPoints: display.isSingleton
          ? display.article?.summary?.short_article?.key_takeaways
          : topic.key_points,
        thumbnail: display.isSingleton ? display.article?.thumbnail : topic.thumbnail,
        timeline: !display.isSingleton ? topic.timeline : undefined,
        sourceCount: topic.source_count,
        itemId: articleId,
        feedType: 'trending',
      };
    }

    const article = selectedItem.data as FeedItem;
    return {
      title: article.title,
      body: getArticleSummary(article),
      source: article.source_name,
      url: article.url,
      timestamp: article.published_date,
      keyPoints: article.summary?.short_article?.key_takeaways,
      thumbnail: article.thumbnail,
      timeline: undefined,
      sourceCount: undefined,
      articleCount: undefined,
      itemId: article.id,
      feedType: article.feed_type || article.metadata?.feed_type || activeTab,
    };
  }, [selectedItem, activeTab]);

  const handleTabChange = useCallback((tab: FeedTab) => {
    setActiveTab(tab);
    setSelectedId(null);
    setShowMobileContent(false);
    const params = new URLSearchParams();
    if (tab !== 'trending') params.set('tab', tab);
    const query = params.toString();
    router.push(query ? `/feed?${query}` : '/feed', { scroll: false });
  }, [router]);

  const handleSelectItem = (id: string) => {
    setSelectedId(id);
    setShowMobileContent(true);
  };

  const isLoading = loading || (feedLoading && !v3Feed);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border/30 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <img src="/trace.webp" alt="Trace" className="h-6 w-auto" />
            <span className="text-sm font-semibold tracking-[0.12em] text-foreground">TRACE</span>
          </Link>
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <Link href="/profile" className="flex items-center gap-2">
                <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
              </Link>
            ) : (
              <Link
                href="/profile"
                className="w-8 h-8 rounded-full bg-surface-secondary flex items-center justify-center text-secondary hover:text-foreground transition-colors"
              >
                <span className="text-sm font-medium">{user?.email?.[0]?.toUpperCase() || 'U'}</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Folder Tabs */}
        <div className="flex items-end">
          {TAB_CONFIG.map((tab, i) => (
            <FolderTab
              key={tab.key}
              label={tab.label}
              active={activeTab === tab.key}
              onClick={() => handleTabChange(tab.key)}
              isFirst={i === 0}
            />
          ))}
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:block">
          <div className="split-layout">
          {/* Sidebar */}
          <div className="split-sidebar">
            <div className="px-5 py-4 border-b border-sidebar-border">
              <h2 className="text-[15px] font-semibold text-foreground">
                {activeTab === 'trending' && 'All Stories'}
                {activeTab === 'for_you' && 'For You'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-secondary/40" />
                </div>
              ) : currentList.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm text-secondary/50">No stories available</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-sidebar-border/50">
                    {currentList.map((item) => (
                      <SidebarItem
                        key={item.id}
                        title={item.title}
                        preview={item.preview}
                        timestamp={item.timestamp}
                        source={item.source}
                        thumbnail={item.thumbnail}
                        selected={selectedId === item.id}
                        onClick={() => setSelectedId(item.id)}
                      />
                    ))}
                  </div>
                  {!isSubscribed && (
                    (activeTab === 'trending' && lockedTrendingCount > 0) ||
                    (activeTab === 'for_you' && lockedForYouCount > 0)
                  ) && (
                    <UpgradeCard
                      lockedCount={activeTab === 'trending' ? lockedTrendingCount : lockedForYouCount}
                      type={activeTab === 'trending' ? 'trending' : 'for_you'}
                    />
                  )}
                </>
              )}
            </div>

            {/* Upgrade prompt for free users */}
            {!isSubscribed && currentList.length > 0 && (
              <div className="px-4 py-3 border-t border-sidebar-border bg-surface-secondary/50">
                <Link
                  href="/profile?tab=subscription"
                  className="block text-center text-xs text-secondary/60 hover:text-foreground transition-colors"
                >
                  Upgrade to unlock all stories →
                </Link>
              </div>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="split-main flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-secondary/40" />
            </div>
          ) : selectedContent ? (
            <ContentPanel
              title={selectedContent.title}
              body={selectedContent.body}
              source={selectedContent.source}
              url={selectedContent.url}
              timestamp={selectedContent.timestamp}
              keyPoints={selectedContent.keyPoints}
              thumbnail={selectedContent.thumbnail}
              timeline={selectedContent.timeline}
              sourceCount={selectedContent.sourceCount}
              itemId={selectedContent.itemId}
              feedType={selectedContent.feedType}
              onCopyLink={handleCopyLink}
            />
          ) : (
            <EmptyState message="Select a story to read" />
          )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden bg-surface rounded-tr-lg rounded-b-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
            <h2 className="text-[15px] font-semibold text-foreground">
              {activeTab === 'trending' && 'All Stories'}
              {activeTab === 'for_you' && 'For You'}
            </h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-secondary/40" />
            </div>
          ) : currentList.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-secondary/50">No stories available</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-sidebar-border/50">
                {currentList.map((item) => (
                  <SidebarItem
                    key={item.id}
                    title={item.title}
                    preview={item.preview}
                    timestamp={item.timestamp}
                    source={item.source}
                    thumbnail={item.thumbnail}
                    selected={false}
                    onClick={() => handleSelectItem(item.id)}
                  />
                ))}
              </div>
              {!isSubscribed && (
                (activeTab === 'trending' && lockedTrendingCount > 0) ||
                (activeTab === 'for_you' && lockedForYouCount > 0)
              ) && (
                <UpgradeCard
                  lockedCount={activeTab === 'trending' ? lockedTrendingCount : lockedForYouCount}
                  type={activeTab === 'trending' ? 'trending' : 'for_you'}
                />
              )}
            </>
          )}

          {/* Upgrade prompt for free users */}
          {!isSubscribed && currentList.length > 0 && (
            <div className="px-4 py-3 border-t border-sidebar-border bg-surface-secondary/50">
              <Link
                href="/profile?tab=subscription"
                className="block text-center text-xs text-secondary/60 hover:text-foreground transition-colors"
              >
                Upgrade to unlock all stories →
              </Link>
            </div>
          )}

          {/* Mobile Bottom Sheet */}
          {showMobileContent && selectedContent && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40 bg-black/30"
                onClick={() => setShowMobileContent(false)}
              />
              {/* Sheet */}
              <div className="fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 rounded-full bg-secondary/30" />
                </div>
                {/* Header */}
                <div className="flex items-center justify-between px-4 pb-3 border-b border-sidebar-border">
                  <button
                    onClick={() => {
                      const shareUrl = selectedContent.itemId
                        ? buildShareUrl(selectedContent.itemId, selectedContent.feedType)
                        : selectedContent.url;
                      if (shareUrl) {
                        navigator.clipboard.writeText(shareUrl);
                        handleCopyLink();
                      }
                    }}
                    className="p-1.5 -ml-1.5 rounded-lg text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors"
                  >
                    <Share2 size={18} />
                  </button>
                  <button
                    onClick={() => setShowMobileContent(false)}
                    className="p-1.5 -mr-1.5 rounded-lg text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <h2 className="text-xl font-semibold text-foreground leading-tight mb-4">
                    {selectedContent.title}
                  </h2>

                  {/* Body */}
                  {selectedContent.body && (
                    <div className="prose prose-sm max-w-none text-secondary leading-relaxed mb-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedContent.body}</ReactMarkdown>
                    </div>
                  )}

                  {/* Key Points */}
                  {selectedContent.keyPoints && selectedContent.keyPoints.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-surface-secondary">
                      <h3 className="text-xs font-semibold text-secondary/60 mb-2 uppercase tracking-wide">
                        Key Points
                      </h3>
                      <div className="space-y-1.5">
                        {selectedContent.keyPoints.slice(0, 4).map((point, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-secondary/30 font-mono text-xs">{i + 1}.</span>
                            <p className="text-sm text-secondary leading-relaxed">{stripMarkdown(point)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  {selectedContent.timeline && selectedContent.timeline.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold text-secondary/60 mb-3 uppercase tracking-wide">
                        Timeline
                      </h3>
                      <div className="space-y-3">
                        {selectedContent.timeline.slice(0, 5).map((event, i) => (
                          <div key={i}>
                            <p className="text-xs text-secondary/50 mb-0.5">{getTimeLabel(event.timestamp)}</p>
                            <p className="text-sm font-medium text-foreground">{event.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Building banner */}
        {isFeedBuilding && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-full bg-surface border border-sidebar-border shadow-lg">
            <Loader2 size={16} className="animate-spin text-secondary/50" />
            <p className="text-sm text-secondary/70">Building your personalized feed...</p>
          </div>
        )}

        {/* Link copied toast */}
        {showCopiedToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-foreground text-background text-sm font-medium shadow-lg">
            Link copied!
          </div>
        )}
      </div>
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
