import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Mark feed items as seen.
 * 
 * POST body:
 * - date: Feed date (YYYY-MM-DD)
 * - item_ids: Array of item IDs to mark as seen
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { date, item_ids } = body;

    if (!date || !item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json(
        { error: 'date and item_ids array are required' },
        { status: 400 }
      );
    }

    // Update the feed document to add seen item IDs
    const feedRef = adminFirestore
      .collection('user_feeds')
      .doc(userId)
      .collection('daily')
      .doc(date);

    await feedRef.update({
      seen_item_ids: FieldValue.arrayUnion(...item_ids),
      seen_updated_at: new Date().toISOString(),
    });

    // Also update user_seen_urls with the actual URLs from these items
    // This is used by feed generation for deduplication
    const feedDoc = await feedRef.get();
    if (feedDoc.exists) {
      const feedData = feedDoc.data();
      const items = feedData?.items || [];
      
      // Extract URLs for the seen items
      const seenUrls: { [url: string]: string } = {};
      const now = new Date().toISOString();
      
      for (const itemId of item_ids) {
        const item = items.find((i: any) => i.id === itemId);
        if (item?.url) {
          seenUrls[item.url] = now;
        }
      }
      
      // Update user_seen_urls collection
      if (Object.keys(seenUrls).length > 0) {
        const seenUrlsRef = adminFirestore
          .collection('user_seen_urls')
          .doc(userId);
        
        const seenUrlsDoc = await seenUrlsRef.get();
        
        if (seenUrlsDoc.exists) {
          const existing = seenUrlsDoc.data()?.urls || {};
          await seenUrlsRef.update({
            urls: { ...existing, ...seenUrls },
            updated_at: now,
          });
        } else {
          await seenUrlsRef.set({
            urls: seenUrls,
            updated_at: now,
          });
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      marked_seen: item_ids.length 
    });
  } catch (error: any) {
    // If document doesn't exist, that's ok - just return success
    if (error.code === 5 || error.message?.includes('NOT_FOUND')) {
      return NextResponse.json({ 
        success: true, 
        marked_seen: 0,
        message: 'Feed not found' 
      });
    }
    
    console.error('Error marking items as seen:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get seen status for a feed date.
 * 
 * GET params:
 * - date: Feed date (YYYY-MM-DD)
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
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    const feedDoc = await adminFirestore
      .collection('user_feeds')
      .doc(userId)
      .collection('daily')
      .doc(date)
      .get();

    if (!feedDoc.exists) {
      return NextResponse.json({ seen_item_ids: [] });
    }

    const feedData = feedDoc.data();
    return NextResponse.json({ 
      seen_item_ids: feedData?.seen_item_ids || [] 
    });
  } catch (error: any) {
    console.error('Error getting seen items:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

