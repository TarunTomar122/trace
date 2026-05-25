import { adminFirestore } from '@/lib/firebase-admin';
import { applyFeedDedupe } from '@/lib/feed-dedupe';
import type { FeedItem, TopicTimelineEvent, TrendingTopic, V3UserFeed } from '@/lib/firestore';

/** Today + yesterday's global edition; pipeline handles source freshness. */
const GLOBAL_FEED_LOOKBACK_DOCS = 2;
const WEB_FULL_FEED_CACHE_COLLECTION = 'web_feed_full_cache';
const WEB_ITEM_DETAIL_CACHE_COLLECTION = 'web_feed_item_detail_cache';
// Fresh-window for the web full-feed cache. After this the entry is still
// served (stale-while-revalidate) while a background rebuild refreshes it.
const WEB_FULL_FEED_CACHE_TTL_MS = 3 * 60 * 1000;
const WEB_ITEM_DETAIL_CACHE_TTL_MS = 3 * 60 * 1000;
const WEB_FULL_FEED_CACHE_VERSION = 3;
const WEB_ITEM_DETAIL_CACHE_VERSION = 1;
const GUEST_FEED_INTERESTS = ['ai', 'tech', 'startups', 'engineering', 'markets'] as const;
const MAX_SUMMARY_BODY_CHARS = 2200;
const MAX_SUMMARY_SUBTITLE_CHARS = 280;
const MAX_WHY_IT_MATTERS_CHARS = 420;
const MAX_KEY_TAKEAWAYS = 4;
const MAX_SOURCES = 5;
const MAX_SIGNALS = 6;
const MAX_TOPIC_TIMELINE = 6;
const MAX_TOPIC_ARTICLES = 3;

function normalizeFeedRole(role?: string | null): string {
  const normalized = String(role || '').trim().toLowerCase();
  if (!normalized) return '';
  if (
    normalized === 'developer' ||
    normalized === 'engineer' ||
    normalized === 'software engineer' ||
    normalized === 'software developer' ||
    normalized === 'full stack developer' ||
    normalized === 'full-stack developer'
  ) {
    return 'developer';
  }
  if (
    normalized === 'designer' ||
    normalized === 'product designer' ||
    normalized === 'ux designer' ||
    normalized === 'ui designer'
  ) {
    return 'designer';
  }
  if (normalized === 'pm' || normalized === 'product manager') {
    return 'pm';
  }
  if (normalized === 'data scientist') {
    return 'developer';
  }
  if (normalized === 'founder' || normalized === 'co-founder' || normalized === 'startup founder') {
    return 'founder';
  }
  return 'developer';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocData = Record<string, any>;
type FeedBody = Omit<V3UserFeed, 'viewer_profile'>;
type FeedItemDetailResponse =
  | { kind: 'article'; item: FeedItem }
  | { kind: 'topic'; item: TrendingTopic };

function extractRoleBuckets(globalData: DocData, normalizedRole: string) {
  const roleMap = globalData.for_you_roles && typeof globalData.for_you_roles === 'object'
    ? globalData.for_you_roles : null;
  const pulseRoleMap = globalData.pulse_roles && typeof globalData.pulse_roles === 'object'
    ? globalData.pulse_roles : null;
  const dailyPulseRoleMap = globalData.daily_pulse_roles && typeof globalData.daily_pulse_roles === 'object'
    ? globalData.daily_pulse_roles : null;
  const communityRoleMap = globalData.community_pulse_roles && typeof globalData.community_pulse_roles === 'object'
    ? globalData.community_pulse_roles : null;
  const buildRoleMap = globalData.build_pulse_roles && typeof globalData.build_pulse_roles === 'object'
    ? globalData.build_pulse_roles : null;

  const roleFeed = normalizedRole && roleMap && Array.isArray(roleMap[normalizedRole])
    ? roleMap[normalizedRole] : [];
  const pulseFeed = normalizedRole && pulseRoleMap && Array.isArray(pulseRoleMap[normalizedRole])
    ? pulseRoleMap[normalizedRole] : [];

  const dailyPulseBucket = normalizedRole && dailyPulseRoleMap?.[normalizedRole] && typeof dailyPulseRoleMap[normalizedRole] === 'object'
    ? dailyPulseRoleMap[normalizedRole]
    : null;

  const communityFeed = normalizedRole && communityRoleMap && Array.isArray(communityRoleMap[normalizedRole])
    ? communityRoleMap[normalizedRole] : [];
  const buildFeed = normalizedRole && buildRoleMap && Array.isArray(buildRoleMap[normalizedRole])
    ? buildRoleMap[normalizedRole] : [];

  return { roleFeed, pulseFeed, dailyPulseBucket, communityFeed, buildFeed };
}

function toDateMaybe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe.toDate === 'function') {
      try {
        const date = maybe.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
      } catch {
        return null;
      }
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function computeFeedAccess(profile: DocData | null) {
  const webSub = String(profile?.subscriptionStatus || 'none');
  const appSub = String(profile?.appSubscriptionStatus || 'none');
  let hasAccess = ['trial', 'active'].includes(webSub) || ['trial', 'active'].includes(appSub);

  if (hasAccess && profile?.cancelledAt) {
    const cancelDate = toDateMaybe(profile.willCancelAt) || toDateMaybe(profile.nextBillingDate);
    if (cancelDate && new Date() >= cancelDate) {
      hasAccess = false;
    }
  }

  return { webSub, appSub, hasAccess };
}

function buildViewerProfile(profile: DocData | null, roleFromProfile: string, viewerInterests: string[]) {
  const { webSub, appSub, hasAccess } = computeFeedAccess(profile);
  return {
    role: roleFromProfile || undefined,
    interests: viewerInterests,
    onboarded: profile?.onboarded === true,
    subscription_status: webSub,
    app_subscription_status: appSub,
    has_access: hasAccess,
  };
}

function getFullFeedCacheDocId(normalizedRole: string) {
  return `latest_${normalizedRole || 'developer'}`;
}

function getItemDetailCacheRoleDocId(normalizedRole: string) {
  return `latest_${normalizedRole || 'developer'}`;
}

function isFreshIsoTimestamp(value: unknown, ttlMs: number) {
  if (typeof value !== 'string') return false;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < ttlMs;
}

function isFeedItemDetailResponse(value: unknown): value is FeedItemDetailResponse {
  if (!value || typeof value !== 'object') return false;
  const data = value as { kind?: unknown; item?: unknown };
  if (data.kind !== 'article' && data.kind !== 'topic') return false;
  return Boolean(data.item && typeof data.item === 'object');
}

function findFeedItemDetailInFeed(feed: FeedBody, itemId: string): FeedItemDetailResponse | null {
  const topic = feed.trending_topics?.find((entry) => entry.id === itemId);
  if (topic) {
    return { kind: 'topic', item: topic };
  }

  const articleGroups: FeedItem[][] = [
    feed.for_you || [],
    feed.trending || [],
    feed.pulse || [],
    feed.community_pulse || [],
    feed.build_pulse || [],
    feed.daily_pulse?.tools || [],
    feed.daily_pulse?.blogs || [],
    feed.daily_pulse?.discussions || [],
  ];

  for (const group of articleGroups) {
    const match = group.find((entry) => entry.id === itemId);
    if (match) {
      return { kind: 'article', item: match };
    }
  }

  return null;
}

async function writeItemDetailCacheForRole(normalizedRole: string, feed: FeedBody, generatedAt: string) {
  if (!adminFirestore) {
    throw new Error('Server configuration error');
  }

  const detailByItemId = new Map<string, FeedItemDetailResponse>();
  for (const topic of feed.trending_topics || []) {
    detailByItemId.set(topic.id, { kind: 'topic', item: topic });
  }

  const articleGroups: FeedItem[][] = [
    feed.for_you || [],
    feed.trending || [],
    feed.pulse || [],
    feed.community_pulse || [],
    feed.build_pulse || [],
    feed.daily_pulse?.tools || [],
    feed.daily_pulse?.blogs || [],
    feed.daily_pulse?.discussions || [],
  ];

  for (const group of articleGroups) {
    for (const article of group) {
      if (!detailByItemId.has(article.id)) {
        detailByItemId.set(article.id, { kind: 'article', item: article });
      }
    }
  }

  if (detailByItemId.size === 0) return;

  const roleDocRef = adminFirestore
    .collection(WEB_ITEM_DETAIL_CACHE_COLLECTION)
    .doc(getItemDetailCacheRoleDocId(normalizedRole));
  const writes: Promise<unknown>[] = [];

  for (const [itemId, detail] of detailByItemId.entries()) {
    writes.push(
      roleDocRef.collection('items').doc(itemId).set(stripUndefinedDeep({
        version: WEB_ITEM_DETAIL_CACHE_VERSION,
        generated_at: generatedAt,
        detail,
      }), { merge: true })
    );
  }

  await Promise.all(writes);
}

async function readFeedItemDetailFromCache(
  normalizedRole: string,
  itemId: string
): Promise<FeedItemDetailResponse | null> {
  if (!adminFirestore) {
    throw new Error('Server configuration error');
  }

  const itemSnapshot = await adminFirestore
    .collection(WEB_ITEM_DETAIL_CACHE_COLLECTION)
    .doc(getItemDetailCacheRoleDocId(normalizedRole))
    .collection('items')
    .doc(itemId)
    .get();

  if (!itemSnapshot.exists) return null;

  const cacheData = itemSnapshot.data() as {
    version?: number;
    generated_at?: string;
    detail?: unknown;
  } | undefined;

  if (
    cacheData?.version !== WEB_ITEM_DETAIL_CACHE_VERSION
    || !isFreshIsoTimestamp(cacheData.generated_at, WEB_ITEM_DETAIL_CACHE_TTL_MS)
    || !isFeedItemDetailResponse(cacheData.detail)
  ) {
    return null;
  }

  return cacheData.detail;
}

async function hydrateFeedItemDetailFromFullCache(
  normalizedRole: string,
  itemId: string
): Promise<FeedItemDetailResponse | null> {
  if (!adminFirestore) {
    throw new Error('Server configuration error');
  }

  const fullCacheSnapshot = await adminFirestore
    .collection(WEB_FULL_FEED_CACHE_COLLECTION)
    .doc(getFullFeedCacheDocId(normalizedRole))
    .get();

  if (!fullCacheSnapshot.exists) return null;

  const fullCacheData = fullCacheSnapshot.data() as {
    version?: number;
    generated_at?: string;
    feed?: FeedBody;
  } | undefined;

  if (
    fullCacheData?.version !== WEB_FULL_FEED_CACHE_VERSION
    || !fullCacheData.feed
    || !isFreshIsoTimestamp(fullCacheData.generated_at, WEB_FULL_FEED_CACHE_TTL_MS)
  ) {
    return null;
  }

  const detail = findFeedItemDetailInFeed(fullCacheData.feed, itemId);
  if (!detail) return null;

  const generatedAt = fullCacheData.generated_at || new Date().toISOString();
  await adminFirestore
    .collection(WEB_ITEM_DETAIL_CACHE_COLLECTION)
    .doc(getItemDetailCacheRoleDocId(normalizedRole))
    .collection('items')
    .doc(itemId)
    .set(stripUndefinedDeep({
      version: WEB_ITEM_DETAIL_CACHE_VERSION,
      generated_at: generatedAt,
      detail,
    }), { merge: true });

  return detail;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stripUndefinedDeep(entryValue)]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}

function trimText(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars).trimEnd()}...`;
}

function sanitizeTimelineEvents(
  events: unknown,
  limitCount: number
): Array<{
  id?: string;
  title: string;
  summary?: string;
  timestamp: string;
  source_name?: string;
  url?: string;
  signal_type?: string;
}> | undefined {
  if (!Array.isArray(events) || events.length === 0) return undefined;

  return events
    .slice(0, limitCount)
    .map((event) => {
      if (!event || typeof event !== 'object') return null;
      const entry = event as Record<string, unknown>;
      const title = typeof entry.title === 'string' ? entry.title : '';
      const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : '';
      if (!title || !timestamp) return null;
      return {
        id: typeof entry.id === 'string' ? entry.id : undefined,
        title,
        summary: trimText(entry.summary, 220),
        timestamp,
        source_name: typeof entry.source_name === 'string' ? entry.source_name : undefined,
        url: typeof entry.url === 'string' ? entry.url : undefined,
        signal_type: typeof entry.signal_type === 'string' ? entry.signal_type : undefined,
      };
    })
    .filter((event): event is NonNullable<typeof event> => Boolean(event));
}

function sanitizeTopicTimeline(events: unknown): TopicTimelineEvent[] | undefined {
  if (!Array.isArray(events) || events.length === 0) return undefined;

  const sanitized: TopicTimelineEvent[] = [];

  for (const event of events.slice(0, MAX_TOPIC_TIMELINE)) {
    if (!event || typeof event !== 'object') continue;
    const entry = event as Record<string, unknown>;
    const id = typeof entry.id === 'string' ? entry.id : '';
    const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : '';
    const title = typeof entry.title === 'string' ? entry.title : '';
    if (!id || !timestamp || !title) continue;
    sanitized.push({
      id,
      timestamp,
      title,
      summary: trimText(entry.summary, 220) || '',
      source_name: typeof entry.source_name === 'string' ? entry.source_name : undefined,
      source_url: typeof entry.source_url === 'string' ? entry.source_url : undefined,
      article_url: typeof entry.article_url === 'string' ? entry.article_url : undefined,
    });
  }

  return sanitized;
}

function sanitizeFeedItem(item: FeedItem): FeedItem {
  const shortArticle = item.summary?.short_article;

  return {
    ...item,
    summary: item.summary
      ? {
          short_article: shortArticle
            ? {
                subtitle: trimText(shortArticle.subtitle, MAX_SUMMARY_SUBTITLE_CHARS),
                body: trimText(shortArticle.body, MAX_SUMMARY_BODY_CHARS),
                key_takeaways: Array.isArray(shortArticle.key_takeaways)
                  ? shortArticle.key_takeaways
                      .filter((point): point is string => typeof point === 'string' && point.trim().length > 0)
                      .slice(0, MAX_KEY_TAKEAWAYS)
                  : undefined,
                why_it_matters: trimText(shortArticle.why_it_matters, MAX_WHY_IT_MATTERS_CHARS),
              }
            : undefined,
          reading_time_minutes: item.summary.reading_time_minutes,
        }
      : undefined,
    sources: Array.isArray(item.sources)
      ? item.sources
          .slice(0, MAX_SOURCES)
          .filter((source): source is NonNullable<typeof source> => Boolean(source))
          .map((source) => ({
            name: typeof source.name === 'string' ? source.name : '',
            title: typeof source.title === 'string' ? source.title : '',
            url: typeof source.url === 'string' ? source.url : '',
          }))
      : undefined,
    signals: sanitizeTimelineEvents(item.signals, MAX_SIGNALS),
    timeline: sanitizeTimelineEvents(item.timeline, MAX_SIGNALS),
  };
}

function sanitizeTrendingTopic(topic: TrendingTopic): TrendingTopic {
  return {
    ...topic,
    summary: trimText(topic.summary, 700) || '',
    key_points: Array.isArray(topic.key_points)
      ? topic.key_points
          .filter((point): point is string => typeof point === 'string' && point.trim().length > 0)
          .slice(0, MAX_KEY_TAKEAWAYS)
      : undefined,
    timeline: sanitizeTopicTimeline(topic.timeline),
    articles: Array.isArray(topic.articles)
      ? topic.articles.slice(0, MAX_TOPIC_ARTICLES).map(sanitizeFeedItem)
      : undefined,
  };
}

function mergeDailyPulseBucket(
  existing: { tools: FeedItem[]; blogs: FeedItem[]; discussions: FeedItem[] } | undefined,
  incoming: DocData | null | undefined,
): { tools: FeedItem[]; blogs: FeedItem[]; discussions: FeedItem[] } | undefined {
  if (!incoming || typeof incoming !== 'object') return existing;
  const next = {
    tools: Array.isArray(incoming.tools) ? (incoming.tools as FeedItem[]) : [],
    blogs: Array.isArray(incoming.blogs) ? (incoming.blogs as FeedItem[]) : [],
    discussions: Array.isArray(incoming.discussions) ? (incoming.discussions as FeedItem[]) : [],
  };
  if (!existing) {
    if (next.tools.length === 0 && next.blogs.length === 0 && next.discussions.length === 0) {
      return undefined;
    }
    return next;
  }
  return {
    tools: dedupeTrendingItems([...existing.tools, ...next.tools]),
    blogs: dedupeTrendingItems([...existing.blogs, ...next.blogs]),
    discussions: dedupeTrendingItems([...existing.discussions, ...next.discussions]),
  };
}

function sanitizePulseBucket(
  bucket: { tools: FeedItem[]; blogs: FeedItem[]; discussions: FeedItem[] } | undefined
) {
  if (!bucket) return undefined;
  return {
    tools: bucket.tools.map(sanitizeFeedItem),
    blogs: bucket.blogs.map(sanitizeFeedItem),
    discussions: bucket.discussions.map(sanitizeFeedItem),
  };
}

function dedupeTrendingItems(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const item of items) {
    const key = String(item?.url || item?.id || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupeTrendingTopics(topics: TrendingTopic[]): TrendingTopic[] {
  const seen = new Set<string>();
  const out: TrendingTopic[] = [];
  for (const topic of topics) {
    const key = String(topic?.id || topic?.topic_key || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(topic);
  }
  return out;
}

async function getViewerContext(uid: string, roleFromQuery = '') {
  if (!adminFirestore) {
    throw new Error('Server configuration error');
  }

  const userProfileSnapshot = await adminFirestore.collection('user_profiles').doc(uid).get();
  const userProfile = userProfileSnapshot.exists
    ? (userProfileSnapshot.data() as DocData)
    : null;
  const roleFromProfile = typeof userProfile?.role === 'string' ? userProfile.role : '';
  const normalizedRole = normalizeFeedRole(roleFromQuery || roleFromProfile);
  const viewerInterests = Array.isArray(userProfile?.interests)
    ? userProfile.interests.filter(
        (interest): interest is string => typeof interest === 'string' && interest.trim().length > 0
      )
    : [];
  const viewerProfile = buildViewerProfile(userProfile, roleFromProfile, viewerInterests);

  return {
    userProfile,
    roleFromProfile,
    normalizedRole,
    viewerInterests,
    viewerProfile,
  };
}

async function buildFullFeedBody(normalizedRole: string): Promise<FeedBody | null> {
  if (!adminFirestore) {
    throw new Error('Server configuration error');
  }

  const globalSnapshot = await adminFirestore
    .collection('v3_user_feeds')
    .doc('_global')
    .collection('daily')
    .orderBy('__name__', 'desc')
    .limit(GLOBAL_FEED_LOOKBACK_DOCS)
    .get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let trending: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let trendingTopics: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let roleBasedForYou: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pulse: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dailyPulse: { tools: any[]; blogs: any[]; discussions: any[] } | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let communityPulse: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let buildPulse: any[] = [];
  let feedDate = '';
  let assembledAt: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let metadata: any;

  if (!globalSnapshot.empty) {
    for (const globalDoc of globalSnapshot.docs) {
      const globalData = globalDoc.data();
      if (!feedDate) feedDate = globalData.date || globalDoc.id;
      if (!assembledAt && typeof globalData.assembled_at === 'string') assembledAt = globalData.assembled_at;
      if (!metadata && globalData.metadata) metadata = globalData.metadata;
      const candidateTrending = Array.isArray(globalData.trending) ? globalData.trending : [];
      const candidateTopics = Array.isArray(globalData.trending_topics) ? globalData.trending_topics : [];
      const buckets = extractRoleBuckets(globalData, normalizedRole);

      if (roleBasedForYou.length === 0 && buckets.roleFeed.length > 0) roleBasedForYou = buckets.roleFeed;
      if (pulse.length === 0 && buckets.pulseFeed.length > 0) pulse = buckets.pulseFeed;
      if (!dailyPulse && buckets.dailyPulseBucket) {
        const dp = buckets.dailyPulseBucket;
        dailyPulse = {
          tools: Array.isArray(dp.tools) ? dp.tools : [],
          blogs: Array.isArray(dp.blogs) ? dp.blogs : [],
          discussions: Array.isArray(dp.discussions) ? dp.discussions : [],
        };
      }
      if (communityPulse.length === 0 && buckets.communityFeed.length > 0) communityPulse = buckets.communityFeed;
      if (buildPulse.length === 0 && buckets.buildFeed.length > 0) buildPulse = buckets.buildFeed;
      if (candidateTrending.length > 0 || candidateTopics.length > 0) {
        if (trending.length === 0) {
          trending = candidateTrending;
          trendingTopics = candidateTopics;
        }
        if (dailyPulse) break;
      }
    }

    if (trending.length === 0 && trendingTopics.length === 0) {
      const latestGlobalData = globalSnapshot.docs[0].data();
      trending = Array.isArray(latestGlobalData.trending) ? latestGlobalData.trending : [];
      trendingTopics = Array.isArray(latestGlobalData.trending_topics) ? latestGlobalData.trending_topics : [];
      const buckets = extractRoleBuckets(latestGlobalData, normalizedRole);

      if (roleBasedForYou.length === 0 && buckets.roleFeed.length > 0) roleBasedForYou = buckets.roleFeed;
      if (pulse.length === 0 && buckets.pulseFeed.length > 0) pulse = buckets.pulseFeed;
      if (!dailyPulse && buckets.dailyPulseBucket) {
        const dp = buckets.dailyPulseBucket;
        dailyPulse = {
          tools: Array.isArray(dp.tools) ? dp.tools : [],
          blogs: Array.isArray(dp.blogs) ? dp.blogs : [],
          discussions: Array.isArray(dp.discussions) ? dp.discussions : [],
        };
      }
      if (communityPulse.length === 0 && buckets.communityFeed.length > 0) communityPulse = buckets.communityFeed;
      if (buildPulse.length === 0 && buckets.buildFeed.length > 0) buildPulse = buckets.buildFeed;
    }

    // Match mobile behavior: merge previous daily global snapshot too.
    if (globalSnapshot.docs.length > 1) {
      for (let docIndex = 1; docIndex < globalSnapshot.docs.length; docIndex++) {
        const previousGlobalData = globalSnapshot.docs[docIndex].data();
        const previousTrending = Array.isArray(previousGlobalData.trending)
          ? previousGlobalData.trending
          : [];
        const previousTopics = Array.isArray(previousGlobalData.trending_topics)
          ? previousGlobalData.trending_topics
          : [];
        if (docIndex === 1) {
          trending = dedupeTrendingItems([...(trending as FeedItem[]), ...(previousTrending as FeedItem[])]);
          trendingTopics = dedupeTrendingTopics([...(trendingTopics as TrendingTopic[]), ...(previousTopics as TrendingTopic[])]);
        }

        const previousBuckets = extractRoleBuckets(previousGlobalData, normalizedRole);
        dailyPulse = mergeDailyPulseBucket(dailyPulse, previousBuckets.dailyPulseBucket);
        communityPulse = dedupeTrendingItems([
          ...(communityPulse as FeedItem[]),
          ...(previousBuckets.communityFeed as FeedItem[]),
        ]);
        buildPulse = dedupeTrendingItems([
          ...(buildPulse as FeedItem[]),
          ...(previousBuckets.buildFeed as FeedItem[]),
        ]);
        pulse = dedupeTrendingItems([
          ...(pulse as FeedItem[]),
          ...(previousBuckets.pulseFeed as FeedItem[]),
        ]);
      }
    }
  }

  const forYou = roleBasedForYou;

  if (
    forYou.length === 0 &&
    trending.length === 0 &&
    trendingTopics.length === 0 &&
    pulse.length === 0 &&
    !dailyPulse &&
    communityPulse.length === 0 &&
    buildPulse.length === 0
  ) {
    return null;
  }

  const body: FeedBody = {
    date: feedDate,
    for_you: forYou.map(sanitizeFeedItem),
    pulse: pulse.map(sanitizeFeedItem),
    daily_pulse: sanitizePulseBucket(dailyPulse),
    community_pulse: communityPulse.map(sanitizeFeedItem),
    build_pulse: buildPulse.map(sanitizeFeedItem),
    trending: trending.map(sanitizeFeedItem),
    trending_topics: trendingTopics.map(sanitizeTrendingTopic),
    assembled_at: assembledAt,
    metadata,
  };

  return applyFeedDedupe(body);
}

// In-memory dedupe for background rebuilds. If several concurrent requests
// all see the same stale entry, only one fires the rebuild.
const inflightRebuilds = new Map<string, Promise<FeedBody | null>>();

async function rebuildAndCacheFullFeed(normalizedRole: string): Promise<FeedBody | null> {
  if (!adminFirestore) return null;
  const cacheRef = adminFirestore
    .collection(WEB_FULL_FEED_CACHE_COLLECTION)
    .doc(getFullFeedCacheDocId(normalizedRole));
  const feed = await buildFullFeedBody(normalizedRole);
  if (!feed) return null;
  const generatedAt = new Date().toISOString();
  await cacheRef.set(stripUndefinedDeep({
    version: WEB_FULL_FEED_CACHE_VERSION,
    role: normalizedRole || 'developer',
    date: feed.date,
    assembled_at: feed.assembled_at || null,
    generated_at: generatedAt,
    feed,
  }), { merge: true });
  void writeItemDetailCacheForRole(normalizedRole, feed, generatedAt).catch((error) => {
    console.error('[feed-server] item-detail cache write failed:', error);
  });
  return feed;
}

async function getFullFeedBodyForRole(normalizedRole: string): Promise<FeedBody | null> {
  if (!adminFirestore) {
    throw new Error('Server configuration error');
  }

  const cacheRef = adminFirestore
    .collection(WEB_FULL_FEED_CACHE_COLLECTION)
    .doc(getFullFeedCacheDocId(normalizedRole));

  try {
    const readStart = Date.now();
    const cacheSnapshot = await cacheRef.get();
    const readMs = Date.now() - readStart;
    if (cacheSnapshot.exists) {
      const cacheData = cacheSnapshot.data() as {
        version?: number;
        generated_at?: string;
        feed?: FeedBody;
      } | undefined;
      if (cacheData?.version === WEB_FULL_FEED_CACHE_VERSION && cacheData.feed) {
        const isFresh = isFreshIsoTimestamp(cacheData.generated_at, WEB_FULL_FEED_CACHE_TTL_MS);
        try {
          const feedBytes = Buffer.byteLength(JSON.stringify(cacheData.feed), 'utf8');
          const f = cacheData.feed;
          console.log(
            `[perf][feed-server] cache ${isFresh ? 'HIT' : 'STALE-SERVE'} role=${normalizedRole} `
            + `firestore_read_ms=${readMs} `
            + `feed_kb=${(feedBytes / 1024).toFixed(1)} `
            + `for_you=${f.for_you?.length ?? 0} `
            + `trending=${f.trending?.length ?? 0} `
            + `pulse=${f.pulse?.length ?? 0} `
            + `topics=${f.trending_topics?.length ?? 0}`
          );
        } catch {}
        // Past fresh window: rebuild on the request path so /feed always gets
        // today's edition instead of silently serving stale while rebuilding.
        if (!isFresh) {
          const existing = inflightRebuilds.get(normalizedRole);
          const rebuildPromise = existing ?? (() => {
            const promise = rebuildAndCacheFullFeed(normalizedRole).finally(() => {
              inflightRebuilds.delete(normalizedRole);
            });
            inflightRebuilds.set(normalizedRole, promise);
            return promise;
          })();
          try {
            const rebuilt = await rebuildPromise;
            if (rebuilt) return rebuilt;
          } catch (error) {
            console.error('[feed-server] stale cache rebuild failed:', error);
          }
        }
        void writeItemDetailCacheForRole(
          normalizedRole,
          cacheData.feed,
          cacheData.generated_at || new Date().toISOString()
        ).catch((error) => {
          console.error('[feed-server] item-detail cache write failed:', error);
        });
        return cacheData.feed;
      }
      console.log(`[perf][feed-server] cache VERSION-MISS role=${normalizedRole} firestore_read_ms=${readMs}`);
    } else {
      console.log(`[perf][feed-server] cache MISS role=${normalizedRole} firestore_read_ms=${readMs}`);
    }
  } catch (error) {
    console.error('[feed-server] full-feed cache read failed:', error);
  }

  // Cold path: no usable cache. Rebuild on the critical path as a fallback,
  // but dedupe so concurrent requests share one rebuild.
  const coldStart = Date.now();
  const existing = inflightRebuilds.get(normalizedRole);
  if (existing) {
    return existing;
  }
  const promise = rebuildAndCacheFullFeed(normalizedRole)
    .finally(() => {
      inflightRebuilds.delete(normalizedRole);
    });
  inflightRebuilds.set(normalizedRole, promise);
  const feed = await promise;
  console.log(`[perf][feed-server] cold rebuild role=${normalizedRole} ms=${Date.now() - coldStart}`);
  return feed;
}

export async function getFeedForUid(uid: string, roleFromQuery = ''): Promise<V3UserFeed | null> {
  const viewerContext = await getViewerContext(uid, roleFromQuery);
  const feed = await getFullFeedBodyForRole(viewerContext.normalizedRole);
  if (!feed) return null;

  return {
    ...feed,
    viewer_profile: viewerContext.viewerProfile,
  };
}

export async function getPublicBootstrapFeed(roleFromQuery = 'developer'): Promise<V3UserFeed | null> {
  const totalStart = Date.now();
  const normalizedRole = normalizeFeedRole(roleFromQuery || 'developer');
  const feed = await getFullFeedBodyForRole(normalizedRole);
  if (!feed) {
    console.log(`[perf][feed-server] getPublicBootstrapFeed role=${normalizedRole} result=null total_ms=${Date.now() - totalStart}`);
    return null;
  }

  const result = {
    ...feed,
    viewer_profile: {
      role: normalizedRole || 'developer',
      interests: [...GUEST_FEED_INTERESTS],
      onboarded: true,
      subscription_status: 'none',
      app_subscription_status: 'none',
      has_access: false,
    },
  };
  console.log(`[perf][feed-server] getPublicBootstrapFeed role=${normalizedRole} total_ms=${Date.now() - totalStart}`);
  return result;
}

// Fast path: viewer_profile comes pre-built (typically from the session cookie)
// so we can skip the getViewerContext Firestore round-trip entirely. This is
// what the /feed page SSR uses when the cookie carries profile data.
export async function getBootstrapFeedFromProfile(
  rawRole: string,
  viewerProfile: V3UserFeed['viewer_profile'],
): Promise<V3UserFeed | null> {
  const totalStart = Date.now();
  const normalizedRole = normalizeFeedRole(rawRole || 'developer');
  const feed = await getFullFeedBodyForRole(normalizedRole);
  if (!feed) {
    console.log(`[perf][feed-server] getBootstrapFeedFromProfile role=${normalizedRole} result=null total_ms=${Date.now() - totalStart}`);
    return null;
  }
  const result: V3UserFeed = { ...feed, viewer_profile: viewerProfile };
  try {
    const resultBytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
    console.log(
      `[perf][feed-server] getBootstrapFeedFromProfile role=${normalizedRole} `
      + `total_ms=${Date.now() - totalStart} `
      + `response_kb=${(resultBytes / 1024).toFixed(1)}`
    );
  } catch {
    console.log(`[perf][feed-server] getBootstrapFeedFromProfile role=${normalizedRole} total_ms=${Date.now() - totalStart}`);
  }
  return result;
}

// Legacy fallback path — used only when the session cookie is an old version
// that doesn't carry profile data. Within ~1 hour all callers migrate to the
// fast path via onIdTokenChanged cookie refresh.
//
// Optimization: fire the 'developer' (most common) role-cache read in parallel
// with the user-profile read. If the viewer turns out to be a different role
// we do a second cache read, but for ~90% of users we've hidden the profile
// read latency entirely.
export async function getBootstrapFeedForUid(uid: string, roleFromQuery = ''): Promise<V3UserFeed | null> {
  if (!adminFirestore) {
    throw new Error('Server configuration error');
  }

  const totalStart = Date.now();

  const viewerStart = Date.now();
  const viewerContextPromise = getViewerContext(uid, roleFromQuery).then((ctx) => {
    console.log(`[perf][feed-server] getViewerContext uid=${uid.slice(0, 6)} total_ms=${Date.now() - viewerStart}`);
    return ctx;
  });

  const earlyRole = roleFromQuery ? normalizeFeedRole(roleFromQuery) : 'developer';
  const speculativeFeedPromise = getFullFeedBodyForRole(earlyRole);

  const viewerContext = await viewerContextPromise;
  let feed: FeedBody | null;
  if (viewerContext.normalizedRole === earlyRole) {
    feed = await speculativeFeedPromise;
  } else {
    // Role didn't match our guess. Start the correct fetch; we can ignore the
    // speculative one (it'll settle in the background and populate its cache).
    console.log(
      `[perf][feed-server] speculative role miss guess=${earlyRole} actual=${viewerContext.normalizedRole}`
    );
    feed = await getFullFeedBodyForRole(viewerContext.normalizedRole);
    void speculativeFeedPromise.catch(() => {});
  }

  if (!feed) {
    console.log(`[perf][feed-server] getBootstrapFeedForUid uid=${uid.slice(0, 6)} result=null total_ms=${Date.now() - totalStart}`);
    return null;
  }

  const result = {
    ...feed,
    viewer_profile: viewerContext.viewerProfile,
  };

  try {
    const resultBytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
    console.log(
      `[perf][feed-server] getBootstrapFeedForUid uid=${uid.slice(0, 6)} `
      + `role=${viewerContext.normalizedRole} `
      + `total_ms=${Date.now() - totalStart} `
      + `response_kb=${(resultBytes / 1024).toFixed(1)}`
    );
  } catch {
    console.log(`[perf][feed-server] getBootstrapFeedForUid uid=${uid.slice(0, 6)} total_ms=${Date.now() - totalStart}`);
  }

  return result;
}

export async function getPulseFeedForUid(uid: string, roleFromQuery = ''): Promise<Pick<
  V3UserFeed,
  'pulse' | 'daily_pulse' | 'community_pulse' | 'build_pulse'
> | null> {
  const feed = await getFeedForUid(uid, roleFromQuery);
  if (!feed) return null;

  return {
    pulse: feed.pulse ?? [],
    daily_pulse: feed.daily_pulse,
    community_pulse: feed.community_pulse ?? [],
    build_pulse: feed.build_pulse ?? [],
  };
}

export async function getFeedItemDetailForUid(
  uid: string,
  itemId: string,
  roleFromQuery = ''
): Promise<FeedItemDetailResponse | null> {
  const viewerContext = await getViewerContext(uid, roleFromQuery);

  const cached = await readFeedItemDetailFromCache(viewerContext.normalizedRole, itemId);
  if (cached) return cached;

  return hydrateFeedItemDetailFromFullCache(viewerContext.normalizedRole, itemId);
}
