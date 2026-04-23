/**
 * IST calendar date helpers for daily archive URLs. Safe for client and server
 * (no Firebase / Node-only imports).
 */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getTodayIstDate(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

/** Calendar add/subtract for YYYY-MM-DD (matches archive `date` ids). */
export function addCalendarDaysIso(iso: string, deltaDays: number): string {
  if (!ISO_DATE_RE.test(iso)) return iso;
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return iso;
  const t = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return t.toISOString().slice(0, 10);
}

export function getYesterdayIstDate(): string {
  return addCalendarDaysIso(getTodayIstDate(), -1);
}
