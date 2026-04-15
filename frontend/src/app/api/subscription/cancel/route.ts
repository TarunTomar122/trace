import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Cancel subscription endpoint
export async function POST(request: NextRequest) {
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

    // Get request body
    const body = await request.json();
    const { cancelAtPeriodEnd = true } = body;

    // Get user data
    if (!adminDb) throw new Error('Firestore not initialized');
    const userDoc = await adminDb.collection('user_profiles').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptionId = userData?.subscriptionId;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // Dodo Payments API configuration
    const DODO_API_KEY = process.env.DODO_API_KEY;
    if (!DODO_API_KEY) {
      return NextResponse.json({ error: 'Payment system not configured' }, { status: 500 });
    }

    // Cancel subscription via Dodo Payments API
    const DODO_BASE_URL = process.env.DODO_MODE === 'live' 
      ? 'https://live.dodopayments.com' 
      : 'https://test.dodopayments.com';
    
    console.log(`Cancelling subscription ${subscriptionId} at ${DODO_BASE_URL}/subscriptions/${subscriptionId}`);
    
    const cancelResponse = await fetch(`${DODO_BASE_URL}/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cancel_at_next_billing_date: cancelAtPeriodEnd,
      }),
    });

    console.log(`Dodo cancel response: ${cancelResponse.status} ${cancelResponse.statusText}`);

    if (!cancelResponse.ok) {
      const errorText = await cancelResponse.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { message: 'Unknown error' };
      } catch {
        errorData = { message: errorText || 'Unknown error' };
      }
      console.error('Dodo Payments cancel error:', errorData);
      return NextResponse.json({ 
        error: 'Failed to cancel subscription',
        details: errorData 
      }, { status: 500 });
    }

    // Handle empty response (204 No Content) or JSON response
    const responseText = await cancelResponse.text();
    let cancelData = {};
    if (responseText) {
      try {
        cancelData = JSON.parse(responseText);
      } catch {
        console.log('Cancel response was not JSON:', responseText);
      }
    }

    // Update user document
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (cancelAtPeriodEnd) {
      // Subscription will remain active until period end
      updateData.subscriptionStatus = 'active'; // Still active, just won't renew
      updateData.cancelledAt = new Date();
      updateData.willCancelAt = userData.nextBillingDate;
    } else {
      // Immediate cancellation
      updateData.subscriptionStatus = 'cancelled';
      updateData.cancelledAt = new Date();
    }

    await adminDb.collection('user_profiles').doc(userId).update(updateData);

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd,
      message: cancelAtPeriodEnd 
        ? 'Subscription will cancel at the end of the billing period' 
        : 'Subscription cancelled immediately',
      subscription: cancelData,
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

