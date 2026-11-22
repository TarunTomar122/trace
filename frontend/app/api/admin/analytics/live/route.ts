import { authorized } from '@/lib/analytics/admin-data';
import { live } from '@/lib/analytics/store';
export async function GET(req:Request){
  if(!await authorized())return new Response(null,{status:401});
  return Response.json({live:live(req.headers.get('host')||'')},{headers:{'Cache-Control':'private,no-store'}});
}
