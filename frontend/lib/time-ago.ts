// Relative times ("12m ago") for feed cards. Safe on server and client.
// The cached /feed and /story pages never carry these strings (they would
// go stale in the cache and turn every rebuild into a new ISR write), so the
// browser formats them from the raw time instead.

export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return '';
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Format from the raw time when there is one; otherwise the precomputed label. */
export function agoLabel(item: { time?: string; ts?: number; at?: string }): string {
  if (item.ts && item.ts > 0) return timeAgo(new Date(item.ts).toISOString());
  if (item.at) return timeAgo(item.at);
  return item.time || '';
}
