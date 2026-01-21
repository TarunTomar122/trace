import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

/**
 * DEV ONLY: Get analytics data
 * GET /api/dev/analytics
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

    // Get all users
    const usersSnapshot = await adminFirestore
      .collection('user_profiles')
      .get();

    const totalUsers = usersSnapshot.docs.length;
    
    // Process each user
    console.log(`Processing ${usersSnapshot.docs.length} users...`);
    const users = await Promise.all(usersSnapshot.docs.map(async (doc) => {
      const data = doc.data();
      const uid = doc.id;
      
      // Get latest feed (single query, avoid scanning all feeds)
      let feedItemCount = 0;
      let latestFeedDate = null;
      try {
        if (adminFirestore) {
          const latestFeed = await adminFirestore
            .collection('user_feeds')
            .doc(uid)
            .collection('daily')
            .orderBy(FieldPath.documentId(), 'desc')
            .limit(1)
            .get();

          if (!latestFeed.empty) {
            const latestDoc = latestFeed.docs[0];
            const feedData = latestDoc.data();
            feedItemCount = feedData?.items?.length || 0;
            latestFeedDate = latestDoc.id;
          }
        }
      } catch (error) {
        console.error(`Error fetching feed for user ${uid}:`, error);
      }

      // Get interactions count (single query, avoid scanning all days)
      let interactionCount = 0;
      let lastInteractionDate = null;
      let totalInteractionCount = 0;
      try {
        if (adminFirestore) {
          const today = new Date().toISOString().split('T')[0];
          
          const latestInteractions = await adminFirestore
            .collection('user_interactions')
            .doc(uid)
            .collection('daily')
            .orderBy(FieldPath.documentId(), 'desc')
            .limit(1)
            .get();

          if (!latestInteractions.empty) {
            const latestDoc = latestInteractions.docs[0];
            const data = latestDoc.data();
            const itemsCount = data?.items?.length || 0;
            lastInteractionDate = latestDoc.id;
            totalInteractionCount = itemsCount;
            if (latestDoc.id === today) {
              interactionCount = itemsCount;
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching interactions for user ${uid}:`, error);
      }

      return {
        uid,
        name: data.name || data.displayName || 'No name',
        email: data.email || '',
        onboarded: data.onboarded || false,
        subscriptionStatus: data.subscriptionStatus || 'none',
        feedItemCount,
        latestFeedDate,
        interactionCount, // Today's interactions
        totalInteractionCount, // All-time interactions
        lastInteractionDate,
        createdAt: data.createdAt,
        onboardedAt: data.onboardedAt,
        interests: data.interests || [],
      };
    }));

    // Calculate summary stats
    const onboardedUsers = users.filter(u => u.onboarded);
    const subscribedUsers = users.filter(u => ['trial', 'active'].includes(u.subscriptionStatus));
    const onboardedWithNoFeed = onboardedUsers.filter(u => u.feedItemCount === 0);
    const subscribedWithNoFeed = subscribedUsers.filter(u => u.feedItemCount === 0);
    const subscribedWithInteractions = subscribedUsers.filter(u => u.interactionCount > 0);

    const summary = {
      totalUsers,
      onboardedUsers: onboardedUsers.length,
      subscribedUsers: subscribedUsers.length,
      onboardedWithNoFeed: onboardedWithNoFeed.length,
      subscribedWithNoFeed: subscribedWithNoFeed.length,
      subscribedWithInteractions: subscribedWithInteractions.length,
      avgFeedItems: subscribedUsers.length > 0 
        ? (subscribedUsers.reduce((sum, u) => sum + u.feedItemCount, 0) / subscribedUsers.length).toFixed(1)
        : 0,
      avgTodayInteractions: subscribedUsers.length > 0
        ? (subscribedUsers.reduce((sum, u) => sum + u.interactionCount, 0) / subscribedUsers.length).toFixed(1)
        : 0,
    };

    return NextResponse.json({ 
      summary,
      users: users.sort((a, b) => {
        // Sort by subscription status, then by name
        const statusOrder = { 'active': 0, 'trial': 1, 'none': 2, 'cancelled': 3, 'expired': 4 };
        const aStatus = statusOrder[a.subscriptionStatus as keyof typeof statusOrder] ?? 5;
        const bStatus = statusOrder[b.subscriptionStatus as keyof typeof statusOrder] ?? 5;
        if (aStatus !== bStatus) return aStatus - bStatus;
        return a.name.localeCompare(b.name);
      })
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

