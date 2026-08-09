import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { TRACE_SESSION_COOKIE_NAME, verifyTraceSession } from '@/lib/server-session';
import { FREE_READS_LIMIT } from '@/lib/free-reads';
import { hasActiveSubscription } from '@/lib/subscription-access';

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getUid(request: NextRequest): Promise<string | null> {
  try {
    const sessionCookie = request.cookies.get(TRACE_SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const decoded = verifyTraceSession(sessionCookie);
      if (decoded) return decoded.uid;
    }
  } catch {
    // fall through
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ') && adminAuth) {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await adminAuth.verifyIdToken(token);
      return decoded.uid;
    }
  } catch {
    // fall through
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const uid = await getUid(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminFirestore) {
      return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    const today = getTodayDate();
    const profile = await adminFirestore.collection('user_profiles').doc(uid).get();
    if (hasActiveSubscription(profile.data())) {
      return NextResponse.json(
        { access: 'pro', date: today, ids: [], count: 0 },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const docRef = adminFirestore.collection('free_reads').doc(`${uid}_${today}`);
    const doc = await docRef.get();
    const data = doc.exists ? doc.data() : null;
    const ids: string[] = data?.ids || [];

    return NextResponse.json(
      { access: 'free', date: today, ids, count: ids.length },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[api/feed/reads] GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = await getUid(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminFirestore) {
      return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const articleId = String(body.articleId || '').trim();
    if (!articleId) {
      return NextResponse.json({ error: 'Missing articleId' }, { status: 400 });
    }

    const today = getTodayDate();
    const profile = await adminFirestore.collection('user_profiles').doc(uid).get();
    if (hasActiveSubscription(profile.data())) {
      return NextResponse.json(
        { access: 'pro', date: today, canRead: true, count: 0, ids: [] },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const docRef = adminFirestore.collection('free_reads').doc(`${uid}_${today}`);

    const result = await adminFirestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      const ids: string[] = doc.exists ? (doc.data()?.ids || []) : [];

      if (ids.includes(articleId)) {
        return { canRead: true, count: ids.length, ids };
      }

      if (ids.length >= FREE_READS_LIMIT) {
        return { canRead: false, count: ids.length, ids };
      }

      const newIds = [...ids, articleId];
      transaction.set(docRef, { ids: newIds, updatedAt: new Date() }, { merge: true });
      return { canRead: true, count: newIds.length, ids: newIds };
    });

    return NextResponse.json(
      {
        access: 'free',
        date: today,
        canRead: result.canRead,
        count: result.count,
        ids: result.ids,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[api/feed/reads] POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
