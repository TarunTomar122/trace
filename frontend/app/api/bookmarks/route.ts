import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import {
  bookmarkQueryTerms,
  bookmarkSearchText,
  decodeBookmarkCursor,
  encodeBookmarkCursor,
  normalizeBookmarkPayload,
  searchTermsForBookmark,
} from '@/lib/bookmarks';
import { getSignedInUid } from '@/lib/request-auth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const json = (body: unknown, init?: { status?: number }) => NextResponse.json(body, {
  ...init,
  headers: CORS_HEADERS,
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

export async function POST(request: NextRequest) {
  try {
    if (!adminFirestore) {
      return json({ error: 'Server configuration error' }, { status: 500 });
    }
    const userId = await getSignedInUid(request);
    if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

    let bookmark;
    try {
      bookmark = normalizeBookmarkPayload(await request.json());
    } catch (error) {
      return json({ error: getErrorMessage(error) }, { status: 400 });
    }

    const bookmarksRef = adminFirestore
      .collection('user_bookmarks')
      .doc(userId)
      .collection('items')
      .doc(bookmark.itemId);

    const now = new Date().toISOString();
    await adminFirestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(bookmarksRef);
      transaction.set(bookmarksRef, {
        item_id: bookmark.itemId,
        item_metadata: bookmark.metadata,
        bookmarked_at: existing.data()?.bookmarked_at || now,
        updated_at: now,
        search_text: bookmarkSearchText(bookmark.metadata),
        search_terms: searchTermsForBookmark(bookmark.metadata),
      });
    });

    return json({ success: true, message: 'Bookmark saved' });
  } catch (error: unknown) {
    console.error('Error saving bookmark:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!adminFirestore) {
      return json({ error: 'Server configuration error' }, { status: 500 });
    }
    const userId = await getSignedInUid(request);
    if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
    const itemIds = [...new Set(
      new URL(request.url).searchParams.get('item_ids')?.split(',').map((id) => id.trim()).filter(Boolean) || []
    )].filter((id) => id.length <= 256 && !id.includes('/')).slice(0, 100);

    if (itemIds.length > 0) {
      const collection = adminFirestore.collection('user_bookmarks').doc(userId).collection('items');
      const docs = await adminFirestore.getAll(...itemIds.map((id) => collection.doc(id)));
      return json({
        bookmarks: docs.filter((doc) => doc.exists).map((doc) => ({ ...doc.data(), id: doc.id })),
      });
    }

    const searchParams = new URL(request.url).searchParams;
    const pageSize = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 100);
    const cursorValue = searchParams.get('cursor');
    const cursor = cursorValue ? decodeBookmarkCursor(cursorValue) : null;
    if (cursorValue && !cursor) {
      return json({ error: 'Invalid cursor' }, { status: 400 });
    }

    const requestedTokens = bookmarkQueryTerms(searchParams.get('q') || '');
    if (searchParams.has('q') && requestedTokens.length === 0) {
      return json({ bookmarks: [], nextCursor: null });
    }
    const collection = adminFirestore.collection('user_bookmarks').doc(userId).collection('items');
    const scanSize = requestedTokens.length > 0 ? Math.min(pageSize * 4, 400) : pageSize + 1;
    let query = requestedTokens.length > 0
      ? collection.where('search_terms', 'array-contains', requestedTokens.sort((a, b) => b.length - a.length)[0])
      : collection.orderBy('bookmarked_at', 'desc');
    query = query.orderBy(FieldPath.documentId(), 'desc').limit(scanSize);

    if (cursor) {
      query = requestedTokens.length > 0
        ? query.startAfter(cursor.id)
        : query.startAfter(cursor.bookmarkedAt, cursor.id);
    }

    const bookmarksSnapshot = await query.get();
    const matchingDocs = requestedTokens.length > 0
      ? bookmarksSnapshot.docs.filter((doc) => requestedTokens.every((token) => String(doc.data().search_text || '').split(' ').some((word) => word.startsWith(token))))
      : bookmarksSnapshot.docs;
    const pageDocs = matchingDocs.slice(0, pageSize);
    const cursorDoc = pageDocs.length === pageSize ? pageDocs.at(-1) : bookmarksSnapshot.docs.at(-1);

    const bookmarks = pageDocs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    return json({
      bookmarks,
      nextCursor: cursorDoc && (pageDocs.length === pageSize || bookmarksSnapshot.docs.length === scanSize)
        ? encodeBookmarkCursor({
            bookmarkedAt: String(cursorDoc.data().bookmarked_at || ''),
            id: cursorDoc.id,
          })
        : null,
    });
  } catch (error: unknown) {
    console.error('Error fetching bookmarks:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!adminFirestore) {
      return json({ error: 'Server configuration error' }, { status: 500 });
    }
    const userId = await getSignedInUid(request);
    if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');

    if (!itemId || itemId.length > 256 || itemId.includes('/')) {
      return json({ error: 'Item ID required' }, { status: 400 });
    }
    await adminFirestore
      .collection('user_bookmarks')
      .doc(userId)
      .collection('items')
      .doc(itemId)
      .delete();

    return json({ success: true, message: 'Bookmark removed' });
  } catch (error: unknown) {
    console.error('Error removing bookmark:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
