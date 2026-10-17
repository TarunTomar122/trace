"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { EMAIL_VISIT_PARAM, normalizeTrackId } from "@/lib/email-visit";

// The daily's own links carry the send's id (`?from=email&et=<id>`). Reporting
// the visit from the browser lets the morning run count this reader as active.
const STORAGE_KEY = "trace:email-visits";
const MAX_REMEMBERED = 30;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Once a day per email is enough: the morning run only asks "visited lately?".
function reportedToday(trackId: string): boolean {
  try {
    const seen = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, string>;
    return seen[trackId] === today();
  } catch {
    return false;
  }
}

function rememberReported(trackId: string) {
  try {
    const seen = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, string>;
    delete seen[trackId];
    const kept = Object.entries(seen).slice(-(MAX_REMEMBERED - 1));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries([...kept, [trackId, today()]])));
  } catch {
    /* storage unavailable */
  }
}

export default function EmailVisitTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams.has(EMAIL_VISIT_PARAM)) return;
    const trackId = normalizeTrackId(searchParams.get(EMAIL_VISIT_PARAM));

    // Automated browsers (security scanners opening links) are not readers.
    if (trackId && !navigator.webdriver && !reportedToday(trackId)) {
      rememberReported(trackId);
      void fetch("/api/email/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: trackId }),
        keepalive: true,
      }).catch(() => {
        // Tracking should never block the page.
      });
    }

    // Drop the id from the address bar so a copied or shared link doesn't
    // carry it (and a friend's visit isn't counted as this reader's).
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete(EMAIL_VISIT_PARAM);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  return null;
}
