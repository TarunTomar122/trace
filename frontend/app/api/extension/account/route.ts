import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import { getSignedInUid } from '@/lib/request-auth';
import { hasActiveSubscription, subscriptionStatuses } from '@/lib/subscription-access';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Cache-Control': 'no-store',
};

export async function GET(request: NextRequest) {
  const uid = await getSignedInUid(request);
  if (!uid || !adminFirestore) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: HEADERS });
  }
  const snapshot = await adminFirestore.collection('user_profiles').doc(uid).get();
  if (!snapshot.exists) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404, headers: HEADERS });
  }
  const profile = snapshot.data();
  const statuses = subscriptionStatuses(profile);
  const subscriptionStatus = [statuses.web, statuses.app].find((status) =>
    ['trial', 'active'].includes(status),
  ) || statuses.web || statuses.app;
  return NextResponse.json({
    uid,
    email: profile?.email || null,
    name: profile?.displayName || profile?.name || null,
    photoUrl: profile?.photoURL || null,
    subscriptionStatus,
    hasAccess: hasActiveSubscription(profile),
  }, { headers: HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}
