import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';

// Enable ISR with 1 hour revalidation
export const revalidate = 3600;

// Pool collection mapping based on article ID prefix
const POOL_MAP: Record<string, string> = {
  'fy': 'v3_for_you_pool',
  'tr': 'v3_trending_pool',
};

// Summary cache collection
const SUMMARY_CACHE = 'v3_summary_cache';

/**
 * Public endpoint to fetch a single article by ID.
 * No authentication required.
 *
 * Article IDs are prefixed with pool type:
 *   - fy_<hash> → For You pool
 *   - tr_<hash> → Trending pool
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || id.length < 4) {
      return NextResponse.json(
        { error: 'Invalid article ID' },
        { status: 400 }
      );
    }

    // Parse prefix and doc_id from article ID
    const prefix = id.substring(0, 2);
    const docId = id.substring(3); // Skip prefix and underscore

    const poolCollection = POOL_MAP[prefix];
    if (!poolCollection) {
      return NextResponse.json(
        { error: 'Invalid article ID format' },
        { status: 400 }
      );
    }

    if (!adminFirestore) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Fetch article from pool
    const articleDoc = await adminFirestore
      .collection(poolCollection)
      .doc(docId)
      .get();

    if (!articleDoc.exists) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    const data = articleDoc.data();
    if (!data) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Determine feed type from prefix
    const feedTypeMap: Record<string, string> = {
      'fy': 'for_you',
      'tr': 'trending',
    };

    // Try to fetch summary from cache
    let summary = data.summary || {};
    const articleUrl = data.url || '';

    if (articleUrl && (!summary || !summary.short_article)) {
      // Query summary cache by URL to find any cached summary
      const cacheQuery = await adminFirestore
        .collection(SUMMARY_CACHE)
        .where('url', '==', articleUrl)
        .limit(1)
        .get();

      if (!cacheQuery.empty) {
        const cacheData = cacheQuery.docs[0].data();
        if (cacheData?.summary) {
          summary = cacheData.summary;
        }
      }
    }

    // Build response article object (matching FeedItem structure)
    const article = {
      id,
      url: articleUrl,
      title: data.title || '',
      type: data.type || 'blog',
      source: data.source || '',
      source_name: data.source_name || '',
      interest_id: data.interest_id || '',
      feed_type: feedTypeMap[prefix] || 'for_you',
      published_date: data.published_date || '',
      thumbnail: data.og_image || data.thumbnail || null,
      summary,
      metadata: {
        feed_type: feedTypeMap[prefix] || 'for_you',
        source_description: data.source_description || '',
      },
    };

    return NextResponse.json({
      article,
      pool: poolCollection,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'CDN-Cache-Control': 'public, s-maxage=3600',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=3600',
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching article:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
