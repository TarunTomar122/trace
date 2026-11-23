import { readSnapshotFile } from "./snapshot-file.ts";

/**
 * The Signups tab of /admin/analytics: everyone who signed up, newsletter readers and accounts together, newest
 * first. The snapshot job (backend/vps/trace-analytics-snapshot.py) joins Firebase Auth, user_profiles and
 * free_newsletter_subscribers every 5 minutes; this module shape-checks its `signups` block and works out the
 * today / 7 days / 30 days tiles from every signup time at render, so the hour bars follow the clock.
 *
 * Ported from StocksBrew's lib/analytics/signups.ts. Trace has no stocks or agents: its own numbers are the
 * newsletter, accounts, readers' links and paid plans. A field we don't have stays null (shown blank), never zero.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Older than this, the page says the snapshot job stopped (it runs every 5 minutes). */
export const SIGNUPS_STALE_MS = 20 * 60 * 1000;

export type Method = "google" | "apple" | "email" | "phone" | "other";
export type PlanKind = "paid" | "trial" | "free";
export type SignupKind = "newsletter" | "account" | "both";

export type SignupRow = {
  id: string;
  email: string | null;
  name: string | null;
  photo: string | null;
  createdMs: number | null;
  kind: SignupKind;
  method: Method | null;
  plan: PlanKind | null;
  /** A word on the plan for the hover title ("cancels at period end", "on hold"), or null. */
  planNote: string | null;
  paying: boolean;
  /** The newsletter: "on" subscribed, "off" left, null not a reader. */
  newsletter: "on" | "off" | null;
  lastSeenMs: number | null;
  /** Seen again a day or more after signing up; null while under a day old, or for a reader without an account. */
  cameBack: boolean | null;
  /** A channel id (first touch, utm tag, "referral", "affiliate") or, with `heard`, their own "How did you hear?" answer. */
  from: { id: string; heard: boolean } | null;
  /** The newsletter form ("landing_page", "daily_page", ...) or "app", "app_web", "app_mobile". */
  form: string | null;
};

export type SignupsView = {
  generatedMs: number | null;
  total: number;
  firstMs: number | null;
  /** Today (UTC) so far, by hour, against yesterday by the same hour. */
  today: { count: number; yesterday: number; hours: number[] };
  week: { count: number; previous: number; days: number[] };
  month: { count: number; previous: number; days: number[] };
  newsletter: { active: number; total: number };
  /** cameBack out of the accounts at least a day old (eligible). */
  accounts: { total: number; cameBack: number; eligible: number };
  /** People who signed up through a reader's share link, and how many readers' links brought them. */
  referred: { count: number; readers: number };
  /** On a paid plan or trial now; paying: with a live subscription; lapsed: a plan that ended or is on hold. */
  paid: { count: number; paying: number; trial: number; lapsed: number };
  /** The newest rows (the snapshot keeps 500); rowsTotal counts everyone. */
  rows: SignupRow[];
  rowsTotal: number;
  authMissing: boolean;
};

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const obj = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | null => (allowed.includes(value as T) ? (value as T) : null);

const METHODS = ["google", "apple", "email", "phone", "other"] as const;
const PLANS = ["paid", "trial", "free"] as const;
const KINDS = ["newsletter", "account", "both"] as const;

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Counts per bucket: bucket i holds [start + i * size, start + (i + 1) * size). */
function buckets(times: readonly number[], start: number, size: number, count: number): number[] {
  const out = new Array<number>(count).fill(0);
  for (const ms of times) {
    const index = Math.floor((ms - start) / size);
    if (index >= 0 && index < count) out[index]! += 1;
  }
  return out;
}

function rowOf(raw: unknown): SignupRow | null {
  const r = obj(raw);
  const id = str(r.id);
  const kind = pick(r.kind, KINDS);
  if (!id || !kind) return null;
  const from = obj(r.from);
  return {
    id,
    email: str(r.email),
    name: str(r.name),
    photo: str(r.photo),
    createdMs: num(r.createdMs),
    kind,
    method: pick(r.method, METHODS),
    plan: pick(r.plan, PLANS),
    planNote: str(r.planNote),
    paying: r.paying === true,
    newsletter: pick(r.newsletter, ["on", "off"] as const),
    lastSeenMs: num(r.lastSeenMs),
    cameBack: typeof r.cameBack === "boolean" ? r.cameBack : null,
    from: str(from.id) ? { id: str(from.id)!.slice(0, 40), heard: from.heard === true } : null,
    form: str(r.form),
  };
}

/** The snapshot's `signups` block, shape-checked, with the time tiles worked out for `now`. Null when it is missing. */
export function parseSignups(raw: unknown, now: number): SignupsView | null {
  const s = obj(raw);
  if (!Array.isArray(s.rows) || !Array.isArray(s.created)) return null;
  const created = s.created.map(num).filter((ms): ms is number => ms != null && ms <= now);
  const todayStart = Date.parse(`${utcDay(now)}T00:00:00.000Z`);
  const sinceMidnight = now - todayStart;
  const countIn = (start: number, end: number) => created.filter((ms) => ms >= start && ms < end).length;
  const weekStart = todayStart - 6 * DAY_MS;
  const monthStart = todayStart - 29 * DAY_MS;
  const rows = s.rows.map(rowOf).filter((row): row is SignupRow => row != null);
  const newsletter = obj(s.newsletter);
  const accounts = obj(s.accounts);
  const referred = obj(s.referred);
  const paid = obj(s.paid);
  const generated = str(s.generatedAt);
  return {
    generatedMs: generated ? Date.parse(generated) || null : null,
    total: num(s.total) ?? created.length,
    firstMs: created.length ? created.reduce((a, b) => Math.min(a, b)) : null,
    today: {
      count: countIn(todayStart, now + 1),
      // Like with like: yesterday up to the same minute.
      yesterday: countIn(todayStart - DAY_MS, todayStart - DAY_MS + sinceMidnight + 1),
      hours: buckets(created, todayStart, HOUR_MS, Math.floor(sinceMidnight / HOUR_MS) + 1),
    },
    // The periods before end at the same time of their last day, as the Visitors tab compares them.
    week: { count: countIn(weekStart, now + 1), previous: countIn(weekStart - 7 * DAY_MS, weekStart - DAY_MS + sinceMidnight + 1), days: buckets(created, weekStart, DAY_MS, 7) },
    month: { count: countIn(monthStart, now + 1), previous: countIn(monthStart - 30 * DAY_MS, monthStart - DAY_MS + sinceMidnight + 1), days: buckets(created, monthStart, DAY_MS, 30) },
    newsletter: { active: num(newsletter.active) ?? 0, total: num(newsletter.total) ?? 0 },
    accounts: { total: num(accounts.total) ?? 0, cameBack: num(accounts.cameBack) ?? 0, eligible: num(accounts.eligible) ?? 0 },
    referred: { count: num(referred.count) ?? 0, readers: num(referred.readers) ?? 0 },
    paid: { count: num(paid.count) ?? 0, paying: num(paid.paying) ?? 0, trial: num(paid.trial) ?? 0, lapsed: num(paid.lapsed) ?? 0 },
    rows,
    rowsTotal: num(s.rowsTotal) ?? rows.length,
    authMissing: s.authMissing === true,
  };
}

/** The tab's data from the snapshot file, or null when there is no file or no `signups` block in it yet. */
export async function loadSignupsView(now: number = Date.now()): Promise<SignupsView | null> {
  const snapshot = await readSnapshotFile();
  return snapshot ? parseSignups(snapshot.signups, now) : null;
}

/** Where a signup came from, in words, and the site whose icon to show (null: a drawn icon). */
export const FROM_WORDS: Record<string, { label: string; host: string | null }> = {
  google: { label: "Google", host: "google.com" },
  "google-news": { label: "Google News", host: "news.google.com" },
  gmail: { label: "Gmail", host: "mail.google.com" },
  gemini: { label: "Gemini", host: "gemini.google.com" },
  bing: { label: "Bing", host: "bing.com" },
  duckduckgo: { label: "DuckDuckGo", host: "duckduckgo.com" },
  chatgpt: { label: "ChatGPT", host: "chatgpt.com" },
  perplexity: { label: "Perplexity", host: "perplexity.ai" },
  claude: { label: "Claude", host: "claude.ai" },
  x: { label: "X", host: "x.com" },
  twitter: { label: "X", host: "x.com" },
  hackernews: { label: "Hacker News", host: "news.ycombinator.com" },
  reddit: { label: "Reddit", host: "reddit.com" },
  youtube: { label: "YouTube", host: "youtube.com" },
  tiktok: { label: "TikTok", host: "tiktok.com" },
  instagram: { label: "Instagram", host: "instagram.com" },
  facebook: { label: "Facebook", host: "facebook.com" },
  linkedin: { label: "LinkedIn", host: "linkedin.com" },
  threads: { label: "Threads", host: "threads.net" },
  bluesky: { label: "Bluesky", host: "bsky.app" },
  github: { label: "GitHub", host: "github.com" },
  producthunt: { label: "Product Hunt", host: "producthunt.com" },
  substack: { label: "Substack", host: "substack.com" },
  peerpush: { label: "PeerPush", host: "peerpush.net" },
  direct: { label: "Direct", host: "(direct)" },
  referral: { label: "A reader's link", host: null },
  friend: { label: "A friend", host: null },
  affiliate: { label: "Affiliate link", host: null },
  blog: { label: "Our blog", host: null },
  badge: { label: "Trace badge", host: null },
  site: { label: "Our site", host: null },
  trace: { label: "Our site", host: null },
  yourtrace: { label: "Our site", host: null },
  other: { label: "Other", host: null },
};

export function fromWords(from: NonNullable<SignupRow["from"]>): { label: string; host: string | null } {
  const known = FROM_WORDS[from.id];
  if (known) return known;
  // A first-touch channel that is a referring host ("example.com") keeps its name and icon.
  return { label: from.id, host: from.id.includes(".") ? from.id : null };
}

export const FORM_WORDS: Record<string, string> = {
  landing_page: "Home page",
  daily_page: "Brief pages",
  featured_page: "Featured page",
  blog: "Blog",
  feed_prompt: "Feed prompt",
  app: "App",
  app_web: "Web app",
  app_mobile: "Mobile app",
};

export function formWords(form: string | null): string {
  return form ? FORM_WORDS[form] ?? form.replace(/_/g, " ") : "";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "just now", "12 min ago", "3 h ago", "4 days ago", "2 months ago". Empty for an unknown time. */
export function agoText(ms: number | null | undefined, now: number): string {
  if (ms == null || !Number.isFinite(ms)) return "";
  const minutes = Math.max(0, Math.floor((now - ms) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return days === 1 ? "1 day ago" : `${days} days ago`;
  const months = Math.round(days / 30.4);
  if (months < 24) return `${months} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/** The UTC day, like the rest of the page: "Nov 12", or "Nov 12, 2025" in another year. Empty for an unknown time. */
export function dayText(ms: number | null | undefined, now: number): string {
  if (ms == null || !Number.isFinite(ms)) return "";
  const day = utcDay(ms);
  const label = `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
  return day.slice(0, 4) === utcDay(now).slice(0, 4) ? label : `${label}, ${day.slice(0, 4)}`;
}

/** For a hover title: "Nov 12, 2026, 14:05 UTC". */
export function stampText(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "";
  const iso = new Date(ms).toISOString();
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}, ${iso.slice(11, 16)} UTC`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The UTC calendar day in words, under the "3 h ago" line: "today", "yesterday", the weekday within the last
 * week, and the date ("Nov 2") past that. Empty for an unknown time.
 */
export function dayWordsUtc(ms: number | null | undefined, now: number): string {
  if (ms == null || !Number.isFinite(ms)) return "";
  const gap = Math.round((Date.parse(`${utcDay(now)}T00:00:00Z`) - Date.parse(`${utcDay(ms)}T00:00:00Z`)) / DAY_MS);
  if (gap <= 0) return "today";
  if (gap === 1) return "yesterday";
  if (gap <= 6) return WEEKDAYS[new Date(ms).getUTCDay()]!;
  return dayText(ms, now);
}
