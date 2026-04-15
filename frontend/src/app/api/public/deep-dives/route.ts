import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';

export const revalidate = 3600; // Cache for 1 hour

/**
 * Public endpoint to fetch global deep dives.
 * Used as fallback when user doesn't have their own deep dives.
 */
export async function GET() {
  try {
    if (!adminFirestore) {
      return NextResponse.json(
        { items: [], error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Fetch from global feed
    const globalFeedRef = adminFirestore
      .collection('v3_user_feeds')
      .doc('_global')
      .collection('daily');

    const snapshot = await globalFeedRef
      .orderBy('__name__', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ items: [] });
    }

    const data = snapshot.docs[0].data() || {};
    const deepDives = Array.isArray(data.deep_dives) ? data.deep_dives : [];

    // Return the deep dives as-is (they have full summary data)
    return NextResponse.json(
      { items: deepDives },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error: unknown) {
    console.error('Error fetching global deep dives:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { items: [], error: message },
      { status: 500 }
    );
  }
}
