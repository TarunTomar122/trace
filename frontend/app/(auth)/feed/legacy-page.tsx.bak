import { Suspense } from 'react';
import { cookies } from 'next/headers';
import {
  isTraceSessionProfileFresh,
  TRACE_SESSION_COOKIE_NAME,
  verifyTraceSession,
} from '@/lib/server-session';
import FeedBootShell from './FeedBootShell';
import FeedPageRuntime from './FeedPageRuntime';

// Force dynamic so Next.js streams the response instead of trying to
// statically pre-render with cookies().
export const dynamic = 'force-dynamic';

const DEFAULT_GUEST_INTERESTS = ['ai', 'tech', 'startups', 'engineering', 'markets'];

async function FeedDataLoader() {
  const loaderStart = Date.now();
  let initialFeed = null;
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

    if (session?.profile && isTraceSessionProfileFresh(session)) {
      // Fast path: cookie carries a signed viewer profile. Zero extra
      // Firestore reads needed to render the feed.
      path = 'fast';
      const p = session.profile;
      initialFeed = await getBootstrapFeedFromProfile(p.role || 'developer', {
        role: p.role || 'developer',
        interests: p.interests || [],
        onboarded: p.onboarded ?? true,
        subscription_status: p.subscriptionStatus || 'none',
        app_subscription_status: p.appSubscriptionStatus || 'none',
        has_access: p.hasAccess ?? false,
      });
    } else if (session) {
      // Missing or stale viewer data must be refreshed before rendering any
      // entitlement-sensitive UI.
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

  return <FeedPageRuntime initialFeed={initialFeed} />;
}

export default function FeedPage() {
  // Streaming: the Suspense boundary lets Next.js flush the shell (skeleton)
  // to the browser immediately while FeedDataLoader does its work.
  return (
    <Suspense fallback={<FeedBootShell />}>
      <FeedDataLoader />
    </Suspense>
  );
}
