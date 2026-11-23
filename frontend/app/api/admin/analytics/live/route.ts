import { authorized } from '@/lib/analytics/admin-data';
import { loadLive } from '@/lib/analytics/dashboard';
import { analyticsNamespace } from '@/lib/analytics/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The Live now panel's poll (components/admin-analytics/live-now.tsx): the last five minutes, admin only. */
export async function GET(req: Request) {
  if (!(await authorized())) return new Response(null, { status: 401 });
  try {
    const live = await loadLive(analyticsNamespace(req.headers.get('host')));
    return Response.json(live, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
