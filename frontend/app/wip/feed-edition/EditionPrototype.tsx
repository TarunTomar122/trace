"use client";

/**
 * PROTOTYPE — client root for the feed-edition redesign ("The Edition",
 * winning variant). Real feed data on the throwaway /wip/feed-edition route.
 * State toggles via URL: ?tier=free|pro, ?img=on.
 */

import React, { useMemo } from 'react';
import type { V3UserFeed } from '@/lib/firestore';
import { PAPER, buildEditionModel, editionSerif } from './edition-shared';
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

  const model = useMemo(
    () => buildEditionModel(initialFeed, effectiveIsPro, dateLabel, showImages),
    [initialFeed, effectiveIsPro, dateLabel, showImages],
  );

  return (
    <div className={`${editionSerif.variable} min-h-screen`} style={{ background: PAPER }}>
      {view === 'pulse'
        ? <PulseEdition feed={initialFeed} dateLabel={dateLabel} isPro={effectiveIsPro} />
        : <FeedEdition model={model} />}
      {showControls && <PrototypeToggles tier={tier} img={img} isPro={isPro} />}
    </div>
  );
}
