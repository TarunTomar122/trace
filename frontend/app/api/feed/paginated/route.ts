import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

const PAGE_SIZE = 50;
const MAX_FEED_ITEMS = 50;

/**
 * Paginated feed endpoint for subscribed users.
 * 
 * Query params:
 * - date: Feed date (YYYY-MM-DD), defaults to latest
 * - cursor: Item index to start from (0-based)
 * - limit: Number of items to return (default 50, max 50)
 * 
 * Returns items sorted: unseen first, then seen (by original order)
 */
export async function GET(request: NextRequest) {
  try {
    if (!adminAuth || !adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const cursor = parseInt(searchParams.get('cursor') || '0', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10), MAX_FEED_ITEMS);

    // Get feed date (latest if not specified)
    let feedDate = dateParam;
    if (!feedDate) {
      // Only fetch the latest feed date (not all feeds!)
      const latestFeedSnapshot = await adminFirestore
        .collection('user_feeds')
        .doc(userId)
        .collection('daily')
        .orderBy('__name__', 'desc')
        .limit(1)
        .get();
      
      if (latestFeedSnapshot.empty) {
        return NextResponse.json({ 
          items: [], 
          cursor: 0, 
          hasMore: false, 
          feedDate: null,
          total: 0 
        });
      }
      
      feedDate = latestFeedSnapshot.docs[0].id;
    }

    // Get the feed document
    const feedDoc = await adminFirestore
      .collection('user_feeds')
      .doc(userId)
      .collection('daily')
      .doc(feedDate)
      .get();

    if (!feedDoc.exists) {
      return NextResponse.json({ 
        items: [], 
        cursor: 0, 
        hasMore: false, 
        feedDate,
        total: 0 
      });
    }

    const feedData = feedDoc.data();
    const allItems: any[] = feedData?.items || [];
    const seenItemIds: Set<string> = new Set(feedData?.seen_item_ids || []);

    // Limit total items to MAX_FEED_ITEMS
    const limitedItems = allItems.slice(0, MAX_FEED_ITEMS);

    // Sort: unseen items first, then seen items (preserving original order within each group)
    const unseenItems: any[] = [];
    const seenItems: any[] = [];
    
    limitedItems.forEach((item, originalIndex) => {
      const itemWithIndex = { ...item, _originalIndex: originalIndex };
      if (seenItemIds.has(item.id)) {
        seenItems.push(itemWithIndex);
      } else {
        unseenItems.push(itemWithIndex);
      }
    });

    // Combine: unseen first, then seen
    const sortedItems = [...unseenItems, ...seenItems];
    
    // Apply pagination
    const paginatedItems = sortedItems.slice(cursor, cursor + limit);
    const hasMore = cursor + limit < sortedItems.length;

    // Add seen status to each item
    const itemsWithStatus = paginatedItems.map(item => ({
      ...item,
      _seen: seenItemIds.has(item.id),
    }));

    return NextResponse.json({
      items: itemsWithStatus,
      cursor: cursor + paginatedItems.length,
      hasMore,
      feedDate,
      total: sortedItems.length,
      unseenCount: unseenItems.length,
      seenCount: seenItems.length,
      metadata: feedData?.metadata || {},  // Pass through feed metadata (includes is_preview flag)
    });
  } catch (error: any) {
    console.error('Error fetching paginated feed:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

