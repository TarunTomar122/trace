import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

// This endpoint creates a Dodo Payments checkout session for subscription
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
    const email = userData?.email || decodedToken.email;
    const name = userData?.name || userData?.displayName || email?.split('@')[0];

    // Check referer - if coming from success page, don't create checkout
    const referer = request.headers.get('referer') || '';
    if (referer.includes('subscription=success') || referer.includes('subscription_id=')) {
      // They're coming from payment success page - webhook should process soon
      // Check if subscription already exists
      if (userData?.subscriptionId) {
        return NextResponse.json({ 
          error: 'Subscription already exists',
          subscriptionId: userData.subscriptionId,
          subscriptionStatus: userData.subscriptionStatus || 'pending',
          message: 'Your subscription is being processed. Please refresh the page.'
        }, { status: 400 });
      }
      // If no subscription ID yet, webhook is still processing
      return NextResponse.json({ 
        error: 'Subscription is being processed',
        message: 'Your payment was successful. Please wait a moment and refresh the page.',
        retryAfter: 10
      }, { status: 429 });
    }

    // Check if user already has active subscription FIRST (before rate limit check)
    if (userData?.subscriptionStatus === 'active' || userData?.subscriptionStatus === 'trial') {
      return NextResponse.json({ 
        error: 'User already has an active subscription',
        subscriptionStatus: userData.subscriptionStatus 
      }, { status: 400 });
    }
    
    // Check if they already have a subscription ID (webhook might have processed)
    if (userData?.subscriptionId) {
      return NextResponse.json({ 
        error: 'Subscription already exists',
        subscriptionId: userData.subscriptionId,
        subscriptionStatus: userData.subscriptionStatus || 'pending'
      }, { status: 400 });
    }
    
    // Check for recent checkout attempt (within last 2 minutes) to prevent duplicates
    // But only if they don't have a subscription ID yet
    if (userData?.lastCheckoutCreatedAt && !userData?.subscriptionId) {
      const lastCheckout = userData.lastCheckoutCreatedAt.toDate 
        ? userData.lastCheckoutCreatedAt.toDate() 
        : new Date((userData.lastCheckoutCreatedAt as any).toDate());
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      if (lastCheckout > twoMinutesAgo) {
        return NextResponse.json({ 
          error: 'Please wait a moment before trying again',
          retryAfter: 120 
        }, { status: 429 });
      }
    }

    // Dodo Payments API configuration
    const DODO_API_KEY = process.env.DODO_API_KEY;
    const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID; // Your $5.00/month product ID
    const TRIAL_DAYS = 3; // 3-day free trial

    if (!DODO_API_KEY || !DODO_PRODUCT_ID || DODO_API_KEY === 'sk_your_key_here' || DODO_PRODUCT_ID === 'prod_your_product_id_here') {
      console.error('Missing Dodo Payments configuration');
      return NextResponse.json({ 
        error: 'Dodo Payments not configured yet. Please set up your Dodo account and add API credentials to environment variables.',
        needsSetup: true
      }, { status: 400 });
    }

    // Create checkout session with Dodo Payments
    // Use test mode by default, switch to live.dodopayments.com for production
    console.log('DODO_MODE:', process.env.DODO_MODE);
    const DODO_BASE_URL = process.env.DODO_MODE === 'live' 
      ? 'https://live.dodopayments.com' 
      : 'https://test.dodopayments.com';
    
    console.log('Creating Dodo checkout with:', { DODO_BASE_URL, DODO_PRODUCT_ID, email, userId });
    
    // Get DataFast visitor ID from cookies
    const cookieStore = await cookies();
    const datafastVisitorId = cookieStore.get('datafast_visitor_id')?.value;
    
    const checkoutResponse = await fetch(`${DODO_BASE_URL}/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: DODO_PRODUCT_ID,
            quantity: 1,
          }
        ],
        subscription_data: {
          trial_period_days: TRIAL_DAYS, // 3-day free trial
        },
        customer: {
          email: email,
          name: name,
        },
        metadata: {
          user_id: userId,
          source: 'trace_app',
          datafast_visitor_id: datafastVisitorId, // Pass DataFast visitor ID for conversion tracking
        },
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/profile?subscription=success`,
      }),
    });

    if (!checkoutResponse.ok) {
      const errorText = await checkoutResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error('Dodo Payments error:', { status: checkoutResponse.status, error: errorData });
      return NextResponse.json({ 
        error: 'Failed to create checkout session',
        details: errorData,
        status: checkoutResponse.status
      }, { status: 500 });
    }

    const checkoutData = await checkoutResponse.json();
    console.log('Dodo checkout created:', checkoutData);

    // Store checkout session info without changing subscription status
    // Status will only be updated when webhook confirms successful subscription
    await adminDb.collection('user_profiles').doc(userId).update({
      lastCheckoutSessionId: checkoutData.session_id,
      lastCheckoutCreatedAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      checkoutUrl: checkoutData.checkout_url,
      sessionId: checkoutData.session_id,
      trialDays: TRIAL_DAYS,
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
