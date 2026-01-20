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
    const { item_id, item_metadata } = body;

    if (!item_id || !item_metadata) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Reference to user bookmarks collection
    const bookmarksRef = adminFirestore
      .collection('user_bookmarks')
      .doc(userId)
      .collection('items')
      .doc(item_id);

    // Save bookmark
    await bookmarksRef.set({
      item_id,
      item_metadata,
      bookmarked_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'Bookmark saved' });
  } catch (error: any) {
    console.error('Error saving bookmark:', error);
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

    // Get all bookmarks for user
    const bookmarksSnapshot = await adminFirestore
      .collection('user_bookmarks')
      .doc(userId)
      .collection('items')
      .orderBy('bookmarked_at', 'desc')
      .get();

    const bookmarks = bookmarksSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    return NextResponse.json({ bookmarks });
  } catch (error: any) {
    console.error('Error fetching bookmarks:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const itemId = searchParams.get('item_id');

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
    }

    // Delete bookmark
    await adminFirestore
      .collection('user_bookmarks')
      .doc(userId)
      .collection('items')
      .doc(itemId)
      .delete();

    return NextResponse.json({ success: true, message: 'Bookmark removed' });
  } catch (error: any) {
    console.error('Error removing bookmark:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

