import { NextResponse } from 'next/server';
import { fetchGithubTrending, fetchHnTopStories } from '@/lib/pulse-live';

export const revalidate = 900;

export async function GET() {
  try {
    const [discussions, tools] = await Promise.all([
      fetchHnTopStories(6),
      fetchGithubTrending(6),
    ]);

    return NextResponse.json(
      { discussions, tools },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        },
      },
    );
  } catch (error) {
    console.error('[api/pulse/live] Error:', error);
    return NextResponse.json({ discussions: [], tools: [] }, { status: 500 });
  }
}
