import type { FeedItem } from '@/lib/firestore';

/**
 * Pure text helpers (safe for RSC and shared with client code).
 * Keep free of React hooks and browser-only APIs.
 */

/** Decode common HTML character references (e.g. &#8217; → '). No DOM. */
export function decodeHtmlEntities(str: string): string {
  if (!str) return str;
  const toChar = (c: number, full: string) => {
    if (!Number.isFinite(c) || c < 1 || c > 0x10ffff) return full;
    return String.fromCodePoint(c);
  };
  return str
    .replace(/&#x([0-9A-Fa-f]+);/g, (full, h) => toChar(parseInt(h, 16), full))
    .replace(/&#(\d+);/g, (full, d) => toChar(parseInt(d, 10), full))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function stripMarkdown(text: string): string {
  return (text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^\s*#+\s*/gm, '')
    .trim();
}

export function getArticleSummary(item: FeedItem): string {
  return stripMarkdown(
    item.summary?.short_article?.body ||
      item.summary?.short_article?.subtitle ||
      item.description ||
      '',
  );
}

export function getPreview(text: string, maxLen = 100): string {
  if (!text) return '';
  const clean = stripMarkdown(text);
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen).trim()}...`;
}
