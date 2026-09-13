/**
 * Shared placeholder-URL check for article/thumbnail images.
 *
 * YouTube stills are named ...default.jpg (hqdefault, maxresdefault), so
 * "default" only means placeholder when it is a standalone token in the
 * path or query string — never when it is fused into a filename.
 */
export function imageUrlHasPlaceholderToken(url: string): boolean {
  if (url.includes('placeholder')) return true;
  return /(^|[\/_.=?-])default([\/_.=&-]|$)/i.test(url);
}
