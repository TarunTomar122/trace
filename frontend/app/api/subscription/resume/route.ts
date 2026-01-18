import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Resume subscription endpoint (undo cancellation)
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

    // Get user data
    if (!adminDb) throw new Error('Firestore not initialized');
    const userDoc = await adminDb.collection('user_profiles').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptionId = userData?.subscriptionId;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
    }

    // Dodo Payments API configuration
    const DODO_API_KEY = process.env.DODO_API_KEY;
    if (!DODO_API_KEY) {
      return NextResponse.json({ error: 'Payment system not configured' }, { status: 500 });
    }

    // Resume subscription via Dodo Payments API (set cancel_at_next_billing_date to false)
    const DODO_BASE_URL = process.env.DODO_MODE === 'live' 
      ? 'https://live.dodopayments.com' 
      : 'https://test.dodopayments.com';
    
    console.log(`Resuming subscription ${subscriptionId} at ${DODO_BASE_URL}/subscriptions/${subscriptionId}`);
    
    const resumeResponse = await fetch(`${DODO_BASE_URL}/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cancel_at_next_billing_date: false,
      }),
    });

    console.log(`Dodo resume response: ${resumeResponse.status} ${resumeResponse.statusText}`);

    if (!resumeResponse.ok) {
      const errorText = await resumeResponse.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { message: 'Unknown error' };
      } catch {
        errorData = { message: errorText || 'Unknown error' };
      }
      console.error('Dodo Payments resume error:', errorData);
      return NextResponse.json({ 
        error: 'Failed to resume subscription',
        details: errorData 
      }, { status: 500 });
    }

    // Handle response
    const responseText = await resumeResponse.text();
    let resumeData = {};
    if (responseText) {
      try {
        resumeData = JSON.parse(responseText);
      } catch {
        console.log('Resume response was not JSON:', responseText);
      }
    }

    // Update user document - clear cancellation fields
    await adminDb.collection('user_profiles').doc(userId).update({
      cancelledAt: null,
      willCancelAt: null,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription resumed successfully',
      subscription: resumeData,
    });

  } catch (error) {
    console.error('Error resuming subscription:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

