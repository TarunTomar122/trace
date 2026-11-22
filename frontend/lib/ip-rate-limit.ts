/**
 * A small per-visitor limiter for public endpoints (e.g. /api/taste): at most `limit` requests per `windowMs` from
 * one address. It lives in memory, so each server instance counts on its own: it stops one visitor hammering a
 * route, not a determined crawler spread over many instances. Addresses are never logged or stored anywhere else.
 */

type Window = { start: number; count: number };

/** Past this many tracked addresses, finished windows are swept so the map cannot grow without bound. */
const SWEEP_AT = 5_000;

export function createIpRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const windows = new Map<string, Window>();
  return function take(key: string, now: number = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
    if (windows.size > SWEEP_AT) {
      for (const [other, window] of windows) if (now - window.start >= windowMs) windows.delete(other);
      // Still full after the sweep (a burst of distinct addresses): start over rather than grow.
      if (windows.size > SWEEP_AT) windows.clear();
    }
    const window = windows.get(key);
    if (!window || now - window.start >= windowMs) {
      windows.set(key, { start: now, count: 1 });
      return { ok: true };
    }
    if (window.count >= limit) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((window.start + windowMs - now) / 1000)) };
    window.count += 1;
    return { ok: true };
  };
}

/** The visitor's address as the proxy reports it: the first x-forwarded-for entry, then x-real-ip. */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
