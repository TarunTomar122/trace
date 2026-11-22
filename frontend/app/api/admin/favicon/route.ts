import { authorized } from '@/lib/analytics/admin-data';
import { sourceOf } from '@/lib/analytics/normalize';
export async function GET(req:Request){
  if(!await authorized())return new Response(null,{status:401});
  const host=new URL(req.url).searchParams.get('host')||'';
  if(!/^[a-z0-9.-]+$/.test(host)||sourceOf('https://'+host)!==host)return new Response(null,{status:404});
  try {
    const res=await fetch('https://icons.duckduckgo.com/ip3/'+host+'.ico',{signal:AbortSignal.timeout(2500),redirect:'error'});
    if(res.ok && /^image\/(x-icon|vnd\.microsoft\.icon|png)$/i.test(res.headers.get('content-type')||''))return new Response(res.body,{headers:{'Content-Type':res.headers.get('content-type')!,'Cache-Control':'private,max-age=86400','X-Content-Type-Options':'nosniff'}});
  }catch{}
  return new Response(null,{status:404});
}
