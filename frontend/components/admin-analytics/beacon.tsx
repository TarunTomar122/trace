'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { beaconTrack, referrerOrigin, utmOf } from '@/lib/analytics/beacon';
import { captureFirstTouch } from '@/lib/first-touch';

/**
 * Sends a pageview to the first-party analytics (lib/analytics/beacon.ts) each time the path changes. The first
 * one carries the referrer's origin and the address's UTM tags: a visit's source is how it started. Key events
 * come through lib/posthog.tsx.
 */
export function TraceBeacon() {
  const path = usePathname();
  const previous = useRef<string | null>(null);
  // Before the bot check: a signup's channel is kept whoever loads the page.
  useEffect(() => { captureFirstTouch(); }, []);
  useEffect(() => {
    if (!path || previous.current === path) return;
    const first = previous.current === null;
    previous.current = path;
    beaconTrack('$pageview', first ? { referrer: referrerOrigin(document.referrer), ...utmOf(window.location.search) } : {});
  }, [path]);
  return null;
}
