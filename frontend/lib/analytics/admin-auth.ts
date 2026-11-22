import { createHash, createHmac, timingSafeEqual } from "crypto";

import { parseIp } from "@/lib/analytics/mmdb";
import { createIpRateLimiter } from "@/lib/ip-rate-limit";

/**
 * The password gate in front of /admin/* and /api/admin/*.
 *
 * - The password is ANALYTICS_PASSWORD on the server. Unset, or shorter than
 *   4 characters once trimmed, means the admin area is not configured and
 *   refuses everything.
 * - A right password gets a signed cookie (httpOnly, Secure, SameSite=Strict,
 *   30 days): "v1.<expires ms>.<hmac>". The HMAC key comes from
 *   ANALYTICS_SECRET when set, else from the password plus the store token, so
 *   a cookie can't be forged without a server secret, and changing the
 *   password signs everyone out.
 * - Attempts are limited to 5 per 15 minutes per address (an IPv6 /64 counts
 *   as one), per web instance (production runs two, so at most 10 a window in
 *   the worst case). On top of that each instance takes at most 100 wrong
 *   passwords from all addresses together over its whole life; after that it
 *   refuses every try until it restarts (a deploy), so a spread-out guessing
 *   run stops dead. The owner's 30-day cookie keeps working meanwhile.
 * - The password is never logged, echoed or stored.
 */

export const ADMIN_COOKIE = "trace_admin";
export const ADMIN_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;
export const LOGIN_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 } as const;

type Env = { ANALYTICS_PASSWORD?: string; ANALYTICS_SECRET?: string; LOCALDB_API_TOKEN?: string };

function envNow(): Env {
  return {
    ANALYTICS_PASSWORD: process.env.ANALYTICS_PASSWORD,
    ANALYTICS_SECRET: process.env.ANALYTICS_SECRET,
    LOCALDB_API_TOKEN: process.env.LOCALDB_API_TOKEN,
  };
}

export const MIN_PASSWORD_LENGTH = 4;
/** Wrong passwords one instance takes from everyone together before it stops taking any (until restart). */
export const GLOBAL_FAILED_CEILING = 100;

export function adminConfigured(env: Env = envNow()): boolean {
  return (env.ANALYTICS_PASSWORD ?? "").trim().length >= MIN_PASSWORD_LENGTH;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant time: both sides are hashed to 32 bytes first, so neither the length nor the content leaks through timing. */
export function passwordMatches(attempt: unknown, env: Env = envNow()): boolean {
  const expected = env.ANALYTICS_PASSWORD;
  if (!expected || !adminConfigured(env) || typeof attempt !== "string" || attempt.length === 0 || attempt.length > 512) return false;
  return timingSafeEqual(sha256(attempt), sha256(expected));
}

function signingKey(env: Env): Buffer | null {
  if (!adminConfigured(env)) return null;
  const secret = env.ANALYTICS_SECRET?.trim();
  if (secret) return sha256(`trace-admin-v1\0${secret}`);
  return sha256(`trace-admin-v1\0${env.ANALYTICS_PASSWORD}\0${env.LOCALDB_API_TOKEN ?? ""}`);
}

function mac(key: Buffer, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function signAdminCookie(now: number = Date.now(), env: Env = envNow()): string | null {
  const key = signingKey(env);
  if (!key) return null;
  const payload = `v1.${now + ADMIN_COOKIE_MAX_AGE_S * 1000}`;
  return `${payload}.${mac(key, payload)}`;
}

export function verifyAdminCookie(value: string | null | undefined, now: number = Date.now(), env: Env = envNow()): boolean {
  const key = signingKey(env);
  if (!key || !value || value.length > 200) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^\d{1,16}$/.test(parts[1]!)) return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires <= now || expires > now + ADMIN_COOKIE_MAX_AGE_S * 1000 + 60_000) return false;
  const expected = Buffer.from(mac(key, `${parts[0]}.${parts[1]}`));
  const given = Buffer.from(parts[2]!);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function adminCookieOptions(maxAge = ADMIN_COOKIE_MAX_AGE_S) {
  return {
    name: ADMIN_COOKIE,
    httpOnly: true,
    // Browsers accept Secure cookies on http://localhost, so this holds in development too.
    secure: true,
    sameSite: "strict" as const,
    // "/" because it must reach both /admin and /api/admin; it is httpOnly and means nothing anywhere else.
    path: "/",
    maxAge,
  };
}

type Limiter = ReturnType<typeof createIpRateLimiter>;
const globalKey = "__sbAdminLoginLimiter" as const;
type GlobalWithLimiter = typeof globalThis & { [globalKey]?: Limiter };

const failedKey = "__sbAdminFailedLogins" as const;
type GlobalWithFailed = typeof globalThis & { [failedKey]?: { count: number } };

function failedCounter(): { count: number } {
  const g = globalThis as GlobalWithFailed;
  if (!g[failedKey]) g[failedKey] = { count: 0 };
  return g[failedKey]!;
}

/** Whether this instance has taken its lifetime share of wrong passwords. It never resets short of a restart. */
export function globalLoginLocked(): boolean {
  return failedCounter().count >= GLOBAL_FAILED_CEILING;
}

export function noteFailedLogin() {
  failedCounter().count += 1;
}

/** One limiter per process (globalThis, so every route bundle shares it). */
export function loginLimiter(): Limiter {
  const g = globalThis as GlobalWithLimiter;
  if (!g[globalKey]) g[globalKey] = createIpRateLimiter(LOGIN_LIMIT);
  return g[globalKey]!;
}

/**
 * What the login limiter counts by: the address, or for IPv6 its /64. One home
 * connection usually gets a whole /64, so counting single IPv6 addresses would
 * let one machine try passwords from millions of them.
 */
export function loginKey(address: string): string {
  const bytes = address.includes(":") ? parseIp(address) : null;
  if (!bytes) return address;
  if (bytes.length === 4) return bytes.join(".");
  return `${Array.from(bytes.subarray(0, 8), (b) => b.toString(16).padStart(2, "0")).join("")}/64`;
}

/** Same-origin check for the login POST: a form on another site can't try passwords through a visitor's browser. */
export function sameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = headers.get("host");
  if (!origin) return headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Reads the admin cookie from a request's Cookie header and verifies it. */
export function isAdminRequest(cookieValue: string | null | undefined): boolean {
  return verifyAdminCookie(cookieValue);
}
