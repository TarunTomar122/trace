import { authorized } from '@/lib/analytics/admin-data';
import { dashboard } from '@/lib/analytics/store';
export async function GET(req:Request){
  if(!await authorized())return new Response(null,{status:401});
  const days=Number(new URL(req.url).searchParams.get('days'));
  return Response.json(dashboard(req.headers.get('host')||'', [1,7,30].includes(days)?days:7),{headers:{'Cache-Control':'private,no-store'}});
}
