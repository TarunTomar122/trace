import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

/**
 * Submit feedback endpoint
 * POST /api/feedback
 * Body: { message: string, type?: 'bug' | 'feature' | 'general' }
 */
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
    const { message, type = 'general' } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get user profile for context
    const userDoc = await adminFirestore.collection('user_profiles').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // Store feedback in Firestore
    const feedbackData = {
      user_id: userId,
      user_name: userData?.name || userData?.displayName || 'Unknown',
      user_email: userData?.email || '',
      message: message.trim(),
      type,
      status: 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const feedbackRef = await adminFirestore.collection('feedback').add(feedbackData);

    return NextResponse.json({
      success: true,
      feedback_id: feedbackRef.id,
    });
  } catch (error: any) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get all feedback (admin only - dev mode)
 * GET /api/feedback?dev=true
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  try {
    if (!adminAuth || !adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await adminAuth.verifyIdToken(token);

    // Get all feedback, sorted by created_at desc
    const feedbackSnapshot = await adminFirestore
      .collection('feedback')
      .orderBy('created_at', 'desc')
      .limit(100)
      .get();

    const feedback = feedbackSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

