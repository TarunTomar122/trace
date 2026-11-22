// Firebase Admin runs in Node on the VPS. Cache only anonymous full-page HTML
// and immutable build assets. Personalized and RSC responses bypass the cache.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    const get = request.method === 'GET';
    const buildAsset = get && !url.search && url.pathname.startsWith('/_next/static/');
    const publicHtml = get && ['/', '/feed'].includes(url.pathname) &&
      !url.search && !['cookie', 'authorization', 'rsc', 'range', 'next-url',
        'next-router-state-tree', 'next-router-prefetch', 'next-router-segment-prefetch',
        'next-action', 'purpose', 'sec-purpose'].some(name => headers.has(name)) &&
      headers.get('accept')?.includes('text/html');
    const cacheable = (buildAsset || publicHtml) && !headers.has('range');
    const key = new Request(url.origin + url.pathname);
    if (cacheable) {
      const hit = await caches.default.match(key);
      if (hit) {
        if (buildAsset) return hit;
        const html = new Response(hit.body, hit);
        html.headers.delete('Server-Timing');
        html.headers.set('Cache-Control', 'private, no-store');
        return html;
      }
    }
    for (const name of [...headers.keys()]) {
      if (name.startsWith('x-forwarded-') || name.startsWith('x-middleware-') ||
          name.startsWith('x-nextjs-') || ['host', 'forwarded', 'x-real-ip'].includes(name)) headers.delete(name);
    }
    if (cacheable) {
      for (const name of [...headers.keys()]) headers.delete(name);
      headers.set('Accept', publicHtml ? 'text/html' : '*/*');
    }
    headers.set('X-Trace-Client-IP', request.headers.get('CF-Connecting-IP') || '');
    headers.set('X-Trace-Origin-Key', env.ORIGIN_KEY);
    headers.set('X-Trace-Public-Host', url.host);
    const origin = new URL('https://db.yourtrace.online');
    origin.pathname = '/_trace_web' + url.pathname;
    origin.search = url.search;
    const reply = await fetch(origin, {
      method: request.method, headers, body: request.body, redirect: 'manual',
      cf: { cacheTtl: -1, cacheEverything: false },
    });
    const response = new Response(reply.body, reply);
    if (url.hostname.endsWith('.workers.dev')) response.headers.set('X-Robots-Tag', 'noindex');
    if (cacheable && reply.status === 200 && !reply.headers.has('set-cookie') &&
        !/private|no-store/i.test(reply.headers.get('cache-control') || '') &&
        (buildAsset || reply.headers.get('content-type')?.startsWith('text/html'))) {
      const cached = response.clone();
      cached.headers.set('Cache-Control', buildAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=60');
      ctx.waitUntil(caches.default.put(key, cached));
    }
    if (publicHtml) response.headers.set('Cache-Control', 'private, no-store');
    return response;
  },
};
