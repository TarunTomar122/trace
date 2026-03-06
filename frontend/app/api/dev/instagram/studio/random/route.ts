import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { isInstagramStudioAuthorized } from '@/lib/instagram-studio-auth';

type FeedItem = Record<string, unknown>;

const SECTION_ORDER = ['trending', 'for_you', 'deep_dives'] as const;

function norm(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** -> bold
    .replace(/\*([^*]+)\*/g, '$1')      // *italic* -> italic
    .replace(/__([^_]+)__/g, '$1')      // __bold__ -> bold
    .replace(/_([^_]+)_/g, '$1')        // _italic_ -> italic
    .replace(/`([^`]+)`/g, '$1')        // `code` -> code
    .replace(/#{1,6}\s*/g, '')          // ## headers -> remove
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [link](url) -> link
    .trim();
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
    const cleaned = stripMarkdown(line.trim());
    if (!cleaned) return;
    const key = norm(cleaned);
    if (!key) return;
    if (key === norm(headline)) return;
    if (seen.has(key)) return;
    seen.add(key);
    chunks.push(cleaned);
  };

  pushUnique(subtitle);
  toSentences(stripMarkdown(body)).forEach(pushUnique);

  const summary = chunks.join(' ');
  return [stripMarkdown(headline), '', summary || 'Big story to watch today.', '', 'Read more such stories at yourtrace.online'].join(
    '\n'
  );
}

function itemText(item: FeedItem): string {
  const summary = (item.summary && typeof item.summary === 'object' ? item.summary : {}) as Record<string, unknown>;
  const shortArticle =
    summary.short_article && typeof summary.short_article === 'object'
      ? (summary.short_article as Record<string, unknown>)
      : {};
  // Handle slides for trending items
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

function pickRandomItem(docData: Record<string, unknown>, interest: string, feedType: string): { section: string; item: FeedItem } | null {
  const pool: Array<{ section: string; item: FeedItem }> = [];
  const allowedSections = new Set(sectionsForFeedType(feedType));
  for (const section of SECTION_ORDER) {
    if (!allowedSections.has(section)) continue;
    const items = docData[section];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (item && typeof item === 'object') {
        const typed = item as FeedItem;
        if (matchesInterest(typed, interest)) {
          pool.push({ section, item: typed });
        }
      }
    }
  }
  if (!pool.length) return null;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

function collectItemsFromDoc(docData: Record<string, unknown>, interest: string, feedType: string): Array<{ section: string; item: FeedItem }> {
  const pool: Array<{ section: string; item: FeedItem }> = [];
  const allowedSections = new Set(sectionsForFeedType(feedType));
  for (const section of SECTION_ORDER) {
    if (!allowedSections.has(section)) continue;
    const items = docData[section];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const typed = item as FeedItem;
      if (matchesInterest(typed, interest)) {
        pool.push({ section, item: typed });
      }
    }
  }
  return pool;
}

async function loadGlobalTrendingFeed(): Promise<Array<{ section: string; item: FeedItem }>> {
  if (!adminDb) return [];
  const globalRef = adminDb
    .collection('v3_user_feeds')
    .doc('_global')
    .collection('daily');
  const snap = await globalRef.orderBy(FieldPath.documentId(), 'desc').limit(1).get();
  if (snap.empty) return [];
  const data = snap.docs[0].data() || {};
  const trending = Array.isArray(data.trending) ? data.trending : [];
  return trending.map((item: FeedItem) => ({ section: 'trending', item }));
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
  // Filter out _global from user refs
  const users = userRefs.filter(ref => ref.id !== '_global').slice(0, 1500); // Dev safeguard
  const docs: Array<FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>> = [];
  for (const userRef of users) {
    for (const dateId of dateIds) {
      const dailyRef = userRef.collection('daily').doc(dateId);
      const snap = await dailyRef.get();
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
    const requestedInterest = normalizeInterest(searchParams.get('interest') || 'all');
    const requestedFeedType = normalizeInterest(searchParams.get('feedType') || 'any');
    let picked: { section: string; item: FeedItem } | null = null;
    let sourceFeedDate = '';

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
      const data = (latestDoc.data() || {}) as Record<string, unknown>;
      picked = pickRandomItem(data, requestedInterest, requestedFeedType);
      sourceFeedDate = latestDoc.id;
    } else {
      // For news/trending, use the global feed first
      if (requestedFeedType === 'news' || requestedFeedType === 'any') {
        const globalTrending = await loadGlobalTrendingFeed();
        const filtered = globalTrending.filter(({ item }) => matchesInterest(item, requestedInterest));
        if (filtered.length) {
          picked = filtered[Math.floor(Math.random() * filtered.length)];
          sourceFeedDate = 'global';
        }
      }

      // Fallback to user feeds for for_you/deep_dives or if no global trending
      if (!picked) {
        const docs = await loadRecentDailyDocsFromAllUsers(2);
        const globalPool: Array<{ section: string; item: FeedItem }> = [];
        for (const doc of docs) {
          globalPool.push(...collectItemsFromDoc((doc.data() || {}) as Record<string, unknown>, requestedInterest, requestedFeedType));
        }
        if (globalPool.length) {
          picked = globalPool[Math.floor(Math.random() * globalPool.length)];
          sourceFeedDate = docs[0]?.id || 'unknown';
        }
      }
    }

    if (!picked) {
      return NextResponse.json(
        {
          error: `No stories found for interest "${requestedInterest}" in ${requestedFeedType} feed (${scope})`,
        },
        { status: 404 }
      );
    }

    const item = picked.item;
    const title = String(item.title || item.headline || '').trim();
    if (!title) {
      return NextResponse.json({ error: 'Selected story had no title' }, { status: 500 });
    }

    const summary = (item.summary && typeof item.summary === 'object' ? item.summary : {}) as Record<string, unknown>;
    const shortArticle =
      summary.short_article && typeof summary.short_article === 'object'
        ? (summary.short_article as Record<string, unknown>)
        : {};
    const subtitle = String(shortArticle.subtitle || '').trim();
    // Handle slides for trending items - prefer slides over short body
    const slides = Array.isArray(shortArticle.slides) ? shortArticle.slides : [];
    const rawBody = String(shortArticle.body || '').trim();
    const body = slides.length ? slides.join(' ') : (rawBody.length > 100 ? rawBody : subtitle);

    const sourceName = String(item.source_name || item.source || 'Unknown source');
    const sourceUrl = String(item.url || '');
    const imageUrl = String(item.thumbnail || item.image_url || item.image || '').trim();
    const fallbackImageUrl = `${new URL(request.url).origin}/feed.webp`;

    return NextResponse.json({
      ok: true,
      story: {
        tag: sectionTag(picked.section),
        headline: title,
        caption: buildCaption(title, subtitle, body),
        imageUrl: imageUrl || fallbackImageUrl,
        sourceName,
        sourceUrl,
        section: picked.section,
        feedDate: sourceFeedDate || 'unknown',
      },
    });
  } catch (error) {
    console.error('instagram studio random error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate random story' },
      { status: 500 }
    );
  }
}
