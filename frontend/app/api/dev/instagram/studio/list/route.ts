import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { isInstagramStudioAuthorized } from '@/lib/instagram-studio-auth';
import { loadStudioNewsFeed } from '@/lib/instagram-studio-feed';

type FeedItem = Record<string, unknown>;

const SECTION_ORDER = ['trending', 'for_you', 'deep_dives'] as const;

function norm(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function stripSlidePrefixes(text: string): string {
  return text.replace(/\bSlide\s*\d+\s*:\s*/gi, '').trim();
}

function toSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function buildCaption(headline: string, subtitle: string, body: string): string {
  const seen = new Set<string>();
  const chunks: string[] = [];
  const pushUnique = (line: string) => {
    const cleaned = stripMarkdown(stripSlidePrefixes(line.trim()));
    if (!cleaned) return;
    const key = norm(cleaned);
    if (!key || key === norm(headline) || seen.has(key)) return;
    seen.add(key);
    chunks.push(cleaned);
  };

  toSentences(stripMarkdown(stripSlidePrefixes(body))).forEach(pushUnique);
  const summary = chunks.join(' ');

  return [stripMarkdown(headline), '', summary || 'Big story to watch today.', '', 'Read more such stories at yourtrace.online'].join('\n');
}

function itemText(item: FeedItem): string {
  const summary = (item.summary && typeof item.summary === 'object' ? item.summary : {}) as Record<string, unknown>;
  const shortArticle =
    summary.short_article && typeof summary.short_article === 'object'
      ? (summary.short_article as Record<string, unknown>)
      : {};
  const slides = Array.isArray(shortArticle.slides) ? shortArticle.slides.join(' ') : '';
  return [
    String(item.title || ''),
    String(shortArticle.subtitle || ''),
    String(shortArticle.body || ''),
    slides,
    String(item.source_name || ''),
    String(item.source || ''),
  ]
    .join(' ')
    .toLowerCase();
}

function itemTopicIds(item: FeedItem): string[] {
  return [item.interest_id, item.subinterest_id, item.category_id]
    .map((v) => String(v || '').toLowerCase().trim())
    .filter(Boolean);
}

function normalizeInterest(v: string): string {
  return v.trim().toLowerCase();
}

function matchesInterest(item: FeedItem, interest: string): boolean {
  if (!interest || interest === 'all') return true;
  const normalized = normalizeInterest(interest);
  const idText = itemTopicIds(item).join(' ');
  const bodyText = itemText(item);
  const exactSlug = normalized.replace(/\s+/g, '-');
  if (idText.includes(exactSlug) || idText.includes(normalized)) return true;
  const tokens = normalized.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (!tokens.length) return false;
  return tokens.every((t) => idText.includes(t) || bodyText.includes(t));
}

function sectionTag(section: string): string {
  if (section === 'trending') return 'AI NEWS';
  if (section === 'for_you') return 'FOR YOU';
  return 'DEEP DIVE';
}

function sectionsForFeedType(feedType: string): string[] {
  if (feedType === 'news') return ['trending'];
  if (feedType === 'for_you') return ['for_you'];
  if (feedType === 'deep_dives') return ['deep_dives'];
  return [...SECTION_ORDER];
}

function collectFromDoc(docData: Record<string, unknown>, interest: string, feedType: string): Array<{ section: string; item: FeedItem }> {
  const pool: Array<{ section: string; item: FeedItem }> = [];
  const allowedSections = new Set(sectionsForFeedType(feedType));
  for (const section of SECTION_ORDER) {
    if (!allowedSections.has(section)) continue;
    const items = docData[section];
    if (!Array.isArray(items)) continue;
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as FeedItem;
      if (matchesInterest(item, interest)) {
        pool.push({ section, item });
      }
    }
  }
  return pool;
}

async function loadGlobalTrendingFeed(interest: string): Promise<Array<{ section: string; item: FeedItem }>> {
  const { forYou, trending } = await loadStudioNewsFeed('developer');
  const out: Array<{ section: string; item: FeedItem }> = [];
  for (const raw of forYou) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as FeedItem;
    if (matchesInterest(item, interest)) out.push({ section: 'for_you', item });
  }
  for (const raw of trending) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as FeedItem;
    if (matchesInterest(item, interest)) out.push({ section: 'trending', item });
  }
  return out;
}

async function loadRecentDailyDocsFromAllUsers(maxDays: number = 2) {
  if (!adminDb) return [];
  const now = new Date();
  const dateIds: string[] = [];
  for (let i = 0; i < maxDays; i += 1) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dateIds.push(d.toISOString().slice(0, 10));
  }
  const userRefs = await adminDb.collection('v3_user_feeds').listDocuments();
  const users = userRefs.filter((ref) => ref.id !== '_global').slice(0, 1500);
  const docs: Array<FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>> = [];
  for (const userRef of users) {
    for (const dateId of dateIds) {
      const snap = await userRef.collection('daily').doc(dateId).get();
      if (snap.exists) {
        docs.push(snap as FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>);
      }
    }
  }
  return docs;
}

export async function GET(request: NextRequest) {
  try {
    if (!isInstagramStudioAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Server Firebase Admin not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const uid = (searchParams.get('uid') || '').trim();
    const scope = (searchParams.get('scope') || 'global').trim().toLowerCase();
    const interest = normalizeInterest(searchParams.get('interest') || 'all');
    const feedType = normalizeInterest(searchParams.get('feedType') || 'news');
    const limit = Math.max(1, Math.min(60, Number(searchParams.get('limit') || '24')));

    const pool: Array<{ section: string; item: FeedItem; feedDate?: string }> = [];

    if (scope === 'user' && uid) {
      const dailySnap = await adminDb
        .collection('v3_user_feeds')
        .doc(uid)
        .collection('daily')
        .orderBy(FieldPath.documentId(), 'desc')
        .limit(1)
        .get();
      if (dailySnap.empty) {
        return NextResponse.json({ error: 'No feed found for this user' }, { status: 404 });
      }
      const latestDoc = dailySnap.docs[0];
      for (const entry of collectFromDoc((latestDoc.data() || {}) as Record<string, unknown>, interest, feedType)) {
        pool.push({ ...entry, feedDate: latestDoc.id });
      }
    } else {
      if (feedType === 'news' || feedType === 'any') {
        for (const entry of await loadGlobalTrendingFeed(interest)) {
          pool.push({ ...entry, feedDate: 'global' });
        }
      }
      if (!pool.length || feedType !== 'news') {
        const docs = await loadRecentDailyDocsFromAllUsers(2);
        for (const doc of docs) {
          for (const entry of collectFromDoc((doc.data() || {}) as Record<string, unknown>, interest, feedType)) {
            pool.push({ ...entry, feedDate: doc.id });
          }
        }
      }
    }

    const seen = new Set<string>();
    const stories = [];
    for (const { section, item, feedDate } of pool) {
      const title = String(item.title || item.headline || '').trim();
      if (!title) continue;
      const sourceUrl = String(item.url || '').trim();
      const dedupeKey = `${norm(title)}|${sourceUrl || ''}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const summary = (item.summary && typeof item.summary === 'object' ? item.summary : {}) as Record<string, unknown>;
      const shortArticle =
        summary.short_article && typeof summary.short_article === 'object'
          ? (summary.short_article as Record<string, unknown>)
          : {};
      const subtitle = String(shortArticle.subtitle || '').trim();
      const slides = Array.isArray(shortArticle.slides) ? shortArticle.slides : [];
      const rawBody = String(shortArticle.body || '').trim();
      const body = slides.length ? slides.join(' ') : (rawBody.length > 100 ? rawBody : subtitle);

      const imageUrl = String(item.thumbnail || item.image_url || item.image || '').trim();
      stories.push({
        id: String(item.id || `${feedDate || 'd'}-${stories.length + 1}`),
        tag: sectionTag(section),
        headline: title,
        caption: buildCaption(title, subtitle, body),
        imageUrl: imageUrl || `${new URL(request.url).origin}/feed.webp`,
        sourceName: String(item.source_name || item.source || 'Unknown source'),
        sourceUrl,
        section,
        feedDate: feedDate || 'unknown',
      });

      if (stories.length >= limit) break;
    }

    return NextResponse.json({
      ok: true,
      count: stories.length,
      stories,
    });
  } catch (error) {
    console.error('instagram studio list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load stories list' },
      { status: 500 }
    );
  }
}
