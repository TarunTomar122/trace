import { authorized } from '@/lib/analytics/admin-data';
import { loadDashboard, parseRange } from '@/lib/analytics/dashboard';
import { analyticsNamespace } from '@/lib/analytics/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The Visitors tab's numbers as JSON (?range=today|7d|30d|90d), admin only. */
export async function GET(req: Request) {
  if (!(await authorized())) return new Response(null, { status: 401 });
  try {
    const data = await loadDashboard(analyticsNamespace(req.headers.get('host')), parseRange(new URL(req.url).searchParams.get('range')));
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
