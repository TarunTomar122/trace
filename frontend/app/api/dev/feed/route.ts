import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

/**
 * DEV ONLY: Get a specific user's feed
 * GET /api/dev/feed?userId=xxx
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

    // Get the user's latest feed
    const feedsRef = adminFirestore
      .collection('user_feeds')
      .doc(userId)
      .collection('daily');
    
    const feedsSnapshot = await feedsRef.orderBy('date', 'desc').limit(1).get();
    
    if (feedsSnapshot.empty) {
      return NextResponse.json({ 
        items: [], 
        date: null,
        message: 'No feed found for this user' 
      });
    }

    const feedDoc = feedsSnapshot.docs[0];
    const feedData = feedDoc.data();

    return NextResponse.json({
      items: feedData.items || [],
      date: feedData.date || feedDoc.id,
      generatedAt: feedData.generated_at,
      metadata: feedData.metadata,
    });
  } catch (error: any) {
    console.error('Error fetching user feed:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

