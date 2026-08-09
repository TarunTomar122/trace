import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import {
  createExtensionSession,
  extensionBearerToken,
  revokeExtensionSession,
} from '@/lib/extension-session';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Cache-Control': 'no-store',
};

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || !adminAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: HEADERS });
  }
  try {
    const { uid } = await adminAuth.verifyIdToken(authorization.slice(7).trim());
    return NextResponse.json(await createExtensionSession(uid), { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: HEADERS });
  }
}

export async function DELETE(request: NextRequest) {
  const token = extensionBearerToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: HEADERS });
  await revokeExtensionSession(token);
  return NextResponse.json({ success: true }, { headers: HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}
