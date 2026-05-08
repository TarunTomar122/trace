import { NextResponse } from 'next/server';
import { getHeroHeadlines } from '@/lib/hero-headlines';

export const revalidate = 3600;

export type { HeroHeadline } from '@/lib/hero-headlines';

export async function GET() {
  try {
    const headlines = await getHeroHeadlines();
    return NextResponse.json(
      { headlines },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    );
  } catch (err) {
    console.error('[hero-headlines]', err);
    return NextResponse.json({ headlines: [] });
  }
}
