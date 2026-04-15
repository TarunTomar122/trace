import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Get subscription status endpoint
export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase token
    if (!adminAuth) throw new Error('Firebase Admin not initialized');
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get user data
    if (!adminDb) throw new Error('Firestore not initialized');
    const userDoc = await adminDb.collection('user_profiles').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptionStatus = userData?.subscriptionStatus || 'none';
    const appSubscriptionStatus = userData?.appSubscriptionStatus || 'none';
    
    // Check if they have active/trial status from EITHER payment source (Dodo web / RevenueCat app)
    let hasAccess = ['trial', 'active'].includes(subscriptionStatus) || ['trial', 'active'].includes(appSubscriptionStatus);
    
    // If cancelled but still active, check if cancellation date has passed
    if (hasAccess && userData?.cancelledAt) {
      const now = new Date();
      const willCancelAt = userData.willCancelAt 
        ? (userData.willCancelAt.toDate ? userData.willCancelAt.toDate() : new Date(userData.willCancelAt))
        : null;
      const nextBilling = userData.nextBillingDate
        ? (userData.nextBillingDate.toDate ? userData.nextBillingDate.toDate() : new Date(userData.nextBillingDate))
        : null;
      
      // Use willCancelAt if available, otherwise nextBillingDate
      const cancelDate = willCancelAt || nextBilling;
      
      // If cancellation date has passed, revoke access
      if (cancelDate && now >= cancelDate) {
        hasAccess = false;
      }
    }

    // Return subscription info
    return NextResponse.json({
      subscriptionStatus,
      subscriptionId: userData?.subscriptionId || null,
      planId: userData?.planId || null,
      trialEndDate: userData?.trialEndDate || null,
      nextBillingDate: userData?.nextBillingDate || null,
      lastPaymentDate: userData?.lastPaymentDate || null,
      cancelledAt: userData?.cancelledAt || null,
      willCancelAt: userData?.willCancelAt || null,
      hasAccess,
    });

  } catch (error) {
    console.error('Error getting subscription status:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

