import { Suspense } from 'react';
import { cookies } from 'next/headers';
import {
  isTraceSessionProfileFresh,
  TRACE_SESSION_COOKIE_NAME,
  verifyTraceSession,
} from '@/lib/server-session';
import FeedBootShell from './FeedBootShell';
import EditionPrototype from '@/app/wip/feed-edition/EditionPrototype';

// Force dynamic so Next.js streams the response instead of trying to
// statically pre-render with cookies().
export const dynamic = 'force-dynamic';

const DEFAULT_GUEST_INTERESTS = ['ai', 'tech', 'startups', 'engineering', 'markets'];

async function FeedDataLoader({ view }: { view: 'edition' | 'pulse' }) {
  const loaderStart = Date.now();
  let initialFeed = null;
  let isPro = false;
  let path: 'fast' | 'legacy' | 'public' | 'none' = 'none';

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(TRACE_SESSION_COOKIE_NAME)?.value;

    // Lazy-load feed-server (pulls in firebase-admin) so the Suspense fallback
    // can stream before we pay the module-init cost on cold starts.
    const importStart = Date.now();
    const { getBootstrapFeedForUid, getBootstrapFeedFromProfile, getPublicBootstrapFeed } = await import(
      '@/lib/feed-server'
    );
    const importMs = Date.now() - importStart;

    const session = sessionCookie ? verifyTraceSession(sessionCookie) : null;

    if (session && session.profile) {
      // Fast path: cookie carries a signed viewer profile. Zero extra
      // Firestore reads needed to render the feed.
      path = 'fast';
      const p = session.profile;
      const profileAccessIsFresh = isTraceSessionProfileFresh(session);
      isPro = profileAccessIsFresh && (p.hasAccess ?? false);
      initialFeed = await getBootstrapFeedFromProfile(p.role || 'developer', {
        role: p.role || 'developer',
        interests: p.interests || [],
        onboarded: p.onboarded ?? true,
        subscription_status: profileAccessIsFresh ? p.subscriptionStatus || 'none' : 'none',
        app_subscription_status: profileAccessIsFresh ? p.appSubscriptionStatus || 'none' : 'none',
        has_access: profileAccessIsFresh && (p.hasAccess ?? false),
      });
    } else if (session) {
      // Legacy cookie (pre-profile-enrichment). Fall back to viewer-context
      // fetch. Next id-token refresh (~hourly) upgrades them to the fast path.
      path = 'legacy';
      initialFeed = await getBootstrapFeedForUid(session.uid);
    } else {
      path = 'public';
      initialFeed = await getPublicBootstrapFeed('developer');
      if (initialFeed) {
        // Public feed carries its own guest viewer_profile; no override needed
        // but keep the guest-interests constant in sync.
        initialFeed = {
          ...initialFeed,
          viewer_profile: {
            ...initialFeed.viewer_profile,
            interests: initialFeed.viewer_profile?.interests || [...DEFAULT_GUEST_INTERESTS],
          },
        };
      }
    }

    console.log(
      `[perf][feed/page] FeedDataLoader path=${path} `
      + `feed_server_import_ms=${importMs} `
      + `total_ms=${Date.now() - loaderStart}`
    );
  } catch (error) {
    console.error('[feed/page] Server-side feed fetch failed:', error);
  }

  const viewerProfile = initialFeed?.viewer_profile;
  isPro =
    isPro ||
    viewerProfile?.has_access === true ||
    viewerProfile?.subscription_status === 'active' ||
    viewerProfile?.subscription_status === 'trial' ||
    viewerProfile?.app_subscription_status === 'active' ||
    viewerProfile?.app_subscription_status === 'trial';

  const dateLabel = new Date()
    .toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    .replace(/,/g, ' ·')
    .toUpperCase();

  return (
    <EditionPrototype
      initialFeed={initialFeed}
      isPro={isPro}
      dateLabel={dateLabel}
      view={view}
      initialFeedAuthenticated={path === 'fast' || path === 'legacy'}
    />
  );
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = params.view === 'pulse' ? 'pulse' : 'edition';

  // Streaming: the Suspense boundary lets Next.js flush the shell (skeleton)
  // to the browser immediately while FeedDataLoader does its work.
  return (
    <Suspense fallback={<FeedBootShell />}>
      <FeedDataLoader view={view} />
    </Suspense>
  );
}
