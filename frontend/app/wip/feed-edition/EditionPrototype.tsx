"use client";

/**
 * PROTOTYPE — client root for the feed-edition redesign ("The Edition",
 * winning variant). Real feed data on the throwaway /wip/feed-edition route.
 * State toggles via URL: ?tier=free|pro, ?img=on.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { V3UserFeed } from '@/lib/firestore';
import { PAPER, buildEditionModel, editionSerif } from './edition-shared';
import FeedEdition from './FeedEdition';
import PulseEdition from './PulseEdition';
import PrototypeToggles from './PrototypeSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { hasActiveSubscription, resolveFeedAccess } from '@/lib/subscription-access';
import {
  personalizedFeedRefreshKey,
  shouldRefreshPersonalizedFeed,
} from '@/lib/feed-bootstrap';
import { auth } from '@/lib/firebase';

export default function EditionPrototype({
  initialFeed,
  isPro,
  dateLabel,
  tier,
  img,
  view,
  initialFeedAuthenticated = true,
  showControls = false,
}: {
  initialFeed: V3UserFeed | null;
  isPro: boolean;
  dateLabel: string;
  tier?: string;
  img?: string;
  view: 'edition' | 'pulse';
  initialFeedAuthenticated?: boolean;
  showControls?: boolean;
}) {
  const searchParams = useSearchParams();
  const {
    user,
    profile,
    loading,
    profileFresh,
    profileRefreshFailed,
    refreshProfile,
  } = useAuth();
  const access = resolveFeedAccess({
    serverHasAccess: isPro,
    clientProfile: profile,
    clientProfileFresh: profileFresh,
    clientProfileRefreshFailed: profileRefreshFailed,
    authLoading: loading,
    signedIn: Boolean(user),
  });
  const effectiveIsPro = tier === 'pro' ? true : tier === 'free' ? false : access.hasAccess;
  const accessPending = tier ? false : access.pending;
  const showImages = img !== 'off';
  const [resolvedFeed, setResolvedFeed] = useState(initialFeed);
  const refreshedProfileKey = useRef<string | null>(null);
  const checkoutRefreshStarted = useRef(false);
  const refreshProfileRef = useRef(refreshProfile);

  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  useEffect(() => {
    setResolvedFeed(initialFeed);
    refreshedProfileKey.current = null;
  }, [initialFeed]);

  useEffect(() => {
    if (searchParams.get('subscription') !== 'success' || !user) return;
    if (checkoutRefreshStarted.current) return;
    checkoutRefreshStarted.current = true;
    let cancelled = false;
    let retryTimer: number | null = null;

    const refreshUntilActive = async (attempt: number) => {
      const refreshedProfile = await refreshProfileRef.current();
      if (cancelled || hasActiveSubscription(refreshedProfile) || attempt >= 5) return;
      retryTimer = window.setTimeout(() => {
        void refreshUntilActive(attempt + 1);
      }, 4000);
    };

    void refreshUntilActive(0);
    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [searchParams, user]);

  useEffect(() => {
    if (!user || !profile) return;
    if (!shouldRefreshPersonalizedFeed({
      feed: resolvedFeed,
      initialFeedAuthenticated,
      profile,
      profileFresh,
    })) return;

    const refreshKey = personalizedFeedRefreshKey(profile);
    if (refreshedProfileKey.current === refreshKey) return;
    refreshedProfileKey.current = refreshKey;
    let cancelled = false;

    const reconcileFeed = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const response = await fetch('/api/feed?freshViewer=1', {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Feed reconciliation failed (${response.status})`);
        const feed = await response.json() as V3UserFeed | null;
        if (!cancelled && feed) setResolvedFeed(feed);
      } catch (error) {
        refreshedProfileKey.current = null;
        console.error('[feed] Personalized feed reconciliation failed:', error);
      }
    };

    void reconcileFeed();
    return () => {
      cancelled = true;
    };
  }, [
    initialFeedAuthenticated,
    profile,
    profileFresh,
    resolvedFeed,
    user,
  ]);

  const model = useMemo(
    () => buildEditionModel(
      resolvedFeed,
      effectiveIsPro,
      dateLabel,
      showImages,
      accessPending,
      access.verificationFailed,
    ),
    [resolvedFeed, effectiveIsPro, dateLabel, showImages, accessPending, access.verificationFailed],
  );

  return (
    <div className={`${editionSerif.variable} min-h-screen`} style={{ background: PAPER }}>
      {view === 'pulse'
        ? (
          <PulseEdition
            feed={resolvedFeed}
            dateLabel={dateLabel}
            isPro={effectiveIsPro}
            accessPending={accessPending}
            accessVerificationFailed={access.verificationFailed}
            onRetryAccess={refreshProfile}
          />
        )
        : <FeedEdition model={model} onRetryAccess={refreshProfile} />}
      {showControls && <PrototypeToggles tier={tier} img={img} isPro={isPro} />}
    </div>
  );
}
