import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { isInstagramStudioAuthorized } from '@/lib/instagram-studio-auth';

type Topic = Record<string, unknown>;

const AI_INTEREST_IDS = new Set(['ai']);
const TECH_INTEREST_IDS = new Set([
  'tech', 'engineering', 'startups', 'business', 'science',
  'ux-design', 'product-design', 'design',
]);
const WORLD_INTEREST_IDS = new Set(['world', 'the-world', 'markets', 'policy', 'politics', 'geopolitics']);

function inferCategory(topic: Topic): 'ai' | 'tech' | 'world' {
  const id = String(topic.interest_id || '').trim().toLowerCase();
  if (AI_INTEREST_IDS.has(id)) return 'ai';
  if (WORLD_INTEREST_IDS.has(id)) return 'world';
  if (TECH_INTEREST_IDS.has(id)) return 'tech';
  return 'tech';
}

function norm(value: unknown): string {
  return String(value || '')
    .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function loadLatestTopics(): Promise<{ date: string; topics: Topic[] }> {
  if (!adminDb) return { date: '', topics: [] };
  const snap = await adminDb
    .collection('v3_user_feeds')
    .doc('_global')
    .collection('daily')
    .orderBy(FieldPath.documentId(), 'desc')
    .limit(1)
    .get();
  if (snap.empty) return { date: '', topics: [] };
  const doc = snap.docs[0];
  const data = doc.data() || {};
  return {
    date: doc.id,
    topics: Array.isArray(data.trending_topics) ? (data.trending_topics as Topic[]) : [],
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!isInstagramStudioAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Server Firebase Admin not configured' }, { status: 500 });
    }

    const { date, topics } = await loadLatestTopics();
    if (!topics.length) {
      return NextResponse.json({ error: 'No topics available' }, { status: 404 });
    }

    const shaped = topics
      .filter((t) => norm(t.title))
      .map((t) => ({
        id: String(t.id || ''),
        title: norm(t.title),
        thumbnail: String(t.thumbnail || ''),
        category: inferCategory(t),
        sourceCount: Number(t.source_count || 0),
        articleCount: Number(t.article_count || 0),
      }))
      .filter((t) => t.id && t.title);

    return NextResponse.json({ ok: true, date, topics: shaped });
  } catch (error) {
    console.error('instagram studio topics error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load topics' },
      { status: 500 },
    );
  }
}
