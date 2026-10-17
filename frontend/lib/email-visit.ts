// The daily's own links carry the send's id (`?from=email&et=<id>`, added by
// backend/v3/flows/send_audience_newsletter.py). components/EmailVisitTracker.tsx
// reports it to /api/email/visit; analytics must never see it.
export const EMAIL_VISIT_PARAM = 'et';

// uuid4().hex, as minted per send by the sender.
const TRACK_ID = /^[0-9a-f]{32}$/;

export function normalizeTrackId(value: unknown): string {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return TRACK_ID.test(id) ? id : '';
}
