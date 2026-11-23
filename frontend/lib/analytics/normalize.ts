/**
 * Turning what the beacon sends into the few safe, low-cardinality values the
 * analytics store keeps. Pure, shared by the browser (lib/analytics/beacon.ts),
 * the beacon route and the tests.
 *
 * Only public pages leave the browser. A page whose slug or id is the same for
 * everyone (a blog post, a day's brief, a shared story) keeps its real path; a
 * page that belongs to one person or sponsor keeps only its route template; any
 * other path (admin, dev tools, OAuth, unknown pages) is never sent. Paths lose
 * their query and hash, referrers keep only their host, free text is never
 * accepted, and every string is capped.
 */

export const PRODUCTION_HOSTS = ["www.yourtrace.online", "yourtrace.online"];

const MAX_PATH = 120;

/** A clean path: no query, no hash, no trailing slash, at most 120 characters. Null for anything that is not a path. */
export function cleanPath(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let path = input.split(/[?#]/)[0]!.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  try {
    path = decodeURI(path);
  } catch {
    // keep it encoded
  }
  // Control characters and spaces never belong in one of our paths.
  path = path.replace(/[\u0000-\u001f\u007f\s]+/g, "");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path.slice(0, MAX_PATH) || "/";
}

/** Public pages that are the same for everyone, by their own path. */
const PAGES = new Set([
  "/",
  "/feed",
  "/brief",
  "/blog",
  "/newsletters",
  "/agents",
  "/about",
  "/articles",
  "/resources",
  "/tools",
  "/tools/digest-preview",
  "/solutions",
  "/compare",
  "/use-cases",
  "/how-it-works",
  "/contact",
  "/terms",
  "/privacy-policy",
  "/onboarding",
  "/waitlist",
  "/delete-account",
  "/extension/connect",
]);

/** The dynamic public pages, most specific first: [pattern, route, keep the real path]. */
const ROUTES: Array<[RegExp, string, boolean]> = [
  [/^\/featured\/[^/]+\/[^/]+$/, "/featured/[date]/[id]", true],
  [/^\/blog\/category\/[^/]+$/, "/blog/category/[category]", true],
  [/^\/brief\/customize$/, "/brief/customize", true],
  [/^\/brief\/[^/]+$/, "/brief/[date]", true],
  [/^\/blog\/[^/]+$/, "/blog/[slug]", true],
  [/^\/story\/[^/]+$/, "/story/[id]", true],
  [/^\/articles\/[^/]+$/, "/articles/[id]", true],
  [/^\/newsletters\/[^/]+$/, "/newsletters/[slug]", true],
  [/^\/compare\/[^/]+$/, "/compare/[slug]", true],
  [/^\/solutions\/[^/]+$/, "/solutions/[slug]", true],
  [/^\/use-cases\/[^/]+$/, "/use-cases/[slug]", true],
  // A sponsor's own stats page: its id could name the sponsor, so only the route is kept.
  [/^\/sponsor\/[^/]+$/, "/sponsor/[id]", false],
];

/**
 * The path as it may leave the browser and be stored: the real path of a page
 * that is the same for everyone, the route of one that belongs to someone, or
 * null for anything that is not a public page. Idempotent, so the server runs
 * it again on what it receives.
 */
export function publicPath(input: unknown): string | null {
  const path = cleanPath(input);
  if (!path) return null;
  if (PAGES.has(path)) return path;
  for (const [re, route, keep] of ROUTES) if (re.test(path)) return keep ? path : route;
  return null;
}

/** The page a stored path is an instance of ("/brief/[date]"); a static page is its own route. */
export function routeOf(path: string): string {
  for (const [re, route] of ROUTES) if (re.test(path)) return route;
  return path;
}

/** Pages people come to read: a shared story, a day's brief, a featured item, an article. */
export function isReadPath(path: string): boolean {
  return /^\/(story|articles)\/[^/]+$/.test(path) || /^\/featured\/[^/]+\/[^/]+$/.test(path) || (/^\/brief\/[^/]+$/.test(path) && path !== "/brief/customize");
}

/**
 * The routes the first version of these analytics stored ("/blog/[page]"), by
 * the name they have now. Used to read the totals kept before the rollups.
 */
const LEGACY_ROUTES: Record<string, string> = {
  "/blog/[page]": "/blog/[slug]",
  "/brief/[page]": "/brief/[date]",
  "/story/[page]": "/story/[id]",
  "/articles/[page]": "/articles/[id]",
  "/newsletters/[page]": "/newsletters/[slug]",
  "/compare/[page]": "/compare/[slug]",
  "/solutions/[page]": "/solutions/[slug]",
  "/use-cases/[page]": "/use-cases/[slug]",
  "/featured/[page]": "/featured/[date]/[id]",
  "/sponsor/[page]": "/sponsor/[id]",
};

export function legacyRoute(label: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_ROUTES, label) ? LEGACY_ROUTES[label]! : label;
}

/**
 * Where a visit came from: the referrer's host without "www.", or null for a
 * direct visit or one from our own site. Only the host is ever kept.
 */
export function referrerHost(referrer: unknown, ownHosts: readonly string[] = []): string | null {
  if (typeof referrer !== "string" || !referrer.trim()) return null;
  let host: string;
  try {
    const url = new URL(referrer);
    if (url.protocol === "android-app:") host = url.hostname;
    else if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    else host = url.hostname;
  } catch {
    return null;
  }
  host = host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!host || host.length > 80 || !/^[a-z0-9.\-]+$/.test(host)) return null;
  const own = ownHosts.map((h) => h.toLowerCase().replace(/^www\./, ""));
  if (own.includes(host) || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

/** A UTM value: lower case, letters, digits and a few separators, at most 48 characters. */
export function cleanUtm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._\-+ ]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 48);
  return clean || null;
}

/**
 * The key events the dashboard counts, by the name lib/posthog.tsx (or
 * app/brief/ShareBar.tsx, app/brief/customize/NewsletterBuilder.tsx) already
 * sends to PostHog. Everything else that passes through is ignored by the beacon.
 */
export const KEY_EVENTS = {
  $pageview: "pageview",
  newsletter_signup: "newsletter_signup",
  signin_started: "signin_started",
  user_signed_in: "signin_completed",
  user_signed_up: "signup_completed",
  onboarding_completed: "onboarded",
  feed_item_clicked: "item_clicked",
  summary_opened: "summary_opened",
  feed_item_bookmarked: "bookmarked",
  share_initiated: "share",
  daily_edition_shared: "share",
  featured_page_shared: "share",
  retention_caught_up_shared: "share",
  daily_brief_preference_changed: "brief_pref",
  newsletter_preferences_saved: "newsletter_customized",
  checkout_clicked: "checkout_started",
  purchase_completed: "purchase_completed",
} as const;

export type KeyEventName = (typeof KEY_EVENTS)[keyof typeof KEY_EVENTS];
export const KEY_EVENT_NAMES: readonly KeyEventName[] = Array.from(new Set(Object.values(KEY_EVENTS)));

export function keyEventFor(posthogName: string): KeyEventName | null {
  return Object.prototype.hasOwnProperty.call(KEY_EVENTS, posthogName) ? KEY_EVENTS[posthogName as keyof typeof KEY_EVENTS] : null;
}

/** The one property each key event may carry, already cleaned. Never free text, never an id of a person. */
export type EventProps = {
  /**
   * newsletter_signup and checkout_started: the form or button ("feed_prompt"); purchase_completed: the product;
   * share: the channel ("x", "copy"); item_clicked: the item type ("story", "promo"); brief_pref: "on" | "off".
   */
  kind?: string;
};

/** Which browser property each event's kind comes from. Only these leave the browser (lib/analytics/beacon.ts). */
export const PROPS_BY_EVENT: Partial<Record<KeyEventName, readonly string[]>> = {
  newsletter_signup: ["source"],
  checkout_started: ["source"],
  purchase_completed: ["product"],
  share: ["channel"],
  item_clicked: ["item_type"],
  brief_pref: ["enabled"],
};

const SLUG_RE = /^[a-z0-9_\-]{1,40}$/;

/**
 * checkout_clicked also marks the shared-story promo ("Build my feed", components/StorySharePromo.tsx), which
 * opens no checkout. Only these sources are a real checkout (the sponsor slot, components/feed-v2/FeedApp.tsx).
 */
const CHECKOUT_SOURCES = new Set(["tool_promo"]);

/** Whether a cleaned event is one the dashboard counts. */
export function countsAsEvent(event: KeyEventName, props: EventProps): boolean {
  return event !== "checkout_started" || CHECKOUT_SOURCES.has(props.kind ?? "");
}

export function cleanProps(event: KeyEventName, raw: unknown): EventProps {
  const props = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: EventProps = {};
  if (event === "brief_pref") {
    if (typeof props.enabled === "boolean") out.kind = props.enabled ? "on" : "off";
    return out;
  }
  const key = PROPS_BY_EVENT[event]?.[0];
  const value = key ? props[key] : undefined;
  if (typeof value === "string" && SLUG_RE.test(value.toLowerCase())) out.kind = value.toLowerCase();
  else if (event === "share") out.kind = "link";
  return out;
}
