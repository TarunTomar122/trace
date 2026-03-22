import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { resolveSubscriptionOffer } from '@/lib/subscription-offer';

export async function GET(request: NextRequest) {
  try {
    let userData: Record<string, unknown> | undefined;
    const authHeader = request.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      if (adminAuth) {
        const decodedToken = await adminAuth.verifyIdToken(token);
        if (adminDb) {
          const userDoc = await adminDb.collection('user_profiles').doc(decodedToken.uid).get();
          userData = userDoc.exists ? userDoc.data() : undefined;
        }
      }
    }

    const offer = resolveSubscriptionOffer(request, userData);
    return NextResponse.json({
      countryCode: offer.countryCode,
      countrySource: offer.countrySource,
      trialDays: offer.trialDays,
      priceDisplay: offer.priceDisplay,
      pricingOffer: offer.isIndiaOffer ? 'india' : 'default',
    });
  } catch (error) {
    console.error('Error resolving subscription pricing:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve pricing' },
      { status: 500 }
    );
  }
}
