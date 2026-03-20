"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, X, Lock, Sparkles, ExternalLink, Maximize2, Minimize2, Check, ArrowLeft, ArrowRight } from 'lucide-react';
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

function decodeHtml(str: string): string {
  if (!str) return str;
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

const FREE_LIMITS = { trending: 3 };

const feedFetcher = (uid: string, role?: string | null) => getV3UserFeed(uid, { role });

const trendingFetcher = async () => {
  const res = await fetch('/api/public/trending');
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.items)) return [];
  return data.items.map((item: Record<string, unknown>): FeedItem => ({
    id: String(item.id || ''),
    title: decodeHtml(String(item.title || '')),
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
    title: decodeHtml(article?.title || topic.title || ''),
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
  url?: string;
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
  thumbnail,
  selected,
  onClick,
}: {
  title: string;
  preview?: string;
  timestamp?: string;
  source?: string;
  sourceCount: number;
  tag?: string;
  thumbnail?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  const isMultiSource = sourceCount > 1;
  const tagLabel = tag ? INTEREST_LABEL[tag] : undefined;
  const imgUrl = thumbnail ? getArticleImage(thumbnail, title) : null;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-4 transition-colors ${
        selected ? 'bg-surface-secondary' : 'hover:bg-surface-secondary/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1.5">
            {title}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {timestamp && (
              <span className="text-[10px] text-secondary/50">
                {getTimeLabel(timestamp)}
              </span>
            )}
            {timestamp && (source || isMultiSource) && (
              <span className="text-secondary/30 text-[10px]">·</span>
            )}
            {isMultiSource ? (
              <span className="text-[10px] text-secondary/50">{sourceCount} sources</span>
            ) : source ? (
              <span className="text-[10px] text-secondary/50 truncate">{source}</span>
            ) : null}
            {tagLabel && (
              <>
                <span className="text-secondary/30 text-[10px]">·</span>
                <span className="text-[10px] text-secondary/50">{tagLabel}</span>
              </>
            )}
          </div>
        </div>
        {imgUrl && (
          <img
            src={imgUrl}
            alt=""
            className="shrink-0 w-14 h-14 rounded-lg object-cover bg-foreground/5"
          />
        )}
      </div>
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
            <div className="space-y-1">
              {sortedTimeline.slice(0, 8).map((event, i) => {
                const inner = (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-secondary/50">{getTimeLabel(event.timestamp)}</span>
                      {event.source_name && (
                        <>
                          <span className="text-secondary/30 text-[10px]">·</span>
                          <span className="text-[10px] text-secondary/50 truncate max-w-[140px]">{event.source_name}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground leading-snug">{event.title}</h4>
                        {event.summary && (
                          <p className="text-xs text-secondary/50 line-clamp-2 mt-1">{stripMarkdown(event.summary)}</p>
                        )}
                      </div>
                      {event.url && <ExternalLink size={13} className="shrink-0 mt-0.5 text-secondary/25 group-hover:text-secondary/50 transition-colors" />}
                    </div>
                  </>
                );
                return event.url ? (
                  <a
                    key={event.id || i}
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg px-3 py-3 -mx-3 hover:bg-foreground/4 transition-colors"
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={event.id || i} className="px-3 py-3 -mx-3">
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Original source link (single-source only) */}
        {!hasTimeline && content.url && (
          <div className="pt-6 border-t border-border/15">
            <a
              href={content.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98]"
            >
              Read original source
              <ExternalLink size={14} />
            </a>
          </div>
        )}
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

/* ─── Full-width Paywall Gate ─── */
function PaywallGate() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleStartTrial = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    trackCheckoutClicked('feed_paywall_gate');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create checkout');
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const benefits = [
    {
      title: 'Your morning briefing, every day',
      desc: 'Wake up to a full feed of stories filtered to what you care about — AI, tech, markets, whatever you follow.',
    },
    {
      title: 'The point, not the whole article',
      desc: "We read it for you. You get the summary, the key takeaways, and why it matters — in under a minute.",
    },
    {
      title: '10 outlets covered it. We show you one.',
      desc: 'When everyone writes about the same story, we collapse it into a single clear view so you stop reading the same thing twice.',
    },
    {
      title: 'No rabbit holes',
      desc: "Skim today's feed in 5 minutes. Know what's going on. Move on with your day.",
    },
  ];
  return (
    <div className="w-full sm:rounded-2xl sm:bg-surface sm:shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="max-w-md mx-auto px-6 sm:px-12 py-10 sm:py-16">
        <p className="text-[11px] font-semibold text-secondary/35 uppercase tracking-[0.18em] mb-5">Trace Pro</p>
        <h2 className="text-[1.65rem] font-bold text-foreground tracking-[-0.025em] leading-tight mb-3">
          The news habit that<br />doesn't waste your time.
        </h2>
        <p className="text-[14px] text-secondary/50 mb-10 leading-relaxed">
          Try it free for 3 days. No charge until the trial ends.
        </p>

        <div className="space-y-5 mb-10">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-3">
              <Check size={13} className="shrink-0 mt-[3px] text-foreground/40" strokeWidth={2.5} />
              <div>
                <p className="text-[13px] font-semibold text-foreground leading-snug">{b.title}</p>
                <p className="text-[12px] text-secondary/50 mt-0.5 leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}
        <button
          onClick={handleStartTrial}
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full text-[13px] font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:shadow-md hover:shadow-black/10 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:scale-100"
        >
          {loading ? <><Loader2 size={14} className="animate-spin" />Setting up your trial...</> : 'Start Free Trial'}
        </button>
        <p className="text-[11px] text-secondary/35 mt-2.5 text-center">$2.99/month after 3 days · Cancel anytime</p>
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

  // Sync browser back button with mobile article view
  useEffect(() => {
    const onPopState = () => setShowMobileContent(false);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openMobileArticle = (id: string) => {
    setSelectedId(id);
    setShowMobileContent(true);
    window.history.pushState({ article: id }, '');
  };

  const closeMobileArticle = () => {
    setShowMobileContent(false);
    if (window.history.state?.article) window.history.back();
  };
  const [activeFilter, setActiveFilter] = useState<string>('all');
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
    user?.uid ? `feed-${user.uid}-${profile?.role || 'unknown'}` : null,
    () => feedFetcher(user!.uid, profile?.role),
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
          title: decodeHtml(display.title || ''),
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
        title: decodeHtml(item.title || ''),
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

    return list.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });
  }, [visibleTrendingTopics, v3Feed?.trending, isSubscribed, fallbackTrending]);


  const filteredList = useMemo(() => {
    if (activeFilter === 'all') return currentList;
    if (activeFilter === 'suggested') {
      return currentList.filter(item => {
        const matchesInterest = item.interestId ? userInterests.has(item.interestId) : false;
        const matchesTags = item.tags?.some(tag => userInterests.has(tag)) || false;
        return !(matchesInterest || matchesTags);
      });
    }
    // Interest tab: filter to items matching that specific interest
    return currentList.filter(item => {
      const matchesInterest = item.interestId === activeFilter;
      const matchesTags = item.tags?.includes(activeFilter) || false;
      return matchesInterest || matchesTags;
    });
  }, [currentList, activeFilter, userInterests]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: currentList.length, suggested: 0 };
    for (const item of currentList) {
      const matchesInterest = item.interestId ? userInterests.has(item.interestId) : false;
      const matchesTags = item.tags?.some(tag => userInterests.has(tag)) || false;
      if (matchesInterest || matchesTags) {
        // Count per interest
        const matchedInterest = item.interestId && userInterests.has(item.interestId)
          ? item.interestId
          : item.tags?.find(tag => userInterests.has(tag));
        if (matchedInterest) counts[matchedInterest] = (counts[matchedInterest] || 0) + 1;
      } else {
        counts.suggested++;
      }
    }
    return counts;
  }, [currentList, userInterests]);

  const interestTabs = useMemo(() => {
    return ONBOARDING_INTERESTS.filter(interest =>
      userInterests.has(interest.id) && (filterCounts[interest.id] || 0) > 0
    );
  }, [userInterests, filterCounts]);

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
        title: decodeHtml(display.title || ''),
        body: display.summary || display.subtitle,
        source: display.isSingleton ? display.article?.source_name : undefined,
        url: articleUrl,
        timestamp: topic.articles?.[0]?.published_date,
        keyPoints: display.isSingleton
          ? display.article?.summary?.short_article?.key_takeaways
          : topic.key_points,
        thumbnail: display.isSingleton ? display.article?.thumbnail : topic.thumbnail,
        timeline: !display.isSingleton
          ? topic.timeline?.map(e => ({ ...e, url: e.article_url || e.source_url }))
          : undefined,
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
      title: decodeHtml(article.title || ''),
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

      <div className="py-0 sm:py-4 px-0 sm:p-6 lg:p-8 max-w-7xl mx-auto sm:px-6">
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

        {!isSubscribed && !isLoading && <PaywallGate />}

        {/* Desktop */}
        <div className={`${!isSubscribed ? 'hidden' : 'hidden md:block'} ${isExpanded ? 'fixed inset-0 z-60 bg-background p-0' : ''}`}>
          <div
            className={`flex bg-white overflow-hidden ${isExpanded ? 'h-full' : 'rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}
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
                {isSubscribed && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {([
                      { key: 'all', label: 'All' },
                      ...interestTabs.map(i => ({ key: i.id, label: i.label })),
                      { key: 'suggested', label: 'Suggested' },
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
                        {label}{(filterCounts[key] || 0) > 0 ? ` (${filterCounts[key]})` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!isSubscribed ? (
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="w-10 h-10 rounded-xl bg-foreground/8 flex items-center justify-center mb-3">
                    <Lock size={16} className="text-foreground/50" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">Pro access required</p>
                  <p className="text-[12px] text-secondary/50 mb-5 leading-relaxed">Start your free trial to read today's full briefing.</p>
                  <Link
                    href="/profile?tab=subscription"
                    onClick={() => trackCheckoutClicked('feed_sidebar_paywall')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Sparkles size={13} />
                    Start Free Trial
                  </Link>
                  <p className="text-[11px] text-secondary/35 mt-2">Cancel anytime · $2.99/mo after trial</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-border/10">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={20} className="animate-spin text-secondary/40" />
                    </div>
                  ) : filteredList.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <p className="text-sm text-secondary/55">
                        {activeFilter === 'suggested'
                          ? 'No suggested stories right now'
                          : activeFilter === 'all'
                          ? 'No stories available'
                          : `No stories for ${INTEREST_LABEL[activeFilter] || activeFilter} yet`}
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
                          thumbnail={item.thumbnail}
                          selected={selectedId === item.id}
                          onClick={() => setSelectedId(item.id)}
                        />
                      ))}
                    </>
                  )}
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
        <div className={isSubscribed ? 'md:hidden' : 'hidden'}>

          {/* Full-screen story view */}
          {showMobileContent && selectedContent && (() => {
            const currentIdx = filteredList.findIndex(i => i.id === selectedId);
            const nextItem = currentIdx >= 0 && currentIdx < filteredList.length - 1 ? filteredList[currentIdx + 1] : null;
            return (
            <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
              {/* Nav bar */}
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/10 flex items-center gap-2 px-4 py-3">
                <button
                  onClick={closeMobileArticle}
                  className="p-1.5 -ml-1.5 rounded-lg text-foreground/60 active:bg-foreground/8"
                >
                  <ArrowLeft size={20} />
                </button>
                <span className="text-[13px] text-secondary/50 truncate flex-1">
                  {selectedContent.source || (selectedContent.sourceCount && selectedContent.sourceCount > 1 ? `${selectedContent.sourceCount} sources` : '')}
                </span>
              </div>

              {/* Content */}
              <div className="px-5 pt-5 pb-12">
                <h1 className="text-[1.35rem] font-bold text-foreground leading-tight tracking-[-0.02em] mb-2">
                  {selectedContent.title}
                </h1>

                {(selectedContent.sourceCount || 0) > 1 && selectedContent.articleSources && selectedContent.articleSources.length > 0 && (
                  <p className="text-[12px] text-secondary/50 mb-5">
                    From {selectedContent.articleSources.map(s => s.name).join(', ')}
                  </p>
                )}

                {selectedContent.thumbnail && (() => {
                  const imgUrl = getArticleImage(selectedContent.thumbnail, selectedContent.title);
                  return imgUrl ? (
                    <div className="mb-5">
                      <img src={imgUrl} alt="" className="w-full max-h-[220px] object-cover rounded-xl" />
                    </div>
                  ) : null;
                })()}

                {selectedContent.body && (
                  <div className="prose prose-sm max-w-none text-secondary leading-relaxed mb-6">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedContent.body}</ReactMarkdown>
                  </div>
                )}

                {selectedContent.keyPoints && selectedContent.keyPoints.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-[10px] font-semibold text-secondary/50 mb-3 uppercase tracking-[0.18em]">Key Takeaways</h3>
                    <div className="space-y-2">
                      {selectedContent.keyPoints.slice(0, 4).map((point, i) => (
                        <div key={i} className="flex gap-2.5">
                          <span className="text-secondary/35 font-mono text-xs mt-0.5">{i + 1}.</span>
                          <p className="text-[14px] text-secondary/80 leading-relaxed">{stripMarkdown(point)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedContent.whyItMatters && (
                  <div className="mb-6 pl-3 border-l-2 border-foreground/10">
                    <p className="text-[10px] font-semibold text-secondary/50 mb-1.5 uppercase tracking-[0.18em]">Why it matters</p>
                    <p className="text-[14px] text-secondary/80 leading-relaxed">{stripMarkdown(selectedContent.whyItMatters)}</p>
                  </div>
                )}

                {selectedContent.timeline && selectedContent.timeline.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-[10px] font-semibold text-secondary/50 mb-3 uppercase tracking-[0.18em]">Timeline</h3>
                    <div className="space-y-1">
                      {selectedContent.timeline.map((event, i) => {
                        const inner = (
                          <>
                            <p className="text-[10px] text-secondary/40 mb-0.5">{getTimeLabel(event.timestamp)}{event.source_name ? ` · ${event.source_name}` : ''}</p>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[14px] font-medium text-foreground leading-snug">{event.title}</p>
                              {event.url && <ExternalLink size={12} className="shrink-0 mt-0.5 text-secondary/30" />}
                            </div>
                          </>
                        );
                        return event.url ? (
                          <a key={i} href={event.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg px-3 py-2.5 -mx-3 hover:bg-foreground/4 active:bg-foreground/6">
                            {inner}
                          </a>
                        ) : (
                          <div key={i} className="px-3 py-2.5 -mx-3">{inner}</div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!selectedContent.timeline?.length && selectedContent.url && (
                  <a
                    href={selectedContent.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-foreground text-background"
                  >
                    Read original source
                    <ExternalLink size={13} />
                  </a>
                )}

                {nextItem && (
                  <div className="mt-10 pt-6 border-t border-border/15">
                    <button
                      onClick={() => { setSelectedId(nextItem.id); window.history.replaceState({ article: nextItem.id }, ''); window.scrollTo(0, 0); }}
                      className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-foreground/5 active:bg-foreground/10"
                    >
                      <div className="text-left">
                        <p className="text-[10px] font-semibold text-secondary/40 uppercase tracking-[0.15em] mb-1">Next</p>
                        <p className="text-[14px] font-semibold text-foreground leading-snug line-clamp-2">{nextItem.title}</p>
                      </div>
                      <ArrowRight size={18} className="shrink-0 ml-3 text-foreground/40" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );})()}

          {/* Feed list */}
          <div className="bg-background">
            {/* Briefing header */}
            <div className="px-5 pt-6 pb-4">
              <p className="text-[10px] font-semibold text-secondary/40 uppercase tracking-[0.2em] mb-1">{getTodayLabel()}</p>
              <div className="flex items-end justify-between">
                <h1 className="text-[1.6rem] font-bold text-foreground tracking-[-0.025em] leading-tight">Your Briefing</h1>
                {storyCount > 0 && (
                  <span className="text-[12px] text-secondary/45 mb-0.5">{storyCount} stories</span>
                )}
              </div>
            </div>

            {/* Horizontally scrollable tabs */}
            <div className="overflow-x-auto scrollbar-hide border-b border-border/15">
              <div className="flex items-center gap-2 px-5 pb-3 w-max">
                {([
                  { key: 'all', label: 'All' },
                  ...interestTabs.map(i => ({ key: i.id, label: i.label })),
                  { key: 'suggested', label: 'Suggested' },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                      activeFilter === key
                        ? 'bg-foreground text-background'
                        : 'bg-foreground/8 text-secondary/70'
                    }`}
                  >
                    {label}{(filterCounts[key] || 0) > 0 ? ` (${filterCounts[key]})` : ''}
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
                  {activeFilter === 'suggested' ? 'No suggested stories right now'
                    : activeFilter === 'all' ? 'No stories available'
                    : `No stories for ${INTEREST_LABEL[activeFilter] || activeFilter} yet`}
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
                    thumbnail={item.thumbnail}
                    selected={false}
                    onClick={() => openMobileArticle(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
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
