import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { classifySignupPlatform } from '@/lib/analytics-platform';

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

    // Get all user profiles from Firestore
    const usersSnapshot = await adminFirestore
      .collection('user_profiles')
      .get();

    // Create a map of Firestore profiles
    const firestoreProfiles: Map<string, any> = new Map();
    usersSnapshot.docs.forEach(doc => {
      firestoreProfiles.set(doc.id, doc.data());
    });

    // Try Firebase Auth first for signup dates, but do not let an empty/misconfigured
    // Auth admin view make the whole dashboard look like the product has zero users.
    const authUsers: Map<string, { createdAt: string }> = new Map();
    try {
      let nextPageToken: string | undefined;
      do {
        const listResult = await adminAuth.listUsers(1000, nextPageToken);
        listResult.users.forEach(user => {
          authUsers.set(user.uid, {
            createdAt: user.metadata.creationTime || '',
          });
        });
        nextPageToken = listResult.pageToken;
      } while (nextPageToken);
    } catch (error) {
      console.error('Error listing Firebase Auth users, falling back to Firestore profiles:', error);
    }

    const sourceEntries =
      authUsers.size > 0
        ? Array.from(authUsers.entries()).map(([uid, authData]) => ({ uid, createdAt: authData.createdAt }))
        : usersSnapshot.docs.map((doc) => {
            const data = doc.data();
            const createdAt =
              data.createdAt?.toDate?.()?.toISOString?.() ||
              (data.createdAt?._seconds
                ? new Date(data.createdAt._seconds * 1000).toISOString()
                : data.createdAt || '');
            return { uid: doc.id, createdAt };
          });

    console.log(`Processing ${sourceEntries.length} analytics users (${authUsers.size} auth users, ${usersSnapshot.docs.length} Firestore profiles)...`);
    // One row per account from the two bulk reads above. (Per-user feed and
    // interaction lookups used to run here: 2 queries x 1,300 accounts at once,
    // which the LocalDB answered with 502s and a 49s response; nothing read them.)
    const users = sourceEntries.map(({ uid, createdAt }) => {
      const data = firestoreProfiles.get(uid) || {};

      const platform = classifySignupPlatform(data);
      
      return {
        uid,
        name: data.name || data.displayName || 'No name',
        email: data.email || '',
        onboarded: data.onboarded || false,
        subscriptionStatus: data.subscriptionStatus || 'none',
        appSubscriptionStatus: data.appSubscriptionStatus || 'none',
        willCancelAt: data.willCancelAt || null,
        subscriptionId: data.subscriptionId || null,
        trialEndDate: data.trialEndDate || null,
        // Prefer Firebase Auth creation time when available, otherwise fall back to profile createdAt.
        createdAt: createdAt || null,
        onboardedAt: data.onboardedAt?.toDate?.() ? data.onboardedAt.toDate().toISOString() : data.onboardedAt || null,
        interests: data.interests || [],
        selectedLearningSources: data.selectedLearningSources || [],
        selectedSources: data.selectedSources || [],
        referralSource: data.referralSource || null,
        platform,
      };
    });

    const totalUsers = users.length;

    // Calculate summary stats
    const onboardedUsers = users.filter(u => u.onboarded);
    const subscribedUsers = users.filter(u => ['trial', 'active'].includes(u.subscriptionStatus) || ['trial', 'active'].includes(u.appSubscriptionStatus));
    const scheduledCancellations = subscribedUsers.filter(u => Boolean(u.willCancelAt));
    const today = new Date();
    
    // Helper to check if trial is expired
    const isTrialExpired = (trialEndDate: any) => {
      if (!trialEndDate) return false;
      const trialEnd = trialEndDate?.seconds
        ? new Date(trialEndDate.seconds * 1000)
        : new Date(trialEndDate);
      return trialEnd < today;
    };

    // Trial Users: In active trial period (trialEndDate exists and > now)
    const trialUsers = subscribedUsers.filter(u => {
      if (!u.trialEndDate) return false;
      return !isTrialExpired(u.trialEndDate);
    });

    // Paid Subscribers: status='active' + has subscriptionId + (no trial OR trial expired) + not cancelled
    const paidSubscribers = subscribedUsers.filter(u => {
      if (u.subscriptionStatus !== 'active') return false;
      if (!u.subscriptionId) return false;
      if (u.willCancelAt) return false; // Exclude if they've scheduled cancellation
      // Either no trial date (never had trial) OR trial expired
      return !u.trialEndDate || isTrialExpired(u.trialEndDate);
    });

    // Gifted Subs: status='active' + (no subscriptionId OR trial expired)
    const giftedSubscriptions = subscribedUsers.filter(u => {
      if (u.subscriptionStatus !== 'active') return false;
      const hasNoSubscriptionId = !u.subscriptionId;
      const trialExpired = u.trialEndDate && isTrialExpired(u.trialEndDate);
      return hasNoSubscriptionId || trialExpired;
    });

    const platformBreakdown = users.reduce(
      (acc, user) => {
        const key = user.platform || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { mobile: 0, web: 0 } as Record<'mobile' | 'web', number>
    );

    const referralBreakdown = users.reduce((acc, user) => {
      const key = user.referralSource || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summary = {
      totalUsers,
      onboardedUsers: onboardedUsers.length,
      subscribedUsers: subscribedUsers.length,
      trialUsers: trialUsers.length,
      paidSubscribers: paidSubscribers.length,
      giftedSubscriptions: giftedSubscriptions.length,
      scheduledCancellations: scheduledCancellations.length,
      platformBreakdown,
      referralBreakdown,
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
