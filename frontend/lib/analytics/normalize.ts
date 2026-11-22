// Only public route templates leave the browser or enter the analytics database.
const roots = new Set('feed brief blog newsletters agents articles resources tools solutions compare story featured use-cases how-it-works contact terms privacy-policy onboarding waitlist sponsor delete-account'.split(' '));
export function routeOf(path: unknown): string | null {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
  const clean = path.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  if (!clean) return '/';
  const [,root,sub] = clean.split('/');
  if (!roots.has(root)) return null;
  if (!sub) return '/' + root;
  if (clean === '/brief/customize') return clean;
  return '/' + root + '/[page]';
}
export const PRODUCTION_HOSTS = ['www.yourtrace.online','yourtrace.online'];
const sources = ['google','bing','duckduckgo','reddit','github','linkedin','facebook','youtube','instagram','ycombinator','tiktok','substack','threads','perplexity'];
export function sourceOf(input: unknown) {
  if (!input) return 'Direct';
  if (typeof input !== 'string') return 'Other sites';
  try {
    const h = new URL(input).hostname.toLowerCase();
    if (PRODUCTION_HOSTS.includes(h)) return 'Internal';
    const allowed = [...sources.map(s => s+'.com'),'x.com','t.co','twitter.com','bsky.app','news.ycombinator.com','perplexity.ai'];
    return allowed.reverse().find(s => h === s || h.endsWith('.'+s)) ?? 'Other sites';
  } catch { return 'Other sites'; }
}
