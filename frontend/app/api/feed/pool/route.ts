import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

/**
 * Get items from the retrieval pool
 * - ?mode=sample&limit=10 - Get diverse mix from different topics (for unsubscribed users)
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
    await adminAuth.verifyIdToken(token);

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    let items: any[] = [];
    
    if (mode === 'sample') {
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
      source: mode === 'sample' ? 'general_feed' : 'retrieval_pool'
    });
  } catch (error: any) {
    console.error('Error fetching pool:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

