import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { SPONSOR_PLACEMENTS, type SponsorPlacement } from '@/lib/sponsor-link';

// Counts a sponsor click (sent as a beacon by recordSponsorClick) in
// sponsor_clicks/{sponsorId}_{YYYY-MM-DD}: a daily total plus one count per
// placement. The sponsor's stats page (/sponsor/[id]) reads these.

const BOT = /bot|crawl|spider|slurp|preview|fetch|curl|wget|python|headless/i;

export async function POST(request: NextRequest) {
  try {
    if (BOT.test(request.headers.get('user-agent') || '')) return new NextResponse(null, { status: 204 });
    const body = JSON.parse((await request.text()).slice(0, 500) || '{}');
    const id = String(body.id || '');
    const placement = String(body.placement || '') as SponsorPlacement;
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id) || !SPONSOR_PLACEMENTS.includes(placement)) {
      return NextResponse.json({ error: 'Bad click' }, { status: 400 });
    }
    if (!adminDb) throw new Error('Firestore not initialized');
    const sponsor = await adminDb.collection('promoted_tools').doc(id).get();
    if (!sponsor.exists || sponsor.data()?.status !== 'active') return new NextResponse(null, { status: 204 });

    const day = new Date().toISOString().slice(0, 10);
    await adminDb.collection('sponsor_clicks').doc(`${id}_${day}`).set(
      {
        sponsor_id: id,
        day,
        clicks: FieldValue.increment(1),
        [`clicks_${placement}`]: FieldValue.increment(1),
        updated_at: new Date(),
      },
      { merge: true },
    );
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('Sponsor click error:', err);
    return new NextResponse(null, { status: 204 });
  }
}
