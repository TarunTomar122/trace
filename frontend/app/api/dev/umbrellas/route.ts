import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

type CachedResult = {
  cachedAt: number;
  limit: number;
  includeSubqueries: boolean;
  data: unknown;
};

let cache: CachedResult | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * DEV ONLY: Get umbrellas and subqueries with basic caching.
 * GET /api/dev/umbrellas?limit=50&includeSubqueries=1
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const includeSubqueries = searchParams.get('includeSubqueries') === '1';
    const limit = Math.max(1, Math.min(200, Number(limitParam || 50)));

    if (
      cache &&
      Date.now() - cache.cachedAt < CACHE_TTL_MS &&
      cache.limit === limit &&
      cache.includeSubqueries === includeSubqueries
    ) {
      return NextResponse.json({ cached: true, umbrellas: cache.data });
    }

    const snapshot = await adminFirestore
      .collection('umbrellas')
      .orderBy('user_count', 'desc')
      .limit(limit)
      .get();

    const umbrellas = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.id || doc.id,
        display_name: data.display_name || data.id || doc.id,
        user_count: data.user_count || 0,
        sub_queries: includeSubqueries ? (data.sub_queries || []) : [],
        sub_query_count: Array.isArray(data.sub_queries) ? data.sub_queries.length : 0,
        last_discovery_refresh: data.last_discovery_refresh || null,
      };
    });

    cache = {
      cachedAt: Date.now(),
      limit,
      includeSubqueries,
      data: umbrellas,
    };

    return NextResponse.json({ cached: false, umbrellas });
  } catch (error: any) {
    console.error('Error fetching umbrellas:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

