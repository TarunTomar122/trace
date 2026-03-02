import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

/**
 * DEV ONLY: Get a specific user's feed
 * GET /api/dev/feed?userId=xxx&date=2026-03-02 (optional date)
 */
export async function GET(request: NextRequest) {
  // Only allow in development environment
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  try {
    if (!adminAuth || !adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Verify the requesting user is authenticated
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await adminAuth.verifyIdToken(token);

    // Get userId from query params
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Optional date param (defaults to today IST)
    let targetDate = request.nextUrl.searchParams.get('date');
    if (!targetDate) {
      // Get today's date in IST
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const ist = new Date(utc + 5.5 * 60 * 60 * 1000);
      targetDate = ist.toISOString().slice(0, 10);
    }

    // Try v3_user_feeds first (new format)
    const v3FeedsRef = adminFirestore
      .collection('v3_user_feeds')
      .doc(userId)
      .collection('daily')
      .doc(targetDate);

    const v3Doc = await v3FeedsRef.get();

    if (v3Doc.exists) {
      const data = v3Doc.data() || {};
      return NextResponse.json({
        version: 'v3',
        date: targetDate,
        for_you: data.for_you || [],
        deep_dives: data.deep_dives || [],
        trending: data.trending || [],
      });
    }

    // Fallback to legacy user_feeds
    const feedsRef = adminFirestore
      .collection('user_feeds')
      .doc(userId)
      .collection('daily');

    const feedsSnapshot = await feedsRef.orderBy('date', 'desc').limit(1).get();

    if (feedsSnapshot.empty) {
      return NextResponse.json({
        version: 'none',
        date: targetDate,
        for_you: [],
        deep_dives: [],
        trending: [],
        message: 'No feed found for this user'
      });
    }

    const feedDoc = feedsSnapshot.docs[0];
    const feedData = feedDoc.data();

    return NextResponse.json({
      version: 'v1',
      date: feedData.date || feedDoc.id,
      items: feedData.items || [],
      generatedAt: feedData.generated_at,
    });
  } catch (error: any) {
    console.error('Error fetching user feed:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
