import { NextResponse } from 'next/server';
import { getLatestPool } from '@/lib/daily-editions';

/**
 * GET /api/newsletter/pool — the stories behind the newest daily brief.
 *
 * Public: the newsletter builder previews any combination of topics and
 * story count from this, client-side, with the sender's own allocation
 * (lib/newsletter-select.ts). It changes once a morning.
 */
export const revalidate = 600;

export async function GET() {
  const latest = await getLatestPool();
  if (!latest) return NextResponse.json({ date: null, pool: [] });
  return NextResponse.json(latest, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
  });
}
