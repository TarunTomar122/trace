"use client";

import { cleanUtm, keyEventFor, PROPS_BY_EVENT, publicPath } from "./normalize.ts";
import { finishVitals, startVitals, type VitalsPayload } from "./vitals-client.ts";

/**
 * The first-party analytics beacon. components/admin-analytics/beacon.tsx sends
 * each pageview here, and lib/posthog.tsx hands every tracked event here as
 * well; only pageviews and the key events (lib/analytics/normalize.ts
 * KEY_EVENTS) are kept, with the one property the dashboard counts. They queue
 * for a second and go to /api/a in one small POST (sendBeacon, or fetch with
 * keepalive), and whatever is left goes when the tab is hidden or closed.
 *
 * Only public pages leave the browser (normalize.ts publicPath): the real path
 * of a page that is the same for everyone, the route of one that belongs to
 * someone, nothing at all for any other page. The referrer goes as its origin
 * only.
 *
 * No cookie and nothing persistent: the session id is random, lives in
 * sessionStorage (this tab only) and is replaced after 30 idle minutes. The
 * visitor id is made on the server from a daily salt and is never stored here.
 * Signed in or not travels as a yes/no flag; who is signed in never does.
 *
 * The first pageview of a document also starts the page-speed measurement
 * (lib/analytics/vitals-client.ts); its one report rides along with the next
 * send as `v`, at the latest when the tab is hidden or the visitor moves on.
 */

const ENDPOINT = "/api/a";
const SESSION_KEY = "trace_sid";
const IDLE_MS = 30 * 60 * 1000;
const SEND_AFTER_MS = 1000;
const SEND_AT = 10;
const MAX_QUEUE = 50;

type Queued = { n: string; p: string; t: number; r?: string | null; u?: { s?: string | null; m?: string | null; c?: string | null }; x?: Record<string, unknown> };

let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let signedIn: boolean | null = null;
let listening = false;
let memorySession: { id: string; last: number } | null = null;
let vitalsPath: string | null = null;
let pendingVitals: VitalsPayload | null = null;

function randomId(): string {
  const bytes = new Uint8Array(12);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);
}

/** This tab's session id: the same until 30 minutes pass with nothing sent. */
export function sessionId(now = Date.now()): string {
  let session = memorySession;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) session = JSON.parse(raw) as { id: string; last: number };
  } catch {
    // storage blocked: the in-memory one stands in for this page
  }
  if (!session || typeof session.id !== "string" || !/^[a-z0-9]{8,32}$/.test(session.id) || now - Number(session.last) > IDLE_MS) {
    session = { id: randomId(), last: now };
  }
  session.last = now;
  memorySession = session;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // best effort
  }
  return session.id;
}

/** Signed in or not (lib/posthog.tsx identifyUser and resetUser, contexts/AuthContext.tsx). */
export function beaconSignedIn(value: boolean) {
  signedIn = value;
}

function pick(props: Record<string, unknown> | undefined, keys: readonly string[]): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of keys) if (props[key] !== undefined && props[key] !== null) out[key] = props[key];
  return Object.keys(out).length > 0 ? out : undefined;
}

function automated(): boolean {
  try {
    return navigator.webdriver === true;
  } catch {
    return false;
  }
}

/** The referrer's origin ("https://news.ycombinator.com"), never its path or query. */
export function referrerOrigin(referrer: string): string | null {
  try {
    const url = new URL(referrer);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "android-app:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** The UTM tags of the page's own address, cleaned. */
export function utmOf(search: string): { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null } {
  try {
    const q = new URLSearchParams(search);
    return { utm_source: cleanUtm(q.get("utm_source")), utm_medium: cleanUtm(q.get("utm_medium")), utm_campaign: cleanUtm(q.get("utm_campaign")) };
  } catch {
    return { utm_source: null, utm_medium: null, utm_campaign: null };
  }
}

export function beaconTrack(name: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const key = keyEventFor(name);
    if (!key) return;
    const raw = window.location.pathname;
    const path = publicPath(raw);
    if (!path || automated()) return;
    const item: Queued = { n: name, p: path, t: Date.now() };
    if (key === "pageview") {
      // The page load is measured on the page it landed on: moving to another page closes that measurement.
      if (vitalsPath === null) {
        vitalsPath = raw;
        startVitals(raw, (report) => {
          const p = publicPath(report.p);
          pendingVitals = p ? { ...report, p } : null;
        });
      } else if (raw !== vitalsPath) finishVitals();
      item.r = typeof props?.referrer === "string" ? props.referrer : null;
      const utm = { s: props?.utm_source as string | null, m: props?.utm_medium as string | null, c: props?.utm_campaign as string | null };
      if (utm.s || utm.m || utm.c) item.u = utm;
    }
    const allowed = PROPS_BY_EVENT[key];
    if (allowed) item.x = pick(props, allowed);
    queue.push(item);
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    listen();
    if (queue.length >= SEND_AT) send();
    else if (!timer) timer = setTimeout(send, SEND_AFTER_MS);
  } catch {
    // analytics must never break the page
  }
}

function listen() {
  if (listening) return;
  listening = true;
  const leave = () => {
    finishVitals();
    send();
  };
  window.addEventListener("pagehide", leave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") leave();
  });
}

function send() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (queue.length === 0 && !pendingVitals) return;
  const now = Date.now();
  const events = queue.map(({ t, ...rest }) => ({ ...rest, a: Math.max(0, now - t) }));
  const v = pendingVitals;
  queue = [];
  pendingVitals = null;
  try {
    const body = JSON.stringify({ sid: sessionId(now), sw: window.screen?.width ?? null, si: signedIn, e: events, ...(v ? { v } : {}) });
    // text/plain keeps it a "simple" request; the route parses the JSON itself.
    const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }));
    if (!sent) void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" }, credentials: "omit" }).catch(() => undefined);
  } catch {
    // dropped: never retried, never thrown
  }
}
