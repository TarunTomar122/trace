import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

function normalizeInterest(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((v) => v.charAt(0).toUpperCase() + v.slice(1))
    .join(' ');
}

function collectInterestsFromFeedDoc(data: Record<string, unknown>): string[] {
  const sections = ['trending', 'for_you', 'deep_dives'];
  const out: string[] = [];
  for (const section of sections) {
    const items = data[section];
    if (!Array.isArray(items)) continue;
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const rawId = String(item.interest_id || item.subinterest_id || item.category_id || '').trim();
      if (rawId) out.push(toTitleCase(rawId));
    }
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
  const users = userRefs.slice(0, 1500); // Dev safeguard
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
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Server Firebase Admin not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const uid = (searchParams.get('uid') || '').trim();
    const scope = (searchParams.get('scope') || 'global').trim().toLowerCase();
    let interests: string[] = [];

    if (scope === 'user' && uid) {
      const doc = await adminDb.collection('user_profiles').doc(uid).get();
      const data = (doc.data() || {}) as Record<string, unknown>;
      const rawInterests = Array.isArray(data.interests) ? data.interests : [];
      interests = Array.from(
        new Set(
          rawInterests
            .map((v) => normalizeInterest(String(v || '')))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));
    } else {
      const snaps = await loadRecentDailyDocsFromAllUsers(2);
      const raw: string[] = [];
      for (const doc of snaps) {
        raw.push(...collectInterestsFromFeedDoc((doc.data() || {}) as Record<string, unknown>));
      }
      interests = Array.from(new Set(raw.map(normalizeInterest).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    }

    return NextResponse.json({
      ok: true,
      interests,
      feedTypes: ['any', 'news', 'for_you'],
    });
  } catch (error) {
    console.error('instagram studio options error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch options' },
      { status: 500 }
    );
  }
}
