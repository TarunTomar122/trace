import { cookies } from 'next/headers';
import { TRACE_SESSION_COOKIE_NAME, verifyTraceSession } from '@/lib/server-session';
import { getBootstrapFeedForUid, getPublicBootstrapFeed } from '@/lib/feed-server';
import FeedPageClient from './FeedPageClient';

export default async function FeedPage() {
  let initialFeed = null;

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(TRACE_SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const session = verifyTraceSession(sessionCookie);
      if (session) {
        initialFeed = await getBootstrapFeedForUid(session.uid);
      }
    } else {
      initialFeed = await getPublicBootstrapFeed('developer');
    }
  } catch (error) {
    // Server-side feed fetch is best-effort — client will retry via SWR.
    console.error('[feed/page] Server-side feed fetch failed:', error);
  }

  return <FeedPageClient initialFeed={initialFeed} />;
}
