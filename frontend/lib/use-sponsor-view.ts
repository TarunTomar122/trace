'use client';

import { useEffect, type RefObject } from 'react';
import type { SponsorPlacement } from '@/lib/sponsor-link';

// Counts a sponsor view: the card was at least half on screen for a second,
// with the tab in front (the usual viewable-ad rule). Each sponsor and spot
// counts once per visit (the set below lives until the tab reloads or closes).
// Views go to /api/tools/seen in one beacon, and the sponsor's stats page
// (/sponsor/[id]) reads them.

const VISIBLE_SHARE = 0.5;
const VISIBLE_MS = 1000;
const counted = new Set<string>();
const pending: [string, SponsorPlacement][] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (!pending.length) return;
  const body = JSON.stringify({ views: pending.splice(0) });
  try {
    // text/plain: a beacon with a JSON type is refused by some browsers.
    if (!navigator.sendBeacon?.('/api/tools/seen', new Blob([body], { type: 'text/plain' }))) {
      void fetch('/api/tools/seen', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
    }
  } catch {
    // Counting must never get in the way of the page.
  }
}

if (typeof window !== 'undefined') {
  // Views still waiting for the batch go out when the reader leaves.
  window.addEventListener('pagehide', flush);
}

function recordView(sponsorId: string, placement: SponsorPlacement): void {
  const key = `${placement}:${sponsorId}`;
  if (counted.has(key)) return;
  counted.add(key);
  pending.push([sponsorId, placement]);
  // Cards that come into view together go out as one beacon.
  flushTimer ??= setTimeout(flush, 300);
}

export function useSponsorView(ref: RefObject<Element | null>, sponsorId: string, placement: SponsorPlacement): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !sponsorId || typeof IntersectionObserver === 'undefined') return;
    if (counted.has(`${placement}:${sponsorId}`)) return;
    let onScreen = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    // Starts the one-second wait while the card is on screen and the tab is in front.
    const check = () => {
      if (!onScreen || document.visibilityState !== 'visible') return stop();
      timer ??= setTimeout(() => {
        timer = null;
        if (!onScreen || document.visibilityState !== 'visible') return;
        recordView(sponsorId, placement);
        cleanup();
      }, VISIBLE_MS);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting && entry.intersectionRatio >= VISIBLE_SHARE;
        check();
      },
      { threshold: [0, VISIBLE_SHARE, 1] },
    );
    const cleanup = () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', check);
    };
    observer.observe(el);
    document.addEventListener('visibilitychange', check);
    return cleanup;
  }, [ref, sponsorId, placement]);
}
