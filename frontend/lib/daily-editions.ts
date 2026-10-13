import { adminFirestore } from '@/lib/firebase-admin';
import type { PoolStory } from '@/lib/newsletter-select';

/**
 * Public daily editions: the non-personalised brief the email pipeline
 * publishes to `daily_editions/{YYYY-MM-DD}` before each send
 * (v3/flows/send_audience_newsletter.py `_publish_edition`).
 */

export const EDITIONS_COLLECTION = 'daily_editions';

export type DailyStory = {
  title: string;
  summary: string;
  url: string;
  source_name: string;
  image: string;
  sources: string[];
  source_count: number;
  lane: string;
  model_release: boolean;
};

export type DailyEdition = {
  date: string;
  headline: string;
  subject: string;
  stories: DailyStory[];
  published_at: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isEditionDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Published today or yesterday (editions are dated in IST). */
export function isFreshEdition(date: string, now: number = Date.now()): boolean {
  return now - Date.parse(`${date}T00:00:00+05:30`) < 2 * 86_400_000;
}

/** "October 12, 2026" — editions are dated in IST, so render the date as-is. */
export function formatEditionDate(date: string, style: 'long' | 'short' = 'long'): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  return parsed.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Only https images: they are hotlinked into pages and emails. */
function httpsUrl(value: unknown): string {
  const url = asText(value);
  if (!url.startsWith('https://')) return '';
  // Some feeds put a video in the thumbnail slot (mirrors NON_IMAGE_RE).
  return /\.(avi|mp4|m4v|mov|webm|m3u8|mpd)(\?|#|$)/i.test(url) ? '' : url;
}

function normalizeEdition(date: string, raw: Record<string, unknown> | undefined): DailyEdition | null {
  if (!raw) return null;
  const stories = (Array.isArray(raw.stories) ? raw.stories : [])
    .map((value): DailyStory | null => {
      if (!value || typeof value !== 'object') return null;
      const story = value as Record<string, unknown>;
      const title = asText(story.title);
      const url = asText(story.url);
      if (!title || !/^https?:\/\//.test(url)) return null;
      return {
        title,
        url,
        summary: asText(story.summary),
        source_name: asText(story.source_name) || sourceHost(url),
        image: httpsUrl(story.image),
        sources: (Array.isArray(story.sources) ? story.sources : []).map(asText).filter(Boolean).slice(0, 4),
        source_count: Math.max(1, Number(story.source_count) || 1),
        lane: asText(story.lane),
        model_release: story.model_release === true,
      };
    })
    .filter((story): story is DailyStory => story !== null);
  if (stories.length === 0) return null;
  return {
    date,
    headline: asText(raw.headline) || 'Today in tech',
    subject: asText(raw.subject),
    stories,
    published_at: asText(raw.published_at),
  };
}

export async function getDailyEdition(date: string): Promise<DailyEdition | null> {
  if (!isEditionDate(date) || !adminFirestore) return null;
  try {
    const snap = await adminFirestore.collection(EDITIONS_COLLECTION).doc(date).get();
    if (!snap.exists) return null;
    return normalizeEdition(date, snap.data() as Record<string, unknown> | undefined);
  } catch (error) {
    console.error('[daily-editions] read failed:', error);
    return null;
  }
}

/** Newest first. Document ids are ISO dates, so id order is date order. */
export async function listDailyEditions(limit = 60): Promise<DailyEdition[]> {
  if (!adminFirestore) return [];
  try {
    // Never the story pool: it is large and only the builder needs it.
    const snap = await adminFirestore
      .collection(EDITIONS_COLLECTION)
      .orderBy('__name__', 'desc')
      .limit(limit)
      .select('headline', 'subject', 'stories', 'published_at')
      .get();
    return snap.docs
      .map((doc) => normalizeEdition(doc.id, doc.data() as Record<string, unknown>))
      .filter((edition): edition is DailyEdition => edition !== null);
  } catch (error) {
    console.error('[daily-editions] list failed:', error);
    return [];
  }
}

/** Dates and publish times only, newest first (sitemap, prev/next links). */
export async function listEditionDates(limit = 365): Promise<{ date: string; published_at: string }[]> {
  if (!adminFirestore) return [];
  try {
    const snap = await adminFirestore
      .collection(EDITIONS_COLLECTION)
      .orderBy('__name__', 'desc')
      .limit(limit)
      .select('published_at', 'story_count')
      .get();
    return snap.docs
      .filter((doc) => isEditionDate(doc.id) && Number((doc.data() as Record<string, unknown>).story_count) > 0)
      .map((doc) => ({ date: doc.id, published_at: asText((doc.data() as Record<string, unknown>).published_at) }));
  } catch (error) {
    console.error('[daily-editions] date list failed:', error);
    return [];
  }
}

function normalizePool(raw: unknown): PoolStory[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value): PoolStory[] => {
    if (!value || typeof value !== 'object') return [];
    const story = value as Record<string, unknown>;
    const topicId = asText(story.topic_id);
    const title = asText(story.title);
    const url = asText(story.url);
    if (!topicId || !title || !/^https?:\/\//.test(url)) return [];
    const verdict = story.send_worthy;
    return [{
      topic_id: topicId,
      title,
      url,
      summary: asText(story.summary),
      source_name: asText(story.source_name) || sourceHost(url),
      image: httpsUrl(story.image),
      sources: (Array.isArray(story.sources) ? story.sources : []).map(asText).filter(Boolean).slice(0, 4),
      source_count: Math.max(1, Number(story.source_count) || 1),
      coverage: Math.max(1, Number(story.coverage) || 1),
      interest_id: asText(story.interest_id).toLowerCase(),
      macro: story.macro === true,
      model_release: story.model_release === true,
      send_worthy: typeof verdict === 'number' ? verdict : null,
    }];
  });
}

/**
 * The story pool behind the newest edition: everything the email selection
 * chose from, for the newsletter builder's preview.
 */
export async function getLatestPool(): Promise<{ date: string; pool: PoolStory[] } | null> {
  if (!adminFirestore) return null;
  try {
    const snap = await adminFirestore
      .collection(EDITIONS_COLLECTION)
      .orderBy('__name__', 'desc')
      .limit(3)
      .get();
    for (const doc of snap.docs) {
      const pool = normalizePool((doc.data() as Record<string, unknown>).pool);
      if (pool.length) return { date: doc.id, pool };
    }
    return null;
  } catch (error) {
    console.error('[daily-editions] pool read failed:', error);
    return null;
  }
}

/** The neighbouring editions, for prev/next links on an edition page. */
export function neighbours(dates: string[], date: string): { newer: string | null; older: string | null } {
  const index = dates.indexOf(date);
  if (index === -1) return { newer: null, older: null };
  return { newer: dates[index - 1] ?? null, older: dates[index + 1] ?? null };
}
