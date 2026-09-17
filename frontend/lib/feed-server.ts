import { adminFirestore } from '@/lib/firebase-admin';
import { unstable_cache } from 'next/cache';
import { applyFeedDedupe } from '@/lib/feed-dedupe';
import { resolveHeadlines } from '@/lib/story-headlines';
import type { FeedItem, TopicTimelineEvent, TrendingTopic, V3UserFeed } from '@/lib/firestore';
import { hasActiveSubscription, subscriptionStatuses } from '@/lib/subscription-access';

/** Today + yesterday's global edition; pipeline handles source freshness. */
const GLOBAL_FEED_LOOKBACK_DOCS = 2;
const MAX_SUMMARY_BODY_CHARS = 2200;
const MAX_SUMMARY_SUBTITLE_CHARS = 280;
const MAX_WHY_IT_MATTERS_CHARS = 420;
const MAX_KEY_TAKEAWAYS = 4;
const MAX_SOURCES = 5;
const MAX_SIGNALS = 6;
const MAX_TOPIC_TIMELINE = 6;
const MAX_TOPIC_ARTICLES = 12;

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
  if (normalized === 'pm' || normalized === 'product manager' || normalized === 'product') {
    return 'pm';
  }
  if (normalized === 'investor' || normalized === 'vc' || normalized === 'venture capitalist') {
    return 'investor';
  }
  if (normalized === 'student' || normalized === 'learning') {
    return 'student';
  }
  if (normalized === 'reader' || normalized === 'just browsing') {
    return 'developer';
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

function computeFeedAccess(profile: DocData | null) {
  const { web: webSub, app: appSub } = subscriptionStatuses(profile);
  return { webSub, appSub, hasAccess: hasActiveSubscription(profile) };
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

async function buildFullFeedBodyUncached(normalizedRole: string): Promise<FeedBody | null> {
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
  let headlines: any[] = [];
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
          if (Array.isArray(globalData.headlines)) headlines = globalData.headlines;
        }
        if (dailyPulse) break;
      }
    }

    if (trending.length === 0 && trendingTopics.length === 0) {
      const latestGlobalData = globalSnapshot.docs[0].data();
      trending = Array.isArray(latestGlobalData.trending) ? latestGlobalData.trending : [];
      trendingTopics = Array.isArray(latestGlobalData.trending_topics) ? latestGlobalData.trending_topics : [];
      if (!headlines.length && Array.isArray(latestGlobalData.headlines)) {
        headlines = latestGlobalData.headlines;
      }
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
    headlines: resolveHeadlines(
      trendingTopics.map((topic) => ({ id: String(topic.id || ''), title: String(topic.title || '') })),
      headlines,
    ).map((headline) => ({
      id: headline.id,
      label: headline.label,
      topic_ids: headline.topicIds,
    })),
    assembled_at: assembledAt,
    metadata,
  };

  return applyFeedDedupe(body);
}

const getCachedFullFeedBody = unstable_cache(
  buildFullFeedBodyUncached,
  ['trace-global-daily-feed-v1'],
  { revalidate: 60, tags: ['trace-global-daily-feed'] },
);

async function buildFullFeedBody(normalizedRole: string): Promise<FeedBody | null> {
  return getCachedFullFeedBody(normalizedRole);
}

export async function getFeedForUid(uid: string, roleFromQuery = ''): Promise<V3UserFeed | null> {
  const viewerContext = await getViewerContext(uid, roleFromQuery);
  const feed = await buildFullFeedBody(viewerContext.normalizedRole);
  if (!feed) return null;

  return {
    ...feed,
    viewer_profile: viewerContext.viewerProfile,
  };
}

export async function getPublicBootstrapFeed(roleFromQuery = 'developer'): Promise<V3UserFeed | null> {
  const totalStart = Date.now();
  const normalizedRole = normalizeFeedRole(roleFromQuery || 'developer');
  const feed = await buildFullFeedBody(normalizedRole);
  if (!feed) {
    console.log(`[perf][feed-server] getPublicBootstrapFeed role=${normalizedRole} result=null total_ms=${Date.now() - totalStart}`);
    return null;
  }

  const result = {
    ...feed,
    viewer_profile: {
      role: normalizedRole || 'developer',
      interests: [],
      onboarded: false,
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
  const feed = await buildFullFeedBody(normalizedRole);
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

export async function getBootstrapFeedForUid(uid: string, roleFromQuery = ''): Promise<V3UserFeed | null> {
  if (!adminFirestore) {
    throw new Error('Server configuration error');
  }

  const totalStart = Date.now();
  const viewerContext = await getViewerContext(uid, roleFromQuery);
  const feed = await buildFullFeedBody(viewerContext.normalizedRole);
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
  const feed = await buildFullFeedBody(viewerContext.normalizedRole);
  if (!feed) return null;
  return findFeedItemDetailInFeed(feed, itemId);
}
