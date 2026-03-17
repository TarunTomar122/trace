"use client";

export const AFFILIATE_COOKIE_KEY = "trace_affiliate";
export const AFFILIATE_STORAGE_KEY = "trace_affiliate";
export const AFFILIATE_SESSION_PREFIX = "trace_affiliate_tracked";
export const DEFAULT_AFFILIATE_TTL_DAYS = 30;

export type AffiliateAttribution = {
  code: string;
  landingPath: string;
  capturedAt: string;
  utmSource?: string | null;
  utmCampaign?: string | null;
  utmMedium?: string | null;
};

function normalizeCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase();
  if (!code) return null;
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(code)) return null;
  return code;
}

export function readAffiliateCookie(): AffiliateAttribution | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${AFFILIATE_COOKIE_KEY}=`));
  if (!cookie) return null;
  try {
    return JSON.parse(decodeURIComponent(cookie.split("=").slice(1).join("="))) as AffiliateAttribution;
  } catch {
    return null;
  }
}

export function readAffiliateAttribution(): AffiliateAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AFFILIATE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as AffiliateAttribution;
    }
  } catch {
    // ignore
  }
  return readAffiliateCookie();
}

export function writeAffiliateAttribution(attribution: AffiliateAttribution, ttlDays = DEFAULT_AFFILIATE_TTL_DAYS): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const value = JSON.stringify(attribution);
  try {
    window.localStorage.setItem(AFFILIATE_STORAGE_KEY, value);
  } catch {
    // ignore storage failures
  }
  const expires = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${AFFILIATE_COOKIE_KEY}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function buildAffiliateAttributionFromSearch(
  searchParams: URLSearchParams,
  pathname: string
): AffiliateAttribution | null {
  const code = normalizeCode(
    searchParams.get("ref") ||
    searchParams.get("affiliate") ||
    searchParams.get("aff")
  );
  if (!code) return null;
  return {
    code,
    landingPath: pathname || "/",
    capturedAt: new Date().toISOString(),
    utmSource: searchParams.get("utm_source"),
    utmCampaign: searchParams.get("utm_campaign"),
    utmMedium: searchParams.get("utm_medium"),
  };
}

export function getAffiliateTrackKey(code: string, target: string, pathname: string): string {
  return `${AFFILIATE_SESSION_PREFIX}:${code}:${target}:${pathname}`;
}

export function markAffiliateTracked(code: string, target: string, pathname: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getAffiliateTrackKey(code, target, pathname), "1");
  } catch {
    // ignore
  }
}

export function hasAffiliateBeenTracked(code: string, target: string, pathname: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(getAffiliateTrackKey(code, target, pathname)) === "1";
  } catch {
    return false;
  }
}

export function getAffiliateCode(): string | null {
  return readAffiliateAttribution()?.code || null;
}
