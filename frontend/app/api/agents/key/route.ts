import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import { createAgentKey, getAgentKeyStatus, revokeAgentKey } from '@/lib/agent-access';
import { getSignedInUid } from '@/lib/request-auth';
import { hasActiveSubscription } from '@/lib/subscription-access';

async function requirePro(request: NextRequest) {
  const uid = await getSignedInUid(request);
  if (!uid) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!adminFirestore) {
    return { error: NextResponse.json({ error: 'Server configuration error' }, { status: 500 }) };
  }
  const profile = await adminFirestore.collection('user_profiles').doc(uid).get();
  if (!profile.exists || !hasActiveSubscription(profile.data())) {
    return {
      error: NextResponse.json(
        { error: 'Trace Agent Access requires an active Pro plan or trial' },
        { status: 402 },
      ),
    };
  }
  return { uid };
}

export async function GET(request: NextRequest) {
  try {
    const uid = await getSignedInUid(request);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await getAgentKeyStatus(uid), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('[api/agents/key] status failed:', error);
    return NextResponse.json({ error: 'Failed to load Agent Key status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requirePro(request);
    if ('error' in access) return access.error;
    const token = await createAgentKey(access.uid);
    return NextResponse.json({
      token,
      scope: 'trace:read',
      note: 'This key is shown once. Creating another key rotates it immediately.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[api/agents/key] creation failed:', error);
    return NextResponse.json({ error: 'Failed to create Agent Key' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const uid = await getSignedInUid(request);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await revokeAgentKey(uid);
    return NextResponse.json({ revoked: true }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('[api/agents/key] revocation failed:', error);
    return NextResponse.json({ error: 'Failed to revoke Agent Key' }, { status: 500 });
  }
}
