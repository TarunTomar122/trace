import { adminFirestore } from '@/lib/firebase-admin';
import type { FeedItem, TopicTimelineEvent, TrendingTopic, V3UserFeed } from '@/lib/firestore';

const GLOBAL_FEED_LOOKBACK_DOCS = 2;
const WEB_BOOTSTRAP_CACHE_COLLECTION = 'web_feed_bootstrap_cache';
const WEB_FULL_FEED_CACHE_COLLECTION = 'web_feed_full_cache';
const WEB_BOOTSTRAP_CACHE_TTL_MS = 10 * 60 * 1000;
const WEB_FULL_FEED_CACHE_TTL_MS = 10 * 60 * 1000;
const WEB_BOOTSTRAP_CACHE_VERSION = 3;
const WEB_FULL_FEED_CACHE_VERSION = 1;
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

function getBootstrapCacheDocId(normalizedRole: string) {
  return `latest_${normalizedRole || 'developer'}`;
}

function getFullFeedCacheDocId(normalizedRole: string) {
  return `latest_${normalizedRole || 'developer'}`;
}

function isFreshIsoTimestamp(value: unknown, ttlMs: number) {
  if (typeof value !== 'string') return false;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < ttlMs;
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

/** Card-only projection of a FeedItem — strips body, takeaways, signals, timeline, sources. */
function slimFeedItem(item: FeedItem): FeedItem {
  return {
    id: item.id,
    type: item.type,
    source: item.source,
    source_name: item.source_name,
    title: item.title,
    url: item.url,
    thumbnail: item.thumbnail,
    interest_id: item.interest_id,
    tags: item.tags,
    feed_type: item.feed_type,
    published_date: item.published_date,
    published_at: item.published_at,
    metadata: item.metadata,
    summary: item.summary
      ? {
          short_article: item.summary.short_article
            ? { subtitle: item.summary.short_article.subtitle }
            : undefined,
          reading_time_minutes: item.summary.reading_time_minutes,
        }
      : undefined,
  };
}

/** Card-only projection of a TrendingTopic — keeps first article (slim) for singleton display. */
function slimTrendingTopic(topic: TrendingTopic): TrendingTopic {
  return {
    id: topic.id,
    topic_key: topic.topic_key,
    title: topic.title,
    summary: trimText(topic.summary, 200) || '',
    interest_id: topic.interest_id,
    tags: topic.tags,
    thumbnail: topic.thumbnail,
    is_featured: topic.is_featured,
    popularity_score: topic.popularity_score,
    article_count: topic.article_count,
    source_count: topic.source_count,
    first_seen_at: topic.first_seen_at,
    articles: topic.articles?.slice(0, 1).map(slimFeedItem),
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

  return {
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
}

async function getFullFeedBodyForRole(normalizedRole: string): Promise<FeedBody | null> {
  if (!adminFirestore) {
    throw new Error('Server configuration error');
  }

  const cacheRef = adminFirestore
    .collection(WEB_FULL_FEED_CACHE_COLLECTION)
    .doc(getFullFeedCacheDocId(normalizedRole));

  try {
    const cacheSnapshot = await cacheRef.get();
    if (cacheSnapshot.exists) {
      const cacheData = cacheSnapshot.data() as {
        version?: number;
        generated_at?: string;
        feed?: FeedBody;
      } | undefined;
      if (
        cacheData?.version === WEB_FULL_FEED_CACHE_VERSION &&
        cacheData.feed &&
        isFreshIsoTimestamp(cacheData.generated_at, WEB_FULL_FEED_CACHE_TTL_MS)
      ) {
        return cacheData.feed;
      }
    }
  } catch (error) {
    console.error('[feed-server] full-feed cache read failed:', error);
  }

  const feed = await buildFullFeedBody(normalizedRole);
  if (!feed) return null;

  void cacheRef.set(stripUndefinedDeep({
    version: WEB_FULL_FEED_CACHE_VERSION,
    role: normalizedRole || 'developer',
    date: feed.date,
    assembled_at: feed.assembled_at || null,
    generated_at: new Date().toISOString(),
    feed,
  }), { merge: true }).catch((error) => {
    console.error('[feed-server] full-feed cache write failed:', error);
  });

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

export async function getBootstrapFeedForUid(uid: string, roleFromQuery = ''): Promise<V3UserFeed | null> {
  if (!adminFirestore) {
    throw new Error('Server configuration error');
  }

  const viewerContext = await getViewerContext(uid, roleFromQuery);

  const cacheRef = adminFirestore
    .collection(WEB_BOOTSTRAP_CACHE_COLLECTION)
    .doc(getBootstrapCacheDocId(viewerContext.normalizedRole));

  try {
    const cacheSnapshot = await cacheRef.get();
    if (cacheSnapshot.exists) {
      const cacheData = cacheSnapshot.data() as {
        version?: number;
        generated_at?: string;
        feed?: Omit<V3UserFeed, 'viewer_profile'>;
      } | undefined;
      if (
        cacheData?.version === WEB_BOOTSTRAP_CACHE_VERSION &&
        cacheData.feed &&
        isFreshIsoTimestamp(cacheData.generated_at, WEB_BOOTSTRAP_CACHE_TTL_MS)
      ) {
        return {
          ...cacheData.feed,
          viewer_profile: viewerContext.viewerProfile,
        };
      }
    }
  } catch (error) {
    console.error('[feed-server] bootstrap cache read failed:', error);
  }

  const feed = await getFullFeedBodyForRole(viewerContext.normalizedRole);
  if (!feed) return null;

  // Keep the first few items fully hydrated so the initially-visible article
  // renders instantly; slim the rest to cut payload size.
  const INLINE_FULL_COUNT = 3;

  const bootstrapFeed: Omit<V3UserFeed, 'viewer_profile'> = {
    ...feed,
    for_you: feed.for_you.map((item, i) => i < INLINE_FULL_COUNT ? sanitizeFeedItem(item) : slimFeedItem(item)),
    trending: feed.trending.map(slimFeedItem),
    trending_topics: feed.trending_topics?.map((topic, i) => i < INLINE_FULL_COUNT ? sanitizeTrendingTopic(topic) : slimTrendingTopic(topic)),
    pulse: [],
    daily_pulse: undefined,
    community_pulse: [],
    build_pulse: [],
  };

  void cacheRef.set(stripUndefinedDeep({
    version: WEB_BOOTSTRAP_CACHE_VERSION,
    role: viewerContext.normalizedRole || 'developer',
    date: bootstrapFeed.date,
    assembled_at: bootstrapFeed.assembled_at || null,
    generated_at: new Date().toISOString(),
    feed: bootstrapFeed,
  }), { merge: true }).catch((error) => {
    console.error('[feed-server] bootstrap cache write failed:', error);
  });

  return {
    ...bootstrapFeed,
    viewer_profile: viewerContext.viewerProfile,
  };
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
): Promise<{ kind: 'article'; item: FeedItem } | { kind: 'topic'; item: TrendingTopic } | null> {
  const feed = await getFeedForUid(uid, roleFromQuery);
  if (!feed) return null;

  const topic = feed.trending_topics?.find((entry) => entry.id === itemId);
  if (topic) {
    return { kind: 'topic', item: topic };
  }

  const articleGroups: FeedItem[][] = [
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
