import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { TRACE_SESSION_COOKIE_NAME, verifyTraceSession } from '@/lib/server-session';

const GLOBAL_FEED_LOOKBACK_DOCS = 2;

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

function extractRoleBuckets(globalData: DocData, normalizedRole: string) {
  const roleMap = globalData.for_you_roles && typeof globalData.for_you_roles === 'object'
    ? globalData.for_you_roles : null;
  const pulseRoleMap = globalData.pulse_roles && typeof globalData.pulse_roles === 'object'
    ? globalData.pulse_roles : null;
  const dailyPulseRoleMap = globalData.daily_pulse_roles && typeof globalData.daily_pulse_roles === 'object'
    ? globalData.daily_pulse_roles : null;
  const weeklyPulseRoleMap = globalData.weekly_pulse_roles && typeof globalData.weekly_pulse_roles === 'object'
    ? globalData.weekly_pulse_roles : null;
  const communityRoleMap = globalData.community_pulse_roles && typeof globalData.community_pulse_roles === 'object'
    ? globalData.community_pulse_roles : null;
  const buildRoleMap = globalData.build_pulse_roles && typeof globalData.build_pulse_roles === 'object'
    ? globalData.build_pulse_roles : null;

  const roleFeed = normalizedRole && roleMap && Array.isArray(roleMap[normalizedRole])
    ? roleMap[normalizedRole] : [];
  const pulseFeed = normalizedRole && pulseRoleMap && Array.isArray(pulseRoleMap[normalizedRole])
    ? pulseRoleMap[normalizedRole] : [];

  const _dailyBucket = normalizedRole && dailyPulseRoleMap?.[normalizedRole] && typeof dailyPulseRoleMap[normalizedRole] === 'object'
    ? dailyPulseRoleMap[normalizedRole]
    : normalizedRole && weeklyPulseRoleMap?.[normalizedRole] && typeof weeklyPulseRoleMap[normalizedRole] === 'object'
      ? weeklyPulseRoleMap[normalizedRole]
      : null;

  const communityFeed = normalizedRole && communityRoleMap && Array.isArray(communityRoleMap[normalizedRole])
    ? communityRoleMap[normalizedRole] : [];
  const buildFeed = normalizedRole && buildRoleMap && Array.isArray(buildRoleMap[normalizedRole])
    ? buildRoleMap[normalizedRole] : [];

  return { roleFeed, pulseFeed, dailyPulseBucket: _dailyBucket, communityFeed, buildFeed };
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

  // Mirror /api/subscription/status cancellation window behavior.
  if (hasAccess && profile?.cancelledAt) {
    const cancelDate = toDateMaybe(profile.willCancelAt) || toDateMaybe(profile.nextBillingDate);
    if (cancelDate && new Date() >= cancelDate) {
      hasAccess = false;
    }
  }

  return { webSub, appSub, hasAccess };
}

export async function GET(request: NextRequest) {
  const requestStartedAt = performance.now();
  let authDoneAt = requestStartedAt;
  let readsDoneAt = requestStartedAt;
  let assembledDoneAt = requestStartedAt;
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    const sessionCookie = request.cookies.get(TRACE_SESSION_COOKIE_NAME)?.value;

    let uid = '';
    if (sessionCookie) {
      const decodedSession = verifyTraceSession(sessionCookie);
      if (decodedSession) {
        uid = decodedSession.uid;
      }
    } else if (authHeader?.startsWith('Bearer ')) {
      if (!adminAuth) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await adminAuth.verifyIdToken(token);
      uid = decodedToken.uid;
    }

    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    authDoneAt = performance.now();

    const roleFromQuery = request.nextUrl.searchParams.get('role') || '';

    // Fetch the viewer profile and latest global feed docs. The web feed page
    // no longer consumes legacy per-user feed sections like for_you/deep_dives.
    const userProfileRef = adminFirestore.collection('user_profiles').doc(uid);
    const globalFeedRef = adminFirestore.collection('v3_user_feeds').doc('_global').collection('daily');

    const [userProfileSnapshot, globalSnapshot] = await Promise.all([
      userProfileRef.get(),
      globalFeedRef.orderBy('__name__', 'desc').limit(GLOBAL_FEED_LOOKBACK_DOCS).get(),
    ]);
    readsDoneAt = performance.now();

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
    const { webSub, appSub, hasAccess } = computeFeedAccess(userProfile);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    let weeklyPulse: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let communityPulse: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let buildPulse: any[] = [];
    let feedDate = '';
    let assembledAt: string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let metadata: any;

    // Process global feed docs
    if (!globalSnapshot.empty) {
      for (const globalDoc of globalSnapshot.docs) {
        const globalData = globalDoc.data();
        if (!feedDate) feedDate = globalData.date || globalDoc.id;
        if (!assembledAt && typeof globalData.assembled_at === 'string') assembledAt = globalData.assembled_at;
        if (!metadata && globalData.metadata) metadata = globalData.metadata;
        const candidateTrending = Array.isArray(globalData.trending) ? globalData.trending : [];
        const candidateTopics = Array.isArray(globalData.trending_topics) ? globalData.trending_topics : [];
        const buckets = extractRoleBuckets(globalData, normalizedRole);

        if (roleBasedForYou.length === 0 && buckets.roleFeed.length > 0) {
          roleBasedForYou = buckets.roleFeed;
          if (!feedDate) feedDate = globalData.date || globalDoc.id;
        }
        if (pulse.length === 0 && buckets.pulseFeed.length > 0) {
          pulse = buckets.pulseFeed;
          if (!feedDate) feedDate = globalData.date || globalDoc.id;
        }
        if (!dailyPulse && buckets.dailyPulseBucket) {
          const dp = buckets.dailyPulseBucket;
          dailyPulse = {
            tools: Array.isArray(dp.tools) ? dp.tools : [],
            blogs: Array.isArray(dp.blogs) ? dp.blogs : [],
            discussions: Array.isArray(dp.discussions) ? dp.discussions : [],
          };
          if (!feedDate) feedDate = globalData.date || globalDoc.id;
        }
        if (communityPulse.length === 0 && buckets.communityFeed.length > 0) {
          communityPulse = buckets.communityFeed;
          if (!feedDate) feedDate = globalData.date || globalDoc.id;
        }
        if (buildPulse.length === 0 && buckets.buildFeed.length > 0) {
          buildPulse = buckets.buildFeed;
          if (!feedDate) feedDate = globalData.date || globalDoc.id;
        }
        if (candidateTrending.length > 0 || candidateTopics.length > 0) {
          if (trending.length === 0) {
            trending = candidateTrending;
            trendingTopics = candidateTopics;
          }
          if (dailyPulse) break;
        }
      }

      // Fallback: if all global docs inspected are empty
      if (trending.length === 0 && trendingTopics.length === 0) {
        const latestGlobalData = globalSnapshot.docs[0].data();
        trending = Array.isArray(latestGlobalData.trending) ? latestGlobalData.trending : [];
        trendingTopics = Array.isArray(latestGlobalData.trending_topics) ? latestGlobalData.trending_topics : [];
        const buckets = extractRoleBuckets(latestGlobalData, normalizedRole);

        if (roleBasedForYou.length === 0 && buckets.roleFeed.length > 0) {
          roleBasedForYou = buckets.roleFeed;
          if (!feedDate) feedDate = latestGlobalData.date || globalSnapshot.docs[0].id;
        }
        if (pulse.length === 0 && buckets.pulseFeed.length > 0) {
          pulse = buckets.pulseFeed;
          if (!feedDate) feedDate = latestGlobalData.date || globalSnapshot.docs[0].id;
        }
        if (!dailyPulse && buckets.dailyPulseBucket) {
          const dp = buckets.dailyPulseBucket;
          dailyPulse = {
            tools: Array.isArray(dp.tools) ? dp.tools : [],
            blogs: Array.isArray(dp.blogs) ? dp.blogs : [],
            discussions: Array.isArray(dp.discussions) ? dp.discussions : [],
          };
          if (!feedDate) feedDate = latestGlobalData.date || globalSnapshot.docs[0].id;
        }
        if (communityPulse.length === 0 && buckets.communityFeed.length > 0) {
          communityPulse = buckets.communityFeed;
          if (!feedDate) feedDate = latestGlobalData.date || globalSnapshot.docs[0].id;
        }
        if (buildPulse.length === 0 && buckets.buildFeed.length > 0) {
          buildPulse = buckets.buildFeed;
          if (!feedDate) feedDate = latestGlobalData.date || globalSnapshot.docs[0].id;
        }
      }
    }

    const forYou = roleBasedForYou;
    const deepDives: any[] = [];
    const mergedFeed: any[] = [];

    if (forYou.length === 0 && trending.length === 0 && trendingTopics.length === 0 && pulse.length === 0 && !dailyPulse && communityPulse.length === 0 && buildPulse.length === 0) {
      return NextResponse.json(null);
    }

    const feed = {
      date: feedDate,
      for_you: forYou,
      pulse,
      daily_pulse: dailyPulse,
      weekly_pulse: weeklyPulse,
      deep_dives: deepDives,
      community_pulse: communityPulse,
      build_pulse: buildPulse,
      trending,
      trending_topics: trendingTopics,
      merged_feed: mergedFeed,
      assembled_at: assembledAt,
      metadata,
      viewer_profile: {
        role: roleFromProfile || undefined,
        interests: viewerInterests,
        onboarded: userProfile?.onboarded === true,
        subscription_status: webSub,
        app_subscription_status: appSub,
        has_access: hasAccess,
      },
    };
    assembledDoneAt = performance.now();

    const serverTiming = [
      `auth;dur=${(authDoneAt - requestStartedAt).toFixed(1)}`,
      `reads;dur=${(readsDoneAt - authDoneAt).toFixed(1)}`,
      `assemble;dur=${(assembledDoneAt - readsDoneAt).toFixed(1)}`,
      `total;dur=${(assembledDoneAt - requestStartedAt).toFixed(1)}`,
    ].join(', ');

    return NextResponse.json(feed, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        'Server-Timing': serverTiming,
      },
    });
  } catch (error) {
    console.error('[api/feed] Error:', error);
    if (error instanceof Error && error.message?.includes('auth')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
