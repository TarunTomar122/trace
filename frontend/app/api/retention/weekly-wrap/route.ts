import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import { getSignedInUid } from '@/lib/request-auth';

export async function GET(request: NextRequest) {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const uid = await getSignedInUid(request);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const snap = await adminFirestore
      .collection('user_weekly_wraps')
      .doc(uid)
      .collection('weeks')
      .orderBy('generated_at', 'desc')
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ wrap: null });
    }

    const data = snap.docs[0].data();
    return NextResponse.json({
      wrap: {
        week_id: data.week_id || snap.docs[0].id,
        headline: data.headline || '',
        summary: data.summary || '',
        total_articles: Number(data.total_articles) || 0,
        top_topics: Array.isArray(data.top_topics) ? data.top_topics : [],
        fun_stat: data.fun_stat || '',
        start_date: data.start_date || '',
        end_date: data.end_date || '',
      },
    });
  } catch (error) {
    console.error('[api/retention/weekly-wrap] GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
