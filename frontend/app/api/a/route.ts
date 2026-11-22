import { readCapped } from "@/lib/analytics/body";
import { NextRequest } from "next/server";


import { collect } from "@/lib/analytics/store";
import { cloudflareCountry, visitorAddress } from "@/lib/analytics/address";
import { isBot } from "@/lib/analytics/ua";
import { createIpRateLimiter } from "@/lib/ip-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The first-party analytics beacon (lib/analytics/beacon.ts posts here). It
 * answers 204 at once in every case, so a page never waits on it or learns
 * anything from it: the events are checked, queued in memory and written a few
 * seconds later in a batch (lib/analytics/store.ts).
 *
 * The visitor's address is Cloudflare's CF-Connecting-IP, or the first
 * X-Forwarded-For entry for a request that reached Caddy directly, and the
 * country is Cloudflare's CF-IPCountry when it sent one, else the db-ip lookup
 * (lib/analytics/address.ts says why a direct hit could fake both, and why that
 * is fine here). The address is used for the country and the daily visitor
 * hash, then dropped; it is never stored or logged.
 *
 * A body may also carry `v`, the speed of the full page load it came from
 * (lib/analytics/vitals-client.ts), with or without events beside it.
 */

const MAX_BODY_BYTES = 8 * 1024;
/** Per address, per web instance (production runs two): plenty for a person, little for a script. */
const limiter = createIpRateLimiter({ limit: 60, windowMs: 60 * 1000 });


function done() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const ua = request.headers.get("user-agent") ?? "";
    if (isBot(ua)) return done();
    // Only our own pages post here: a browser always sends Origin on a POST, and it must be this host.
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") ?? "";
    if (origin) {
      try {
        if (new URL(origin).host !== host) return done();
      } catch {
        return done();
      }
    }
    const ip = visitorAddress(request.headers);
    if (!limiter(ip).ok) return done();
    const text = await readCapped(request, MAX_BODY_BYTES);
    if (!text) return done();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return done();
    }
    await collect(host, ip, ua, cloudflareCountry(request.headers), raw);
  } catch {
    // never fail a beacon
  }
  return done();
}
