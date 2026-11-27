import { unstable_cache } from 'next/cache';
import { channelOf } from '@/lib/first-touch';

// PostHog numbers for a sponsor's stats page (/sponsor/[id]): who clicked
// (country, device, how they came to Trace) and who visited Trace during the
// sponsor's run. HogQL queries that count in PostHog, cached for 10 minutes
// per sponsor. PostHog misses visitors who block analytics, so these are
// breakdowns, not the counts: clicks and views come from Trace's own tallies
// (sponsor_clicks, sponsor_views).

export type Breakdown = { label: string; count: number }[];

export type ClickAudience = {
  /** Clicks PostHog saw: can be lower than Trace's own count. */
  clicks: number;
  people: number;
  countries: Breakdown;
  devices: Breakdown;
  sources: Breakdown;
};

export type SiteAudience = {
  visitors: number;
  pageviews: number;
  /** Visitors who opened the feed, a story or a Trace Daily page (where sponsor cards sit). */
  sawSpots: number;
  countries: Breakdown;
  devices: Breakdown;
  sources: Breakdown;
};

export type SponsorAudience = { clicks: ClickAudience; site: SiteAudience };

const TOP = 6;
/** Sources smaller than this fold into "Other", so a single visitor's odd referrer isn't listed. */
const MIN_SOURCE = 2;
const TIMEOUT_MS = 8_000;
let projectId: string | null = null;

/** True when the analytics key is set, i.e. the breakdowns can exist at all. */
export const audienceConfigured = () => Boolean((process.env.POSTHOG_PERSONAL_API_KEY || '').trim());

async function hogql(query: string): Promise<unknown[][]> {
  const key = (process.env.POSTHOG_PERSONAL_API_KEY || '').trim();
  if (!key) throw new Error('POSTHOG_PERSONAL_API_KEY is not set');
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (!projectId) {
    const res = await fetch(`${host}/api/projects/`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`PostHog projects: ${res.status}`);
    const id = (await res.json())?.results?.[0]?.id;
    if (!id) throw new Error('PostHog: no project');
    projectId = String(id);
  }
  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`PostHog query: ${res.status}`);
  const rows = (await res.json())?.results;
  if (!Array.isArray(rows)) throw new Error('PostHog query: no results');
  return rows;
}

/** HogQL datetime literal for a Date (UTC, second precision). */
const at = (d: Date) => `toDateTime('${d.toISOString().slice(0, 19).replace('T', ' ')}')`;

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Daily email', direct: 'Direct or unknown', referral: 'A reader’s share link', google: 'Google', gmail: 'Gmail',
  'google-news': 'Google News', gemini: 'Gemini', bing: 'Bing', duckduckgo: 'DuckDuckGo', chatgpt: 'ChatGPT',
  'chatgpt.com': 'ChatGPT', perplexity: 'Perplexity', claude: 'Claude', x: 'X', twitter: 'X', hackernews: 'Hacker News',
  reddit: 'Reddit', youtube: 'YouTube', yt: 'YouTube', tiktok: 'TikTok', tt: 'TikTok', instagram: 'Instagram', ig: 'Instagram',
  facebook: 'Facebook', linkedin: 'LinkedIn', threads: 'Threads', bluesky: 'Bluesky', github: 'GitHub',
  producthunt: 'Product Hunt', substack: 'Substack', other: 'Other',
};

/** How a visitor came to Trace: their session's first URL (or just its query) and referring domain. */
export function sourceOf(entryUrl: unknown, referringDomain: unknown): string {
  let search = '';
  try {
    search = new URL(String(entryUrl || '')).search;
  } catch {
    // No URL: the referrer decides.
  }
  const domain = String(referringDomain || '').trim();
  const referrer = domain && domain !== '$direct' ? `https://${domain}/` : '';
  const channel = channelOf(search, referrer, 'yourtrace.online') ?? 'direct';
  if (channel.startsWith('email')) return channel === 'email' ? 'Daily email' : 'A shared email';
  return CHANNEL_LABELS[channel] ?? channel;
}

/** Sums counts by label, keeps the top rows and folds the rest (and rows under `min`) into "Other". */
export function rank(pairs: [string, number][], min = 1): Breakdown {
  const counts = new Map<string, number>();
  for (const [label, count] of pairs) counts.set(label, (counts.get(label) || 0) + count);
  const sorted = [...counts.entries()].filter(([l]) => l !== 'Other').sort((a, b) => b[1] - a[1]);
  const keep = sorted.filter(([, c], i) => i < TOP && c >= min);
  const folded = (counts.get('Other') || 0) + sorted.filter((row) => !keep.includes(row)).reduce((t, [, c]) => t + c, 0);
  const rows = keep.map(([label, count]) => ({ label, count }));
  return folded > 0 ? [...rows, { label: 'Other', count: folded }] : rows;
}

const text = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
/** Countries are ISO codes ("GB"; "??" unknown), devices desktop / mobile / tablet / unknown: the page adds flags and icons. */
const country = (v: unknown) => (typeof v === 'string' && /^[A-Z]{2}$/.test(v) ? v : '??');
const device = (v: unknown) => {
  const key = text(v, '').toLowerCase();
  return ['desktop', 'mobile', 'tablet'].includes(key) ? key : 'unknown';
};
/** Email and new-tab clicks are counted on our server: no browser, so no country or device. */
export const SERVER_CLICK = 'server';
// The session's first URL reduced to its query string, so rows group by what decides the source.
const ENTRY_QUERY = "concat('https://x/?', splitByChar('?', coalesce(properties.$session_entry_url, ''))[2])";

async function clickAudience(id: string, from: Date, to: Date): Promise<ClickAudience> {
  const where = `event = 'sponsored_tool_clicked' AND properties.sponsor_id = '${id}'
        AND timestamp >= ${at(from)} AND timestamp < ${at(to)}`;
  const [rows, people] = await Promise.all([
    hogql(
      `SELECT properties.placement, properties.$geoip_country_code, properties.$device_type,
              properties.$session_entry_referring_domain, ${ENTRY_QUERY}, count()
         FROM events WHERE ${where}
        GROUP BY 1, 2, 3, 4, 5
        LIMIT 5000`,
    ),
    hogql(`SELECT count(DISTINCT person_id) FROM events WHERE ${where}`),
  ]);
  const server = (p: unknown) => (p === 'email' ? 'Daily email' : p === 'extension' ? 'Chrome new tab' : '');
  return {
    clicks: rows.reduce((t, r) => t + Number(r[5] || 0), 0),
    people: Number(people[0]?.[0] || 0),
    countries: rank(rows.map((r) => [server(r[0]) ? SERVER_CLICK : country(r[1]), Number(r[5] || 0)])),
    devices: rank(rows.map((r) => [server(r[0]) ? SERVER_CLICK : device(r[2]), Number(r[5] || 0)])),
    sources: rank(rows.map((r) => [server(r[0]) || sourceOf(r[4], r[3]), Number(r[5] || 0)]), MIN_SOURCE),
  };
}

async function siteAudience(from: Date, to: Date): Promise<SiteAudience> {
  // Each visitor once, by how they first arrived during the run; then counted by
  // (country, device, referrer, query) in PostHog, so few rows come back.
  const rows = await hogql(
    `SELECT country, device, referrer, query, count(), sum(views), countIf(spots > 0)
       FROM (
         SELECT person_id,
                argMin(properties.$geoip_country_code, timestamp) AS country,
                argMin(properties.$device_type, timestamp) AS device,
                argMin(properties.$session_entry_referring_domain, timestamp) AS referrer,
                argMin(${ENTRY_QUERY}, timestamp) AS query,
                count() AS views,
                countIf(properties.$pathname = '/feed' OR properties.$pathname LIKE '/brief/%' OR properties.$pathname LIKE '/story/%') AS spots
           FROM events
          WHERE event = '$pageview' AND properties.$host ILIKE '%yourtrace.online%'
            AND timestamp >= ${at(from)} AND timestamp < ${at(to)}
          GROUP BY person_id
       )
      GROUP BY 1, 2, 3, 4
      LIMIT 10000`,
  );
  return {
    visitors: rows.reduce((t, r) => t + Number(r[4] || 0), 0),
    pageviews: rows.reduce((t, r) => t + Number(r[5] || 0), 0),
    sawSpots: rows.reduce((t, r) => t + Number(r[6] || 0), 0),
    countries: rank(rows.map((r) => [country(r[0]), Number(r[4] || 0)])),
    devices: rank(rows.map((r) => [device(r[1]), Number(r[4] || 0)])),
    sources: rank(rows.map((r) => [sourceOf(r[3], r[2]), Number(r[4] || 0)]), MIN_SOURCE),
  };
}

/**
 * Breakdowns for one sponsor's run, from its start to now or its end (`endIso`,
 * empty for none), whichever is first. Both arguments stay fixed for a run, so
 * the cache key does too. Throws when PostHog fails, so a failure isn't cached;
 * the caller shows the page without these.
 */
export const sponsorAudience = unstable_cache(
  async (id: string, startIso: string, endIso: string): Promise<SponsorAudience> => {
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new Error('bad sponsor id');
    const from = new Date(startIso);
    const end = endIso ? new Date(endIso) : null;
    const to = end && end.getTime() < Date.now() ? end : new Date();
    if (Number.isNaN(from.getTime()) || from >= to) throw new Error('empty run');
    const [clicks, site] = await Promise.all([clickAudience(id, from, to), siteAudience(from, to)]);
    return { clicks, site };
  },
  ['sponsor-audience-v3'],
  { revalidate: 600 },
);
