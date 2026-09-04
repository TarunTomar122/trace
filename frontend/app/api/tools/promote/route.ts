import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const PROMO_PRODUCT_ID = 'pdt_0NmqHrCrNa6vQDowGHn10';
const PROMO_DAYS = 7;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Creates a pending promoted-tool record + a Dodo checkout for the promo
// product ($19/mo). The subscription webhook flips the record to active
// on payment success (one-time or subscription events).
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminAuth || !adminDb) throw new Error('Firebase Admin not initialized');
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const userId = decoded.uid;

    const body = await request.json().catch(() => ({}));
    const rawUrl = String(body.url || '').trim();
    const title = String(body.title || '').trim().slice(0, 80);
    const subtext = String(body.subtext || '').trim().slice(0, 160);
    if (!/^https?:\/\//.test(rawUrl) || !hostOf(rawUrl)) {
      return NextResponse.json({ error: 'Enter a valid tool URL starting with http(s)' }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: 'Enter a tool title' }, { status: 400 });
    }

    const DODO_API_KEY = process.env.DODO_API_KEY;
    if (!DODO_API_KEY) {
      return NextResponse.json({ error: 'Payments not configured yet' }, { status: 400 });
    }
    const DODO_BASE_URL =
      process.env.DODO_MODE === 'live' ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com';

    const userDoc = await adminDb.collection('user_profiles').doc(userId).get();
    const userData = userDoc.data() || {};
    const email = userData.email || decoded.email || '';
    const name = userData.name || userData.displayName || (email ? email.split('@')[0] : '');

    const toolRef = adminDb.collection('promoted_tools').doc();
    await toolRef.set({
      url: rawUrl,
      host: hostOf(rawUrl),
      title,
      subtext: subtext || '',
      status: 'pending',
      product_id: PROMO_PRODUCT_ID,
      user_id: userId,
      email,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const checkoutResponse = await fetch(`${DODO_BASE_URL}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_cart: [{ product_id: PROMO_PRODUCT_ID, quantity: 1 }],
        customer: { email, name },
        metadata: { type: 'tool_promo', tool_id: toolRef.id, user_id: userId, source: 'trace_app' },
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/feed?tool_promo=success`,
      }),
    });

    if (!checkoutResponse.ok) {
      const errorText = await checkoutResponse.text().catch(() => '');
      console.error('Dodo tool-promo checkout failed:', checkoutResponse.status, errorText.slice(0, 300));
      await toolRef.update({ status: 'checkout_failed', updated_at: new Date() });
      return NextResponse.json({ error: 'Could not open checkout' }, { status: 500 });
    }
    const checkoutData = await checkoutResponse.json();
    await toolRef.update({
      checkout_session_id: checkoutData.session_id || null,
      updated_at: new Date(),
    });
    return NextResponse.json({ checkoutUrl: checkoutData.checkout_url, toolId: toolRef.id });
  } catch (err) {
    console.error('Tool promo error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
