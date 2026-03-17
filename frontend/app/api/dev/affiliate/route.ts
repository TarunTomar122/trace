import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(code)) return null;
  return code;
}

async function verifyDevRequest(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }
  if (!adminAuth || !adminFirestore) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.split('Bearer ')[1];
  await adminAuth.verifyIdToken(token);
  return null;
}

export async function GET(request: NextRequest) {
  const authError = await verifyDevRequest(request);
  if (authError) return authError;

  const [codesSnap, usersSnap, clicksSnap, conversionsSnap] = await Promise.all([
    adminFirestore!.collection('affiliate_codes').get(),
    adminFirestore!.collection('user_profiles').get(),
    adminFirestore!.collection('affiliate_clicks').get(),
    adminFirestore!.collection('affiliate_conversions').get(),
  ]);

  const rows = new Map<string, {
    code: string;
    ownerName: string;
    ownerEmail: string;
    active: boolean;
    createdAt: string | null;
    clicks: number;
    androidClicks: number;
    signups: number;
    onboarded: number;
    subscribed: number;
    conversions: number;
  }>();

  codesSnap.forEach((doc) => {
    const data = doc.data();
    rows.set(doc.id, {
      code: doc.id,
      ownerName: data.ownerName || '',
      ownerEmail: data.ownerEmail || '',
      active: data.active !== false,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
      clicks: 0,
      androidClicks: 0,
      signups: 0,
      onboarded: 0,
      subscribed: 0,
      conversions: 0,
    });
  });

  const ensureRow = (code: string) => {
    if (!rows.has(code)) {
      rows.set(code, {
        code,
        ownerName: '',
        ownerEmail: '',
        active: true,
        createdAt: null,
        clicks: 0,
        androidClicks: 0,
        signups: 0,
        onboarded: 0,
        subscribed: 0,
        conversions: 0,
      });
    }
    return rows.get(code)!;
  };

  usersSnap.forEach((doc) => {
    const data = doc.data();
    const code = normalizeCode(data.affiliateCode);
    if (!code) return;
    const row = ensureRow(code);
    row.signups += 1;
    if (data.onboarded) row.onboarded += 1;
    const webSub = String(data.subscriptionStatus || 'none');
    const appSub = String(data.appSubscriptionStatus || 'none');
    if (['trial', 'active'].includes(webSub) || ['trial', 'active'].includes(appSub)) {
      row.subscribed += 1;
    }
  });

  clicksSnap.forEach((doc) => {
    const data = doc.data();
    const code = normalizeCode(data.code);
    if (!code) return;
    const row = ensureRow(code);
    row.clicks += 1;
    if (data.target === 'android_app') row.androidClicks += 1;
  });

  conversionsSnap.forEach((doc) => {
    const data = doc.data();
    const code = normalizeCode(data.code);
    if (!code) return;
    const row = ensureRow(code);
    row.conversions += 1;
  });

  const affiliates = Array.from(rows.values()).sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.code.localeCompare(b.code);
  });

  return NextResponse.json({
    affiliates,
    summary: {
      totalCodes: affiliates.length,
      totalClicks: affiliates.reduce((sum, row) => sum + row.clicks, 0),
      totalSignups: affiliates.reduce((sum, row) => sum + row.signups, 0),
      totalSubscribed: affiliates.reduce((sum, row) => sum + row.subscribed, 0),
    },
  });
}

export async function POST(request: NextRequest) {
  const authError = await verifyDevRequest(request);
  if (authError) return authError;

  const body = await request.json();
  const code = normalizeCode(body?.code);
  if (!code) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  await adminFirestore!.collection('affiliate_codes').doc(code).set({
    code,
    ownerName: typeof body?.ownerName === 'string' ? body.ownerName.trim() : '',
    ownerEmail: typeof body?.ownerEmail === 'string' ? body.ownerEmail.trim() : '',
    notes: typeof body?.notes === 'string' ? body.notes.trim() : '',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }, { merge: true });

  return NextResponse.json({ ok: true, code });
}

export async function PATCH(request: NextRequest) {
  const authError = await verifyDevRequest(request);
  if (authError) return authError;

  const body = await request.json();
  const code = normalizeCode(body?.code);
  if (!code) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  await adminFirestore!.collection('affiliate_codes').doc(code).set({
    active: body?.active !== false,
    updatedAt: new Date(),
  }, { merge: true });

  return NextResponse.json({ ok: true, code, active: body?.active !== false });
}
