import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    if (!adminAuth || !adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { item_id, action, item_metadata, feed_date, note } = body;

    if (!item_id || !action || !['upvote', 'downvote', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const date = feed_date || new Date().toISOString().split('T')[0];

    // Reference to the daily interactions document
    const interactionsRef = adminFirestore
      .collection('user_interactions')
      .doc(userId)
      .collection('daily')
      .doc(date);

    const doc = await interactionsRef.get();
    const existingData = doc.data() || { items: [] };
    let interactions: any[] = existingData.items || [];

    // Remove any existing interaction for this item
    interactions = interactions.filter((i: any) => i.item_id !== item_id);

    // If not removing, add new interaction
    if (action !== 'remove') {
      const interaction: any = {
        item_id,
        action,
        timestamp: new Date().toISOString(),
        item_metadata: item_metadata || {},
      };

      if (note) {
        interaction.note = note;
      }

      interactions.push(interaction);
    }

    // Save back to Firestore
    await interactionsRef.set(
      {
        date,
        items: interactions,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );

    const message = action === 'remove' ? 'Vote removed' : `${action} recorded`;
    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('Error recording interaction:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!adminAuth || !adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const doc = await adminFirestore
      .collection('user_interactions')
      .doc(userId)
      .collection('daily')
      .doc(date)
      .get();

    const data = doc.data();
    const interactions = data?.items || [];

    return NextResponse.json({ interactions, date });
  } catch (error: any) {
    console.error('Error fetching interactions:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

