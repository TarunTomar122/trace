import { NextResponse } from 'next/server';
import { keepLastGoodPage, loadFeedViewData } from '@/lib/feed-view';
import { buildExtensionStories } from '@/lib/extension-stories';
import { SPONSOR_SLOTS } from '@/lib/sponsor-link';

// The Chrome extension's new tab: the site's Home stories (one per event) and its sponsors.
export const revalidate = 600;

const ORIGIN = 'https://www.yourtrace.online';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET() {
  const data = await loadFeedViewData();
  // A failed feed or sponsor read must not become the cached answer for 10 minutes (an error,
  // or paying sponsors missing): in production this throws, and the last good response stays.
  keepLastGoodPage(data);
  try {
    const payload = buildExtensionStories(data, { origin: ORIGIN, slots: SPONSOR_SLOTS });
    if (data.feedError || payload.stories.length < 8) {
      return NextResponse.json(
        { error: 'No Trace stories are available yet' },
        { status: 503, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(payload, {
      headers: { ...CORS_HEADERS, 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error('[api/extension/stories] failed:', error);
    return NextResponse.json(
      { error: 'Failed to load Trace stories' },
      { status: 500, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
