import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { resolveSubscriptionOffer } from '@/lib/subscription-offer';
import { captureServerEvent } from '@/lib/posthog-server';
import { toDateMaybe } from '@/lib/subscription-access';

function readAffiliateCookie(raw: string | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as {
      code?: string;
      landingPath?: string | null;
      utmSource?: string | null;
      utmCampaign?: string | null;
      utmMedium?: string | null;
    };
  } catch {
    return null;
  }
}

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

    // Optional app-relative return path so checkout returns the user to the
    // story/profile they started from. Reject absolute or protocol-relative URLs.
    const body = (await request.json().catch(() => null)) as { return_path?: unknown } | null;
    const rawReturnPath = typeof body?.return_path === 'string' ? body.return_path.trim() : '';
    const returnPath = /^\/(?!\/)/.test(rawReturnPath) && !rawReturnPath.includes('subscription=success')
      ? rawReturnPath
      : '/feed';

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
          error: 'Your subscription is already being set up — refresh in a minute.',
          code: 'processing',
          subscriptionId: userData.subscriptionId,
          subscriptionStatus: userData.subscriptionStatus || 'pending',
        }, { status: 400 });
      }
      // If no subscription ID yet, webhook is still processing
      return NextResponse.json({ 
        error: 'Your payment went through and Pro is activating — refresh in a minute.',
        code: 'processing',
        retryAfter: 10
      }, { status: 429 });
    }

    // Check if user already has active subscription FIRST (before rate limit check)
    const webSub = userData?.subscriptionStatus || 'none';
    const appSub = userData?.appSubscriptionStatus || 'none';
    if (['active', 'trial'].includes(webSub) || ['active', 'trial'].includes(appSub)) {
      return NextResponse.json({ 
        error: 'You already have an active Trace Pro subscription.',
        code: 'already_pro',
        subscriptionStatus: userData?.subscriptionStatus 
      }, { status: 400 });
    }
    
    // Check if they already have a subscription ID (webhook might have processed)
    if (userData?.subscriptionId) {
      return NextResponse.json({ 
        error: 'Your subscription is already being set up — refresh in a minute.',
        code: 'processing',
        subscriptionId: userData.subscriptionId,
        subscriptionStatus: userData.subscriptionStatus || 'pending'
      }, { status: 400 });
    }
    
    // Check for recent checkout attempt (within last 2 minutes) to prevent duplicates
    // But only if they don't have a subscription ID yet
    if (userData?.lastCheckoutCreatedAt && !userData?.subscriptionId) {
      const lastCheckout = toDateMaybe(userData.lastCheckoutCreatedAt);
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      if (lastCheckout && lastCheckout > twoMinutesAgo) {
        return NextResponse.json({ 
          error: 'Please wait a moment before trying again.',
          code: 'rate_limited',
          retryAfter: 120 
        }, { status: 429 });
      }
    }

    // Dodo Payments API configuration
    const DODO_API_KEY = process.env.DODO_API_KEY;

    if (!DODO_API_KEY || DODO_API_KEY === 'sk_your_key_here') {
      console.error('Missing Dodo Payments configuration');
      return NextResponse.json({ 
        error: 'Checkout is temporarily unavailable. Please try again later.',
        code: 'unavailable',
      }, { status: 400 });
    }

    const offer = resolveSubscriptionOffer(request, userData);

    // Create checkout session with Dodo Payments
    // Use test mode by default, switch to live.dodopayments.com for production
    console.log('DODO_MODE:', process.env.DODO_MODE);
    const DODO_BASE_URL = process.env.DODO_MODE === 'live' 
      ? 'https://live.dodopayments.com' 
      : 'https://test.dodopayments.com';
    
    console.log('Creating Dodo checkout with:', {
      DODO_BASE_URL,
      productId: offer.productId,
      countryCode: offer.countryCode,
      countrySource: offer.countrySource,
      email,
      userId,
    });
    
    // Get DataFast visitor ID from cookies
    const cookieStore = await cookies();
    const datafastVisitorId = cookieStore.get('datafast_visitor_id')?.value;
    const affiliateCookie = readAffiliateCookie(cookieStore.get('trace_affiliate')?.value);
    const affiliateCode = userData?.affiliateCode || affiliateCookie?.code || null;

    if (affiliateCode && !userData?.affiliateCode) {
      await adminDb.collection('user_profiles').doc(userId).set({
        affiliateCode,
        affiliateAttributedAt: new Date(),
        affiliateLandingPath: affiliateCookie?.landingPath || null,
        utmSource: affiliateCookie?.utmSource || null,
        utmCampaign: affiliateCookie?.utmCampaign || null,
        utmMedium: affiliateCookie?.utmMedium || null,
        updatedAt: new Date(),
      }, { merge: true });
    }
    
    const checkoutResponse = await fetch(`${DODO_BASE_URL}/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: offer.productId,
            quantity: 1,
          }
        ],
        ...(offer.isIndiaOffer && {
          allowed_payment_method_types: ['upi_collect', 'credit', 'debit'],
          billing_currency: 'INR',
          billing_address: {
            country: 'IN',
          },
        }),
        feature_flags: {
          allow_discount_code: offer.isIndiaOffer,
        },
        customer: {
          email: email,
          name: name,
        },
        metadata: {
          user_id: userId,
          source: 'trace_app',
          checkout_country_code: offer.countryCode ?? '',
          checkout_country_source: offer.countrySource,
          pricing_offer: offer.isIndiaOffer ? 'india' : 'default',
          datafast_visitor_id: datafastVisitorId ?? '',
          affiliate_code: affiliateCode ?? '',
          affiliate_landing_path: userData?.affiliateLandingPath || affiliateCookie?.landingPath || '',
          utm_source: userData?.utmSource || affiliateCookie?.utmSource || '',
          utm_campaign: userData?.utmCampaign || affiliateCookie?.utmCampaign || '',
          utm_medium: userData?.utmMedium || affiliateCookie?.utmMedium || '',
        },
        return_url: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://www.yourtrace.online').replace('https://yourtrace.online', 'https://www.yourtrace.online')}${returnPath}${returnPath.includes('?') ? '&' : '?'}subscription=success`,
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
      await captureServerEvent(userId, 'checkout_create_failed', {
        status: checkoutResponse.status,
        pricing_offer: offer.isIndiaOffer ? 'india' : 'default',
      });
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
      checkoutCountryCode: offer.countryCode,
      checkoutCountrySource: offer.countrySource,
      checkoutOfferType: offer.isIndiaOffer ? 'india' : 'default',
      checkoutProductId: offer.productId,
      updatedAt: new Date(),
    });

    await captureServerEvent(userId, 'checkout_created', {
      $insert_id: `checkout_created:${checkoutData.session_id}`,
      pricing_offer: offer.isIndiaOffer ? 'india' : 'default',
      country_code: offer.countryCode,
    });

    return NextResponse.json({
      checkoutUrl: checkoutData.checkout_url,
      sessionId: checkoutData.session_id,
      countryCode: offer.countryCode,
      priceDisplay: offer.priceDisplay,
      pricingOffer: offer.isIndiaOffer ? 'india' : 'default',
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
