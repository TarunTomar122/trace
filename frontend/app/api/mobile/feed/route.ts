import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { getBootstrapFeedForUid } from '@/lib/feed-server';

// Mobile-only feed endpoint. Intentionally separate from /api/feed so web
// refactors never accidentally break the mobile contract.
// Auth: Firebase ID token via Authorization: Bearer <token> only (no cookies).
// Response: subset of V3UserFeed — only the fields the mobile app renders.

export async function GET(request: NextRequest) {
  if (!adminAuth || !adminFirestore) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = request.nextUrl.searchParams.get('role') ?? '';

  try {
    const feed = await getBootstrapFeedForUid(uid, role);
    if (!feed) return NextResponse.json(null);

    return NextResponse.json(
      {
        date: feed.date,
        assembled_at: feed.assembled_at ?? null,
        for_you: feed.for_you ?? [],
        trending: feed.trending ?? [],
        trending_topics: feed.trending_topics ?? [],
        community_pulse: feed.community_pulse ?? [],
        build_pulse: feed.build_pulse ?? [],
        metadata: feed.metadata ?? null,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('[api/mobile/feed]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
