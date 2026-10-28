// Sponsor links, shared by the feed and the brief pages.
//
// Every sponsor click is counted twice, so the sponsor and Trace see the same
// traffic: the link carries UTM tags for the sponsor's own analytics, and a
// beacon to /api/tools/click adds it to our first-party count (the numbers on
// the sponsor's stats page), next to the PostHog event the caller sends.

export const SPONSOR_PLACEMENTS = ['desktop_tools', 'home_feed_end', 'pulse_mobile', 'brief_rail'] as const;
export type SponsorPlacement = (typeof SPONSOR_PLACEMENTS)[number];

/** How many sponsors show at once (feed and brief); a sale beyond this is refused. */
export const SPONSOR_SLOTS = 3;

/** The sponsor's URL with Trace's UTM tags; any tag the sponsor already set is kept. */
export function sponsorHref(url: string, placement: SponsorPlacement): string {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return url;
    const tags = { utm_source: 'trace', utm_medium: 'sponsored', utm_campaign: 'trace_sponsor', utm_content: placement };
    for (const [key, value] of Object.entries(tags)) {
      if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Adds the click to the sponsor's count; survives the tab opening the sponsor's site. */
export function recordSponsorClick(sponsorId: string, placement: SponsorPlacement): void {
  try {
    const body = JSON.stringify({ id: sponsorId, placement });
    // text/plain: a beacon with a JSON type is refused by some browsers.
    if (typeof navigator !== 'undefined' && navigator.sendBeacon?.('/api/tools/click', new Blob([body], { type: 'text/plain' }))) return;
    void fetch('/api/tools/click', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch {
    // Counting must never get in the way of the click.
  }
}
