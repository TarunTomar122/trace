import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

/**
 * DEV ONLY: Get all subscribed users
 * GET /api/dev/users
 */
export async function GET(request: NextRequest) {
  // Only allow in development environment
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  try {
    if (!adminAuth || !adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Verify the requesting user is authenticated
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await adminAuth.verifyIdToken(token);

    // Get all onboarded users with subscription
    const usersSnapshot = await adminFirestore
      .collection('user_profiles')
      .where('onboarded', '==', true)
      .get();

    const users = usersSnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          name: data.name || '',
          displayName: data.displayName || '',
          email: data.email || '',
          interests: data.interests || [],
          subscriptionStatus: data.subscriptionStatus || 'none',
        };
      })
      .filter(u => ['trial', 'active'].includes(u.subscriptionStatus))
      .sort((a, b) => (a.name || a.displayName).localeCompare(b.name || b.displayName));

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

