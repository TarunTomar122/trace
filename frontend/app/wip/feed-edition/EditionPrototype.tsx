"use client";

/**
 * PROTOTYPE — client root for the feed-edition redesign ("The Edition",
 * winning variant). Real feed data on the throwaway /wip/feed-edition route.
 * State toggles via URL: ?tier=free|pro, ?img=on.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import type { V3UserFeed } from '@/lib/firestore';
import { trackFeedViewed } from '@/lib/posthog';
import { useAuth } from '@/contexts/AuthContext';
import { PAPER, buildEditionModel, buildPulseEdition, editionSerif } from './edition-shared';
import FeedEdition from './FeedEdition';
import PulseEdition from './PulseEdition';
import PrototypeToggles from './PrototypeSwitcher';

export default function EditionPrototype({
  initialFeed,
  isPro,
  dateLabel,
  tier,
  img,
  view,
  showControls = false,
}: {
  initialFeed: V3UserFeed | null;
  isPro: boolean;
  dateLabel: string;
  tier?: string;
  img?: string;
  view: 'edition' | 'pulse';
  showControls?: boolean;
}) {
  const effectiveIsPro = tier === 'pro' ? true : tier === 'free' ? false : isPro;
  const showImages = img !== 'off';
  const { user, loading: authLoading } = useAuth();

  const model = useMemo(
    () => buildEditionModel(initialFeed, effectiveIsPro, dateLabel, showImages),
    [initialFeed, effectiveIsPro, dateLabel, showImages],
  );
  const trackedView = useRef<string | null>(null);
  const itemCount = view === 'pulse'
    ? buildPulseEdition(initialFeed).reduce((total, section) => total + section.items.length, 0)
    : model.edition.totalCount;

  useEffect(() => {
    if (authLoading || itemCount === 0) return;
    const audience = user ? 'authenticated' : 'guest';
    const trackingKey = `${dateLabel}:${view}:${effectiveIsPro ? 'pro' : 'free'}:${audience}`;
    if (trackedView.current === trackingKey) return;
    trackedView.current = trackingKey;
    trackFeedViewed(
      itemCount,
      !effectiveIsPro,
      view,
      effectiveIsPro ? 'pro' : 'free',
      audience,
    );
  }, [authLoading, dateLabel, effectiveIsPro, itemCount, user, view]);

  return (
    <div className={`${editionSerif.variable} min-h-screen`} style={{ background: PAPER }}>
      {view === 'pulse'
        ? <PulseEdition feed={initialFeed} dateLabel={dateLabel} isPro={effectiveIsPro} />
        : <FeedEdition model={model} />}
      {showControls && <PrototypeToggles tier={tier} img={img} isPro={isPro} />}
    </div>
  );
}
