import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

/**
 * Get items from the retrieval pool
 * - ?mode=personalized&limit=40 - Get items matching user's interests (for unsubscribed but onboarded users)
 * - ?mode=sample&limit=10 - Get diverse mix from different topics (fallback)
 * - Default: Get all items (dev mode)
 */
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

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const userId = decodedToken.uid;

    let items: any[] = [];
    
    if (mode === 'personalized') {
      // Get items matching user's interests from their profile
      // This is for unsubscribed but onboarded users
      
      // Fetch user profile to get interests
      const userProfileDoc = await adminFirestore
        .collection('user_profiles')
        .doc(userId)
        .get();
      
      if (!userProfileDoc.exists) {
        return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
      }
      
      const userProfile = userProfileDoc.data();
      const interests = userProfile?.interests || [];
      
      if (interests.length === 0) {
        // If no interests, fall back to sample mode
        return NextResponse.json({ 
          items: [], 
          count: 0,
          source: 'personalized_feed'
        });
      }
      
      // Normalize interests to umbrella_ids (same logic as backend)
      const normalizeInterest = (interest: string) => {
        return interest.toLowerCase().trim().replace(/ /g, '-').replace(/&/g, 'and');
      };
      
      const umbrellaIds = interests.map((interest: string) => normalizeInterest(interest));
      
      // Fetch pool items matching user's umbrellas
      const poolItemsByUmbrella: Record<string, any[]> = {};
      
      for (const umbrellaId of umbrellaIds) {
        const poolSnapshot = await adminFirestore
          .collection('retrieval_pool')
          .where('umbrella_id', '==', umbrellaId)
          .orderBy('trending_score', 'desc')
          .limit(20) // Get top 20 per umbrella
          .get();
        
        if (!poolSnapshot.empty) {
          poolItemsByUmbrella[umbrellaId] = poolSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
      }
      
      // Round-robin pick from each umbrella to ensure diversity
      const umbrellaKeys = Object.keys(poolItemsByUmbrella);
      if (umbrellaKeys.length === 0) {
        // No items found for user interests
        return NextResponse.json({ 
          items: [], 
          count: 0,
          source: 'personalized_feed'
        });
      }
      
      let idx = 0;
      const picked = new Set<string>();
      
      while (items.length < limit && picked.size < umbrellaKeys.reduce((sum, key) => sum + poolItemsByUmbrella[key].length, 0)) {
        const umbrellaKey = umbrellaKeys[idx % umbrellaKeys.length];
        const umbrellaItems = poolItemsByUmbrella[umbrellaKey];
        
        // Find next unpicked item from this umbrella
        for (const item of umbrellaItems) {
          if (!picked.has(item.id)) {
            picked.add(item.id);
            items.push({
              ...item,
              metadata: {
                why_relevant: `Matches your interest in ${umbrellaKey.replace(/-/g, ' ')}`,
                feed_category: 'personalized_preview',
                ...item.metadata,
              }
            });
            break;
          }
        }
        idx++;
        
        // Safety: break if we've gone through all umbrellas many times without adding
        if (idx > umbrellaKeys.length * 50) break;
      }
    } else if (mode === 'sample') {
      // Get a diverse mix from different topics for unsubscribed users
      // Fetch more items, group by umbrella, pick top from each
      const poolSnapshot = await adminFirestore
        .collection('retrieval_pool')
        .orderBy('trending_score', 'desc')
        .limit(100)
        .get();

      // Group items by umbrella_id
      const byUmbrella: Record<string, any[]> = {};
      poolSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const umbrella = data.umbrella_id || 'general';
        if (!byUmbrella[umbrella]) {
          byUmbrella[umbrella] = [];
        }
        byUmbrella[umbrella].push({ id: doc.id, ...data });
      });

      // Round-robin pick from each umbrella to ensure diversity
      const umbrellas = Object.keys(byUmbrella);
      let idx = 0;
      const picked = new Set<string>();
      
      while (items.length < limit && picked.size < poolSnapshot.docs.length) {
        const umbrella = umbrellas[idx % umbrellas.length];
        const umbrellaItems = byUmbrella[umbrella];
        
        // Find next unpicked item from this umbrella
        for (const item of umbrellaItems) {
          if (!picked.has(item.id)) {
            picked.add(item.id);
            items.push({
              ...item,
              metadata: {
                why_relevant: `Popular in ${umbrella.replace(/_/g, ' ')}`,
                feed_category: 'general',
                ...item.metadata,
              }
            });
            break;
          }
        }
        idx++;
        
        // Safety: break if we've gone through all umbrellas without adding anything
        if (idx > umbrellas.length * 10) break;
      }
    } else {
      // Default: Get recent items (dev mode)
      const poolSnapshot = await adminFirestore
        .collection('retrieval_pool')
        .orderBy('fetched_at', 'desc')
        .limit(100)
        .get();

      items = poolSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          metadata: {
            why_relevant: data.why_relevant || `From pool: ${data.umbrella_id || 'general'}`,
            feed_category: 'pool',
            ...data.metadata,
          }
        };
      });
    }

    return NextResponse.json({ 
      items, 
      count: items.length,
      source: mode === 'personalized' ? 'personalized_feed' : (mode === 'sample' ? 'general_feed' : 'retrieval_pool')
    });
  } catch (error: any) {
    console.error('Error fetching pool:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

