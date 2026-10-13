import { NextRequest, NextResponse } from 'next/server';
import { createAgentKey, getAgentKeyStatus, revokeAgentKey } from '@/lib/agent-access';
import { getSignedInUid } from '@/lib/request-auth';

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
    const uid = await getSignedInUid(request);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = await createAgentKey(uid);
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
