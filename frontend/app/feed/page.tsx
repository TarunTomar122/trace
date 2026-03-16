"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, X, Lock, Sparkles, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';
import {
  getV3UserFeed, V3UserFeed, FeedItem, TrendingTopic,
  recordLastActive, ONBOARDING_INTERESTS,
} from '@/lib/firestore';
import { getArticleImage } from '@/lib/fallback-images';
import { trackCheckoutClicked, trackPaywallShown, trackSubscriptionStarted } from '@/lib/posthog';

const FREE_LIMITS = { trending: 3 };

const feedFetcher = (uid: string) => getV3UserFeed(uid);

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
  if (isToday) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
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

type TimelineEvent = {
  id?: string;
  title: string;
  summary?: string;
  timestamp: string;
  source_name?: string;
};


const INTEREST_LABEL: Record<string, string> = Object.fromEntries(
  ONBOARDING_INTERESTS.map(i => [i.id, i.label])
);

/* ─── Sidebar Story Item ─── */
function StoryItem({
  title,
  preview,
  timestamp,
  source,
  sourceCount,
  tag,
  selected,
  onClick,
}: {
  title: string;
  preview?: string;
  timestamp?: string;
  source?: string;
  sourceCount: number;
  tag?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const isMultiSource = sourceCount > 1;
  const tagLabel = tag ? INTEREST_LABEL[tag] : undefined;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-4 transition-colors ${
        selected ? 'bg-surface-secondary' : 'hover:bg-surface-secondary/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        {timestamp && (
          <span className="text-[11px] text-secondary/65 uppercase tracking-wide">
            {getTimeLabel(timestamp)}
          </span>
        )}
        {timestamp && (source || isMultiSource) && (
          <span className="text-secondary/40 text-[11px]">·</span>
        )}
        {isMultiSource ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-foreground/10 text-secondary/70">
            {sourceCount} sources
          </span>
        ) : source ? (
          <span className="text-[11px] text-secondary/65 truncate">{source}</span>
        ) : null}
      </div>
      <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
        {title}
      </h3>
      {preview && (
        <p className="mt-1 text-[12px] text-secondary/70 line-clamp-2 leading-relaxed">
          {preview}
        </p>
      )}
      {tagLabel && (
        <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-foreground/8 text-secondary/65">
          {tagLabel}
        </span>
      )}
    </button>
  );
}

/* ─── Content Panel ─── */
type ContentData = {
  title: string;
  body: string;
  source?: string;
  url?: string;
  timestamp?: string;
  keyPoints?: string[];
  thumbnail?: string | null;
  timeline?: TimelineEvent[];
  sourceCount?: number;
  whyItMatters?: string;
  readingTime?: number;
  articleSources?: { name: string; title: string; url: string }[];
};

function ContentPanel({
  content,
}: {
  content: ContentData;
}) {
  const imageUrl = content.thumbnail ? getArticleImage(content.thumbnail, content.title) : null;
  const isMultiSource = (content.sourceCount || 0) > 1;
  const hasTimeline = content.timeline && content.timeline.length > 0;
  const sortedTimeline = hasTimeline
    ? [...content.timeline!].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 sm:px-8 lg:px-10 py-6 sm:py-8">
        {/* Meta bar */}
        <div className="flex items-center gap-2 text-[12px] text-secondary/60 mb-4">
          {content.timestamp && <span>{getTimeLabel(content.timestamp)}</span>}
          {content.source && (
            <>
              <span className="text-secondary/30">·</span>
              <span>{content.source}</span>
            </>
          )}
          {isMultiSource && (
            <>
              <span className="text-secondary/30">·</span>
              <span className="font-medium text-secondary/70">{content.sourceCount} sources</span>
            </>
          )}
          {content.readingTime && (
            <>
              <span className="text-secondary/30">·</span>
              <span>{content.readingTime} min read</span>
            </>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-[1.75rem] font-bold text-foreground leading-tight tracking-[-0.02em] mb-3">
          {content.title}
        </h1>

        {/* Source names strip for multi-source */}
        {isMultiSource && content.articleSources && content.articleSources.length > 0 && (
          <p className="text-[13px] text-secondary/50 mb-6">
            Synthesized from{' '}
            {content.articleSources.map((s, i) => (
              <span key={i}>
                {i > 0 && (i === content.articleSources!.length - 1 ? ' and ' : ', ')}
                <span className="text-secondary/70">{s.name}</span>
              </span>
            ))}
          </p>
        )}

        {!isMultiSource && <div className="mb-6" />}

        {/* Thumbnail */}
        {imageUrl && (
          <div className="mb-8">
            <img
              src={imageUrl}
              alt=""
              className="max-h-[300px] rounded-xl object-contain"
            />
          </div>
        )}

        {/* Body / Overview */}
        {content.body && (
          <div className="text-secondary leading-relaxed mb-8">
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.body}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Key Takeaways */}
        {content.keyPoints && content.keyPoints.length > 0 && (
          <div className="mb-8">
            <h3 className="text-[11px] font-semibold text-secondary/60 mb-4 uppercase tracking-[0.15em]">
              Key Takeaways
            </h3>
            <div className="space-y-3">
              {content.keyPoints.map((point, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-secondary/35 font-mono text-xs mt-0.5">{i + 1}.</span>
                  <p className="text-[15px] text-secondary/80 leading-relaxed">{stripMarkdown(point)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Why it matters */}
        {content.whyItMatters && (
          <div className="mb-8 pl-4 border-l-2 border-foreground/10">
            <h3 className="text-[11px] font-semibold text-secondary/60 mb-2 uppercase tracking-[0.15em]">
              Why it matters
            </h3>
            <p className="text-[15px] text-secondary/80 leading-relaxed">
              {stripMarkdown(content.whyItMatters)}
            </p>
          </div>
        )}

        {/* Timeline */}
        {hasTimeline && (
          <div className="mb-8">
            <h3 className="text-[11px] font-semibold text-secondary/50 mb-4 uppercase tracking-[0.15em]">
              Timeline
            </h3>
            <div className="space-y-4">
              {sortedTimeline.slice(0, 8).map((event, i) => (
                <div key={event.id || i}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-secondary/50">{getTimeLabel(event.timestamp)}</span>
                    {event.source_name && (
                      <>
                        <span className="text-secondary/30 text-[10px]">·</span>
                        <span className="text-[10px] text-secondary/50 truncate max-w-[140px]">{event.source_name}</span>
                      </>
                    )}
                  </div>
                  <h4 className="text-sm font-medium text-foreground leading-snug">{event.title}</h4>
                  {event.summary && (
                    <p className="text-xs text-secondary/50 line-clamp-2 mt-1">{stripMarkdown(event.summary)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Original sources */}
        <div className="pt-6 border-t border-border/15">
          {isMultiSource && content.articleSources && content.articleSources.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-semibold text-secondary/55 mb-3 uppercase tracking-[0.15em]">
                Read the original sources
              </h3>
              <div className="space-y-2">
                {content.articleSources.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-secondary transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-secondary/35 mb-0.5">{s.name}</p>
                      <p className="text-sm text-foreground/80 group-hover:text-foreground truncate transition-colors">{s.title}</p>
                    </div>
                    <ExternalLink size={14} className="shrink-0 text-secondary/25 group-hover:text-secondary/50 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          ) : content.url ? (
            <a
              href={content.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98]"
            >
              Read original source
              <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─── Upgrade CTA Card ─── */
function UpgradeCard({ lockedCount }: { lockedCount: number }) {
  return (
    <div className="p-4 mx-5 my-3 rounded-xl bg-linear-to-br from-foreground/5 to-foreground/10 border border-foreground/8">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center">
          <Lock size={14} className="text-foreground/60" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{lockedCount}+ more stories</p>
          <p className="text-[11px] text-secondary/50">Unlock with Pro</p>
        </div>
      </div>
      <Link
        href="/profile?tab=subscription"
        onClick={() => trackCheckoutClicked('feed_upgrade_card_trending', { locked_count: lockedCount })}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98]"
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
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <div className="w-14 h-14 rounded-2xl bg-foreground/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={24} className="text-foreground/60" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Unlock Your Full Feed
        </h3>
        <p className="text-sm text-secondary/50 mb-5">
          Get unlimited access to all trending topics, personalized articles, and AI summaries.
        </p>
        <Link
          href="/profile?tab=subscription"
          onClick={() => trackCheckoutClicked('feed_upgrade_banner')}
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Sparkles size={16} />
          Start 3-Day Free Trial
        </Link>
        <p className="text-[11px] text-secondary/35 mt-3">
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
  const { user, profile, loading, profileResolved, refreshProfile } = useAuth();
  const [feedBuildNow] = useState(() => Date.now());
  const checkoutReturned = searchParams.get('subscription') === 'success';
  const trackedPaywalls = React.useRef<Set<string>>(new Set());
  const trackedCheckoutSuccess = React.useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMobileContent, setShowMobileContent] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'for_you' | 'suggested'>('all');
  const [isExpanded, setIsExpanded] = useState(false);
  const refreshProfileRef = React.useRef(refreshProfile);

  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) setIsExpanded(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isExpanded]);


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

  useEffect(() => {
    if (!checkoutReturned || !user) return;
    let attempts = 0;
    const refreshAccess = async () => {
      attempts += 1;
      await refreshProfileRef.current();
      await mutateFeed();
    };
    refreshAccess();
    const interval = setInterval(() => {
      if (attempts >= 6) { clearInterval(interval); return; }
      refreshAccess();
    }, 4000);
    return () => clearInterval(interval);
  }, [checkoutReturned, user, mutateFeed]);

  const trendingTopics = useMemo(() => {
    const topics = v3Feed?.trending_topics || [];
    return [...topics].sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return (b.popularity_score || 0) - (a.popularity_score || 0);
    });
  }, [v3Feed?.trending_topics]);

  const userInterests = useMemo(() => new Set(profile?.interests || []), [profile?.interests]);

  const visibleTrendingTopics = useMemo(() => {
    if (isSubscribed) return trendingTopics;

    const getInterest = (t: TrendingTopic) =>
      t.interest_id && userInterests.has(t.interest_id) ? t.interest_id
        : t.tags?.find(tag => userInterests.has(tag)) || null;

    const buckets = new Map<string, TrendingTopic[]>();
    for (const t of trendingTopics) {
      const interest = getInterest(t);
      if (!interest) continue;
      const arr = buckets.get(interest) || [];
      arr.push(t);
      buckets.set(interest, arr);
    }

    const picked: TrendingTopic[] = [];
    const pickedIds = new Set<string>();
    const bucketKeys = [...buckets.keys()];

    let round = 0;
    while (picked.length < FREE_LIMITS.trending && round < 10) {
      for (const key of bucketKeys) {
        if (picked.length >= FREE_LIMITS.trending) break;
        const arr = buckets.get(key)!;
        if (round < arr.length && !pickedIds.has(arr[round].id)) {
          picked.push(arr[round]);
          pickedIds.add(arr[round].id);
        }
      }
      round++;
    }

    if (picked.length < FREE_LIMITS.trending) {
      for (const t of trendingTopics) {
        if (picked.length >= FREE_LIMITS.trending) break;
        if (!pickedIds.has(t.id)) {
          picked.push(t);
          pickedIds.add(t.id);
        }
      }
    }

    return picked;
  }, [isSubscribed, trendingTopics, userInterests]);

  const lockedTrendingCount = useMemo(() => {
    const total = trendingTopics.length || (v3Feed?.trending?.length || 0);
    return Math.max(0, total - FREE_LIMITS.trending);
  }, [trendingTopics.length, v3Feed?.trending?.length]);

  useEffect(() => {
    if (isSubscribed) return;
    if (lockedTrendingCount > 0 && !trackedPaywalls.current.has('trending')) {
      trackedPaywalls.current.add('trending');
      trackPaywallShown('feed_trending', { locked_count: lockedTrendingCount });
    }
  }, [isSubscribed, lockedTrendingCount]);

  useEffect(() => {
    if (checkoutReturned && isSubscribed && !trackedCheckoutSuccess.current) {
      trackedCheckoutSuccess.current = true;
      trackSubscriptionStarted('pro_monthly');
    }
  }, [checkoutReturned, isSubscribed]);

  const currentList = useMemo(() => {
    const list: {
      id: string;
      type: 'topic' | 'article';
      title: string;
      preview: string;
      timestamp?: string;
      source?: string;
      sourceCount: number;
      thumbnail?: string | null;
      interestId?: string;
      tags?: string[];
      data: TrendingTopic | FeedItem;
    }[] = [];

    const coveredArticleIds = new Set<string>();

    if (visibleTrendingTopics.length > 0) {
      for (const topic of visibleTrendingTopics) {
        const display = getTopicDisplay(topic);
        list.push({
          id: topic.id,
          type: 'topic',
          title: display.title,
          preview: getPreview(display.subtitle || display.summary),
          timestamp: topic.articles?.[0]?.published_date,
          source: display.isSingleton ? display.article?.source_name : undefined,
          sourceCount: topic.source_count || 0,
          thumbnail: display.isSingleton ? display.article?.thumbnail : topic.thumbnail,
          interestId: topic.interest_id,
          tags: topic.tags,
          data: topic,
        });
        for (const a of topic.articles || []) {
          coveredArticleIds.add(a.id);
        }
      }
    }

    const allTrending = v3Feed?.trending || [];
    const remaining = allTrending.filter(item => !coveredArticleIds.has(item.id));
    const cappedRemaining = isSubscribed ? remaining : remaining.slice(0, Math.max(0, FREE_LIMITS.trending - list.length));

    for (const item of cappedRemaining) {
      list.push({
        id: item.id,
        type: 'article',
        title: item.title,
        preview: getPreview(getArticleSummary(item)),
        timestamp: item.published_date,
        source: item.source_name,
        sourceCount: item.metadata?.source_count || (item.sources?.length || 0),
        thumbnail: item.thumbnail,
        interestId: item.interest_id,
        tags: item.tags,
        data: item,
      });
    }

    if (list.length === 0) {
      for (const item of fallbackTrending) {
        list.push({
          id: item.id,
          type: 'article',
          title: item.title,
          preview: getPreview(getArticleSummary(item)),
          timestamp: item.published_date,
          source: item.source_name,
          sourceCount: item.metadata?.source_count || (item.sources?.length || 0),
          thumbnail: item.thumbnail,
          interestId: item.interest_id,
          tags: item.tags,
          data: item,
        });
      }
    }

    return list;
  }, [visibleTrendingTopics, v3Feed?.trending, isSubscribed, fallbackTrending]);


  const filteredList = useMemo(() => {
    if (activeFilter === 'all') return currentList;
    return currentList.filter(item => {
      const matchesInterest = item.interestId ? userInterests.has(item.interestId) : false;
      const matchesTags = item.tags?.some(tag => userInterests.has(tag)) || false;
      const isForYou = matchesInterest || matchesTags;
      return activeFilter === 'for_you' ? isForYou : !isForYou;
    });
  }, [currentList, activeFilter, userInterests]);

  const filterCounts = useMemo(() => {
    let forYou = 0;
    let suggested = 0;
    for (const item of currentList) {
      const matchesInterest = item.interestId ? userInterests.has(item.interestId) : false;
      const matchesTags = item.tags?.some(tag => userInterests.has(tag)) || false;
      if (matchesInterest || matchesTags) forYou++;
      else suggested++;
    }
    return { all: currentList.length, for_you: forYou, suggested };
  }, [currentList, userInterests]);

  useEffect(() => {
    if (filteredList.length > 0 && (!selectedId || !filteredList.find(item => item.id === selectedId))) {
      setSelectedId(filteredList[0].id);
    }
  }, [filteredList, selectedId]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return currentList.find(item => item.id === selectedId) || null;
  }, [currentList, selectedId]);

  const selectedContent = useMemo((): ContentData | null => {
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
        whyItMatters: display.isSingleton
          ? display.article?.summary?.short_article?.why_it_matters
          : undefined,
        readingTime: display.readingTime,
        articleSources: !display.isSingleton
          ? topic.articles?.map(a => ({ name: a.source_name || '', title: a.title, url: a.url })).filter(s => s.name)
          : undefined,
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
      sourceCount: article.metadata?.source_count,
      whyItMatters: article.summary?.short_article?.why_it_matters,
      readingTime: article.summary?.reading_time_minutes,
      articleSources: article.sources?.filter(s => s.name) as ContentData['articleSources'],
    };
  }, [selectedItem]);

  const isLoading = loading || (feedLoading && !v3Feed);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary/40" />
      </div>
    );
  }

  const storyCount = currentList.length + (isSubscribed ? 0 : lockedTrendingCount);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <img src="/trace.webp" alt="Trace" className="h-6 w-auto" />
              <span className="text-sm font-semibold tracking-[0.18em]">TRACE</span>
            </Link>
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <Link href="/profile">
                  <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
                </Link>
              ) : (
                <Link
                  href="/profile"
                  className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center"
                >
                  <span className="text-sm font-semibold">{user?.email?.[0]?.toUpperCase() || 'U'}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {checkoutReturned && (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <Loader2 size={16} className={`text-amber-600 ${isSubscribed ? '' : 'animate-spin'}`} />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isSubscribed ? 'Trace Pro is active.' : 'Activating your Pro access...'}
                </p>
                <p className="text-xs text-secondary/50">
                  {isSubscribed
                    ? 'Your full feed is unlocked.'
                    : 'Your payment went through. Your full feed should unlock in a moment.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Desktop */}
        <div className={`hidden md:block ${isExpanded ? 'fixed inset-0 z-60 bg-background p-0' : ''}`}>
          <div
            className={`flex bg-surface overflow-hidden ${isExpanded ? 'h-full' : 'rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}
            style={isExpanded ? undefined : { height: 'calc(100vh - 120px)', minHeight: '500px' }}
          >
            {/* Sidebar */}
            <div className="w-[340px] shrink-0 border-r border-border/20 flex flex-col">
              <div className="px-5 pt-5 pb-3 border-b border-border/20">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-bold text-foreground tracking-[-0.01em]">
                    Your Briefing
                  </h2>
                  <button
                    onClick={() => setIsExpanded(e => !e)}
                    className="p-1.5 rounded-lg text-secondary/40 hover:text-foreground hover:bg-surface-secondary transition-colors"
                    title={isExpanded ? 'Exit full screen (Esc)' : 'Full screen'}
                  >
                    {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                </div>
                <p className="text-[12px] text-secondary/55 mt-0.5 mb-3">
                  {getTodayLabel()}{storyCount > 0 ? ` · ${storyCount} stories` : ''}
                </p>
                <div className="flex items-center gap-1.5">
                  {([
                    { key: 'all' as const, label: 'All' },
                    { key: 'for_you' as const, label: 'For You' },
                    { key: 'suggested' as const, label: 'Suggested' },
                  ]).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setActiveFilter(key)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                        activeFilter === key
                          ? 'bg-foreground text-background'
                          : 'bg-foreground/8 text-secondary/70 hover:bg-foreground/12 hover:text-secondary/90'
                      }`}
                    >
                      {label}{filterCounts[key] > 0 ? ` (${filterCounts[key]})` : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-border/10">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-secondary/40" />
                  </div>
                ) : filteredList.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <p className="text-sm text-secondary/55">
                      {activeFilter === 'for_you'
                        ? 'No stories matching your interests yet'
                        : activeFilter === 'suggested'
                        ? 'No suggested stories right now'
                        : 'No stories available'}
                    </p>
                  </div>
                ) : (
                  <>
                    {filteredList.map((item) => (
                      <StoryItem
                        key={item.id}
                        title={item.title}
                        preview={item.preview}
                        timestamp={item.timestamp}
                        source={item.source}
                        sourceCount={item.sourceCount}
                        tag={item.interestId}
                        selected={selectedId === item.id}
                        onClick={() => setSelectedId(item.id)}
                      />
                    ))}
                  </>
                )}
              </div>

              {!isSubscribed && lockedTrendingCount > 0 && (
                <UpgradeCard lockedCount={lockedTrendingCount} />
              )}

              {!isSubscribed && currentList.length > 0 && (
                <div className="px-5 py-3 border-t border-border/20">
                  <Link
                    href="/profile?tab=subscription"
                    className="block text-center text-[11px] text-secondary/40 hover:text-foreground transition-colors"
                  >
                    Upgrade to unlock all stories →
                  </Link>
                </div>
              )}
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-secondary/40" />
              </div>
            ) : selectedContent ? (
              <ContentPanel content={selectedContent} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-secondary/40 text-sm">Select a story to read</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <div className="rounded-2xl bg-surface overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-5 pt-5 pb-3 border-b border-border/20">
              <h2 className="text-[15px] font-bold text-foreground tracking-[-0.01em]">
                Your Briefing
              </h2>
              <p className="text-[12px] text-secondary/55 mt-0.5 mb-3">
                {getTodayLabel()}{storyCount > 0 ? ` · ${storyCount} stories` : ''}
              </p>
              <div className="flex items-center gap-1.5">
                {([
                  { key: 'all' as const, label: 'All' },
                  { key: 'for_you' as const, label: 'For You' },
                  { key: 'suggested' as const, label: 'Suggested' },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                      activeFilter === key
                        ? 'bg-foreground text-background'
                        : 'bg-foreground/8 text-secondary/70 hover:bg-foreground/12 hover:text-secondary/90'
                    }`}
                  >
                    {label}{filterCounts[key] > 0 ? ` (${filterCounts[key]})` : ''}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-secondary/40" />
              </div>
            ) : filteredList.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-secondary/55">
                  {activeFilter === 'for_you'
                    ? 'No stories matching your interests yet'
                    : activeFilter === 'suggested'
                    ? 'No suggested stories right now'
                    : 'No stories available'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {filteredList.map((item) => (
                  <StoryItem
                    key={item.id}
                    title={item.title}
                    preview={item.preview}
                    timestamp={item.timestamp}
                    source={item.source}
                    sourceCount={item.sourceCount}
                    tag={item.interestId}
                    selected={false}
                    onClick={() => { setSelectedId(item.id); setShowMobileContent(true); }}
                  />
                ))}
              </div>
            )}

            {!isSubscribed && lockedTrendingCount > 0 && (
              <UpgradeCard lockedCount={lockedTrendingCount} />
            )}

            {!isSubscribed && currentList.length > 0 && (
              <div className="px-5 py-3 border-t border-border/20">
                <Link
                  href="/profile?tab=subscription"
                  className="block text-center text-[11px] text-secondary/40 hover:text-foreground transition-colors"
                >
                  Upgrade to unlock all stories →
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Bottom Sheet */}
          {showMobileContent && selectedContent && (
            <>
              <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowMobileContent(false)} />
              <div className="fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up">
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 rounded-full bg-secondary/20" />
                </div>
                <div className="flex items-center justify-end px-4 pb-3 border-b border-border/20">
                  <button
                    onClick={() => setShowMobileContent(false)}
                    className="p-1.5 -mr-1.5 rounded-lg text-secondary/50 hover:text-foreground transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <h2 className="text-xl font-bold text-foreground leading-tight tracking-[-0.02em] mb-2">
                    {selectedContent.title}
                  </h2>

                  {/* Source strip (mobile) */}
                  {(selectedContent.sourceCount || 0) > 1 && selectedContent.articleSources && selectedContent.articleSources.length > 0 && (
                    <p className="text-[12px] text-secondary/50 mb-4">
                      From {selectedContent.articleSources.map(s => s.name).join(', ')}
                    </p>
                  )}

                  {/* Body (mobile) */}
                  {selectedContent.body && (
                    <div className="prose prose-sm max-w-none text-secondary leading-relaxed mb-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedContent.body}</ReactMarkdown>
                    </div>
                  )}

                  {/* Key Takeaways (mobile) */}
                  {selectedContent.keyPoints && selectedContent.keyPoints.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-[11px] font-semibold text-secondary/60 mb-2 uppercase tracking-[0.15em]">
                        Key Takeaways
                      </h3>
                      <div className="space-y-1.5">
                        {selectedContent.keyPoints.slice(0, 4).map((point, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-secondary/35 font-mono text-xs">{i + 1}.</span>
                            <p className="text-sm text-secondary/80 leading-relaxed">{stripMarkdown(point)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Why it matters (mobile) */}
                  {selectedContent.whyItMatters && (
                    <div className="mb-4 pl-3 border-l-2 border-foreground/10">
                      <p className="text-[11px] font-semibold text-secondary/60 mb-1 uppercase tracking-[0.15em]">Why it matters</p>
                      <p className="text-sm text-secondary/80 leading-relaxed">{stripMarkdown(selectedContent.whyItMatters)}</p>
                    </div>
                  )}

                  {/* Timeline (mobile) */}
                  {selectedContent.timeline && selectedContent.timeline.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-[11px] font-semibold text-secondary/50 mb-3 uppercase tracking-[0.15em]">
                        Timeline
                      </h3>
                      <div className="space-y-3">
                        {selectedContent.timeline.slice(0, 5).map((event, i) => (
                          <div key={i}>
                            <p className="text-[10px] text-secondary/40 mb-0.5">{getTimeLabel(event.timestamp)}</p>
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
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-full bg-surface border border-border/20 shadow-lg">
            <Loader2 size={16} className="animate-spin text-secondary/50" />
            <p className="text-sm text-secondary/60">Building your personalized feed...</p>
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
