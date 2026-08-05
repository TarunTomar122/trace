import { NextResponse } from 'next/server';
import { buildExtensionBrief, hasCompleteExtensionPool } from '@/lib/extension-brief';
import { getPublicBootstrapFeed } from '@/lib/feed-server';

export const revalidate = 900;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SUCCESS_HEADERS = {
  ...CORS_HEADERS,
  'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
};

const FAILURE_HEADERS = {
  ...CORS_HEADERS,
  'Cache-Control': 'no-store',
};

export async function GET() {
  try {
    const feed = await getPublicBootstrapFeed('developer');
    if (!feed) {
      return NextResponse.json(
        { error: 'No public Trace brief is available yet' },
        { status: 503, headers: FAILURE_HEADERS },
      );
    }

    const brief = buildExtensionBrief(feed);
    if (!hasCompleteExtensionPool(brief.articles)) {
      return NextResponse.json(
        { error: 'Article pool is incomplete' },
        { status: 503, headers: FAILURE_HEADERS },
      );
    }

    return NextResponse.json(brief, {
      headers: SUCCESS_HEADERS,
    });
  } catch (error) {
    console.error('[api/extension/brief] failed:', error);
    return NextResponse.json(
      { error: 'Failed to build the Trace extension brief' },
      { status: 500, headers: FAILURE_HEADERS },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
