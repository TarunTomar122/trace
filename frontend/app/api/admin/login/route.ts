import { readCapped } from "@/lib/analytics/body";
import { NextRequest, NextResponse } from "next/server";

import {
  adminConfigured,
  adminCookieOptions,
  globalLoginLocked,
  loginKey,
  loginLimiter,
  noteFailedLogin,
  passwordMatches,
  sameOrigin,
  signAdminCookie,
} from "@/lib/analytics/admin-auth";
import { visitorAddress } from "@/lib/analytics/address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * The admin password check (lib/analytics/admin-auth.ts). A right password
 * sets the signed admin cookie; anything else says no, without saying why
 * beyond "wrong password" or "too many tries". The password is never logged.
 */
export async function POST(request: NextRequest) {
  if (!adminConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503, headers: NO_STORE });
  if (!sameOrigin(request.headers)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  if (globalLoginLocked()) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { ...NO_STORE, "Retry-After": "900" } });
  // Per address (Cloudflare's, see lib/analytics/address.ts); a direct hit could claim any address, which is why the
  // lifetime ceiling above counts wrong passwords from everyone together.
  const limited = loginLimiter()(loginKey(visitorAddress(request.headers)));
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(limited.retryAfterSec) } });
  }
  let password: unknown = null;
  try {
    const body = (JSON.parse((await readCapped(request,2048)) || "")) as { password?: unknown };
    password = body?.password;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  if (!passwordMatches(password)) {
    noteFailedLogin();
    return NextResponse.json({ error: "wrong_password" }, { status: 401, headers: NO_STORE });
  }
  const value = signAdminCookie();
  if (!value) return NextResponse.json({ error: "not_configured" }, { status: 503, headers: NO_STORE });
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set({ ...adminCookieOptions(), value });
  return response;
}
