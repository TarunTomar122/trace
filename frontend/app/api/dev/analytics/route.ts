import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

/**
 * DEV ONLY: Get analytics data
 * GET /api/dev/analytics
 */
export async function GET(request: NextRequest) {
  // Only allow in development or with dev=true query param
  const isDev = process.env.NODE_ENV === 'development' || 
                request.nextUrl.searchParams.get('dev') === 'true';
  
  if (!isDev) {
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
      
      // Get latest feed (try today first, then get all and sort)
      let feedItemCount = 0;
      let latestFeedDate = null;
      try {
        if (adminFirestore) {
          // Try today's date first
          const today = new Date().toISOString().split('T')[0];
          const todayFeed = await adminFirestore
            .collection('user_feeds')
            .doc(uid)
            .collection('daily')
            .doc(today)
            .get();
          
          if (todayFeed.exists) {
            const feedData = todayFeed.data();
            feedItemCount = feedData?.items?.length || 0;
            latestFeedDate = today;
            if (feedItemCount > 0) {
              console.log(`User ${uid}: ${feedItemCount} items in today's feed`);
            }
          } else {
            // Get all feeds and find the latest
            const allFeeds = await adminFirestore
              .collection('user_feeds')
              .doc(uid)
              .collection('daily')
              .get();
            
            if (!allFeeds.empty) {
              // Sort by date (document ID)
              const sortedDocs = allFeeds.docs.sort((a, b) => b.id.localeCompare(a.id));
              const latestFeed = sortedDocs[0];
              const feedData = latestFeed.data();
              feedItemCount = feedData?.items?.length || 0;
              latestFeedDate = latestFeed.id;
              if (feedItemCount > 0) {
                console.log(`User ${uid}: ${feedItemCount} items in feed from ${latestFeedDate}`);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching feed for user ${uid}:`, error);
      }

      // Get interactions count for today or latest feed
      let interactionCount = 0;
      let lastInteractionDate = null;
      let totalInteractionCount = 0;
      try {
        if (adminFirestore) {
          const today = new Date().toISOString().split('T')[0];
          
          // Get all interactions to find latest and count today's
          const allInteractions = await adminFirestore
            .collection('user_interactions')
            .doc(uid)
            .collection('daily')
            .get();
          
          if (!allInteractions.empty) {
            // Sort by date (document ID) descending
            const sortedDocs = allInteractions.docs.sort((a, b) => b.id.localeCompare(a.id));
            lastInteractionDate = sortedDocs[0].id;
            
            // Count today's interactions and total
            for (const doc of allInteractions.docs) {
              const data = doc.data();
              const itemsCount = data?.items?.length || 0;
              totalInteractionCount += itemsCount;
              
              if (doc.id === today) {
                interactionCount = itemsCount;
              }
            }
            
            if (totalInteractionCount > 0) {
              console.log(`User ${uid}: ${totalInteractionCount} total interactions, ${interactionCount} today`);
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

