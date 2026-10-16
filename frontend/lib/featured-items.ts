import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { adminFirestore } from '@/lib/firebase-admin';
import { isEditionDate, sourceHost } from '@/lib/daily-editions';
import { imageUrlHasPlaceholderToken } from '@/lib/media-url';
import { SITE_BASE_URL } from '@/lib/seo';

/**
 * "Featured on Trace" share pages: one per item in a day's Tools and Top
 * articles (`v3_user_feeds/_global/daily/{date}` → `daily_pulse_roles.developer`,
 * built by backend/v3/build_daily_pulse.py). The pulse rewrites those lists
 * every 3 hours, so the founder's daily post job (backend/v3/flows/build_post_kit.py)
 * copies what it featured to the same doc's `featured_items`: a shared link
 * keeps working after the item leaves the list. Read-only.
 */

export type FeaturedSection = 'tools' | 'discussions';

export type FeaturedItem = {
  id: string;
  date: string;
  section: FeaturedSection;
  title: string;
  url: string;
  summary: string;
  source: string;
  signal: string;
  image: string;
};

/** What the feed calls each list. */
export const FEATURED_LABELS: Record<FeaturedSection, string> = {
  tools: 'Tools',
  discussions: 'Top articles',
};

const SECTIONS: FeaturedSection[] = ['tools', 'discussions'];
// Pulse ids are 16 hex characters; anything outside this shape is not ours.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function featuredUrl(date: string, id: string): string {
  return `${SITE_BASE_URL}/featured/${date}/${encodeURIComponent(id)}`;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Only https images (they are hotlinked), never placeholders or videos. */
function imageUrl(value: unknown): string {
  const url = asText(value);
  if (!url.startsWith('https://') || imageUrlHasPlaceholderToken(url)) return '';
  return /\.(avi|mp4|m4v|mov|webm|m3u8|mpd)(\?|#|$)/i.test(url) ? '' : url;
}

/** A pulse item, or the post kit's copy of one (its summary is `{ body }`). */
function normalizeItem(date: string, section: FeaturedSection, raw: unknown): FeaturedItem | null {
  const item = asObject(raw);
  const id = asText(item.id);
  const title = asText(item.title);
  const url = asText(item.url);
  if (!ID_RE.test(id) || !title || !/^https?:\/\//.test(url)) return null;
  const summary = asObject(item.summary);
  return {
    id,
    date,
    section,
    title,
    url,
    summary: (asText(asObject(summary.short_article).body) || asText(summary.body) || asText(item.summary)).replace(/\*\*/g, ''),
    source: asText(item.source) || sourceHost(url),
    signal: asText(item.signal),
    image: imageUrl(item.thumbnail),
  };
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The day's live lists first, then anything the post kit featured that has since dropped off. */
async function readFeaturedDay(date: string): Promise<FeaturedItem[]> {
  if (!adminFirestore || !isEditionDate(date)) return [];
  const snap = await adminFirestore.collection('v3_user_feeds').doc('_global').collection('daily').doc(date).get();
  if (!snap.exists) return [];
  const data = asObject(snap.data());
  const pulse = asObject(asObject(data.daily_pulse_roles).developer);
  const items: FeaturedItem[] = [];
  const seen = new Set<string>();
  const add = (section: FeaturedSection, raw: unknown) => {
    const item = normalizeItem(date, section, raw);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  };
  for (const section of SECTIONS) asList(pulse[section]).forEach((raw) => add(section, raw));
  for (const raw of asList(data.featured_items)) {
    const section = asObject(raw).section;
    if (section === 'tools' || section === 'discussions') add(section, raw);
  }
  return items;
}

// One read of a day's doc per 10 minutes across requests (only the small list
// is cached), and once per render for the page, its metadata and its image.
const getFeaturedDay = cache(unstable_cache(readFeaturedDay, ['featured-day-v1'], { revalidate: 600 }));

export async function getFeaturedItem(date: string, id: string): Promise<FeaturedItem | null> {
  if (!isEditionDate(date) || !ID_RE.test(id)) return null;
  try {
    return (await getFeaturedDay(date)).find((item) => item.id === id) ?? null;
  } catch (error) {
    console.error('[featured-items] read failed:', error);
    return null;
  }
}
