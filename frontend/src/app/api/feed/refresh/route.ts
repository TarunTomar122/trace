import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { uid } = await request.json();
    if (!uid) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400 });
    }

    if (!adminFirestore) {
      return NextResponse.json({ error: 'Firestore admin not available' }, { status: 500 });
    }

    await adminFirestore.collection('feed_jobs').add({
      uid,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Feed refresh error:', error);
    return NextResponse.json({ error: 'Failed to enqueue feed job' }, { status: 500 });
  }
}

