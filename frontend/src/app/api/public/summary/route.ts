import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';

// Summary cache collection
const SUMMARY_CACHE = 'v3_summary_cache';

/**
 * Public endpoint to fetch summary by article URL.
 * No authentication required.
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter required' },
        { status: 400 }
      );
    }

    if (!adminFirestore) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Query summary cache by URL
    const cacheQuery = await adminFirestore
      .collection(SUMMARY_CACHE)
      .where('url', '==', url)
      .limit(1)
      .get();

    if (cacheQuery.empty) {
      return NextResponse.json(
        { summary: null },
        { status: 200 }
      );
    }

    const cacheData = cacheQuery.docs[0].data();

    return NextResponse.json({
      summary: cacheData?.summary || null,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching summary:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
