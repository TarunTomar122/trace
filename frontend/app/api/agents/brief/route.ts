import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentKey, bearerToken } from '@/lib/agent-access';
import { buildAgentBrief } from '@/lib/agent-brief';
import { getFeedForUid } from '@/lib/feed-server';

export async function GET(request: NextRequest) {
  try {
    const access = await authenticateAgentKey(bearerToken(request.headers.get('authorization')));
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const limit = Number(request.nextUrl.searchParams.get('limit') || 8);
    const role = request.nextUrl.searchParams.get('role') || '';
    const section = request.nextUrl.searchParams.get('section') || 'all';
    if (!['all', 'news', 'builds', 'conversations'].includes(section)) {
      return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
    }
    const feed = await getFeedForUid(access.uid, role);
    if (!feed) return NextResponse.json({ error: 'No Trace brief is available yet' }, { status: 404 });
    const brief = buildAgentBrief(feed, limit);
    const result = section === 'news'
      ? { feed_date: brief.feed_date, generated_at: brief.generated_at, top_news: brief.top_news }
      : section === 'builds'
        ? { feed_date: brief.feed_date, generated_at: brief.generated_at, builds: brief.builds }
        : section === 'conversations'
          ? { feed_date: brief.feed_date, generated_at: brief.generated_at, conversations: brief.conversations }
          : brief;
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('[api/agents/brief] failed:', error);
    return NextResponse.json({ error: 'Failed to build the Trace agent brief' }, { status: 500 });
  }
}
