import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { TRACE_SESSION_COOKIE_NAME, verifyTraceSession } from '@/lib/server-session';
import EditionPrototype from './EditionPrototype';

// PROTOTYPE — throwaway route. Real feed data, inkling-style editorial
// redesign. Same data path as app/(auth)/feed/page.tsx. See NOTES.md.

export const dynamic = 'force-dynamic';

const DEFAULT_GUEST_INTERESTS = ['ai', 'tech', 'startups', 'engineering', 'markets'];

async function EditionDataLoader({ tier, img, view }: { tier?: string; img?: string; view?: string }) {
  let initialFeed = null;
  let isPro = false;

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(TRACE_SESSION_COOKIE_NAME)?.value;

    const { getBootstrapFeedForUid, getBootstrapFeedFromProfile, getPublicBootstrapFeed } =
      await import('@/lib/feed-server');

    const session = sessionCookie ? verifyTraceSession(sessionCookie) : null;

    if (session && session.profile) {
      const p = session.profile;
      isPro = p.hasAccess ?? false;
      initialFeed = await getBootstrapFeedFromProfile(p.role || 'developer', {
        role: p.role || 'developer',
        interests: p.interests || [],
        onboarded: p.onboarded ?? true,
        subscription_status: p.subscriptionStatus || 'none',
        app_subscription_status: p.appSubscriptionStatus || 'none',
        has_access: p.hasAccess ?? false,
      });
    } else if (session) {
      initialFeed = await getBootstrapFeedForUid(session.uid);
    } else {
      initialFeed = await getPublicBootstrapFeed('developer');
      if (initialFeed) {
        initialFeed = {
          ...initialFeed,
          viewer_profile: {
            ...initialFeed.viewer_profile,
            interests: initialFeed.viewer_profile?.interests || [...DEFAULT_GUEST_INTERESTS],
          },
        };
      }
    }
  } catch (error) {
    console.error('[wip/feed-edition] Server-side feed fetch failed:', error);
  }

  const vp = initialFeed?.viewer_profile;
  isPro =
    isPro ||
    vp?.has_access === true ||
    vp?.subscription_status === 'active' ||
    vp?.subscription_status === 'trial' ||
    vp?.app_subscription_status === 'active' ||
    vp?.app_subscription_status === 'trial';

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
      tier={tier}
      img={img}
      view={view === 'pulse' ? 'pulse' : 'edition'}
      showControls
    />
  );
}

export default async function FeedEditionPrototypePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tier = typeof sp.tier === 'string' ? sp.tier : undefined;
  const img = typeof sp.img === 'string' ? sp.img : undefined;
  const view = typeof sp.view === 'string' ? sp.view : undefined;

  return (
    <Suspense fallback={null}>
      <EditionDataLoader tier={tier} img={img} view={view} />
    </Suspense>
  );
}
