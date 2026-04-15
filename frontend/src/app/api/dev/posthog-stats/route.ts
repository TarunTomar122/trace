import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

/**
 * DEV ONLY: Get PostHog visitor stats using HogQL query API
 * GET /api/dev/posthog-stats?days=7
 */
export async function GET(request: NextRequest) {
  // Only allow in development environment
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  try {
    // Verify the requesting user is authenticated
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await adminAuth?.verifyIdToken(token);

    const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
    if (!personalApiKey) {
      return NextResponse.json({
        error: 'PostHog Personal API Key not configured',
        hint: 'Add POSTHOG_PERSONAL_API_KEY to your .env file'
      }, { status: 500 });
    }

    const days = parseInt(request.nextUrl.searchParams.get('days') || '30');
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com';

    // Use HogQL query API for pageviews and unique visitors
    const queryResponse = await fetch(`${posthogHost}/api/projects/@current/query/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${personalApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: {
          kind: 'HogQLQuery',
          query: `
            SELECT
              toDate(timestamp) as date,
              count() as pageviews,
              count(DISTINCT distinct_id) as visitors
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= now() - INTERVAL ${days} DAY
            GROUP BY date
            ORDER BY date ASC
          `
        }
      }),
    });

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      console.error('PostHog Query API error:', errorText);
      return NextResponse.json({
        error: 'PostHog API error',
        details: errorText
      }, { status: 500 });
    }

    const queryData = await queryResponse.json();

    // Parse HogQL response - results are in queryData.results as array of arrays
    const dailyStats: { date: string; pageviews: number; visitors: number }[] = [];

    if (queryData.results) {
      queryData.results.forEach((row: any[]) => {
        dailyStats.push({
          date: row[0], // date
          pageviews: row[1] || 0, // pageviews count
          visitors: row[2] || 0, // unique visitors count
        });
      });
    }

    // Calculate totals
    const totalPageviews = dailyStats.reduce((sum, d) => sum + d.pageviews, 0);
    const totalVisitors = dailyStats.reduce((sum, d) => sum + d.visitors, 0);

    return NextResponse.json({
      dailyStats,
      totals: {
        pageviews: totalPageviews,
        visitors: totalVisitors,
      },
      period: { days },
    });
  } catch (error) {
    console.error('Error fetching PostHog stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
