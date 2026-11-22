/** Standalone Next can use its loopback listener for request.url. Only accept
 * explicitly configured public origins when reconstructing external links. */
export function publicRequestOrigin(request: Request): string {
  const host = request.headers.get('host');
  const candidate = 'https://' + host;
  const allowed = (process.env.TRACE_PUBLIC_ORIGINS || '').split(',').map(value => value.trim());
  return host && allowed.includes(candidate) ? candidate : new URL(request.url).origin;
}
