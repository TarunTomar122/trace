export type BookmarkMetadata = {
  type: 'article' | 'topic';
  title: string;
  description?: string;
  url?: string;
  thumbnail?: string | null;
  tags?: string[];
  source?: string;
  timestamp?: string;
};

export type BookmarkCursor = { bookmarkedAt: string; id: string };

const cleanText = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text && text.length <= max ? text : undefined;
};

function cleanUrl(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const text = cleanText(value, 2048);
  if (!text) throw new Error(`Invalid bookmark ${label}`);
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
    return url.toString();
  } catch {
    throw new Error(`Invalid bookmark ${label}`);
  }
}

export function normalizeBookmarkPayload(value: unknown): { itemId: string; metadata: BookmarkMetadata } {
  if (!value || typeof value !== 'object') throw new Error('Invalid bookmark payload');
  const payload = value as Record<string, unknown>;
  const itemId = cleanText(payload.item_id, 256);
  if (!itemId || itemId.includes('/')) throw new Error('Invalid bookmark item id');
  if (!payload.item_metadata || typeof payload.item_metadata !== 'object') throw new Error('Invalid bookmark metadata');

  const input = payload.item_metadata as Record<string, unknown>;
  const title = cleanText(input.title, 300);
  if (!title) throw new Error('Invalid bookmark title');
  const type = input.type === 'topic' ? 'topic' : 'article';
  const description = cleanText(input.description, 2200);
  if (input.description !== undefined && !description) throw new Error('Invalid bookmark description');
  const url = cleanUrl(input.url, 'url');
  const thumbnail = cleanUrl(input.thumbnail, 'thumbnail');
  const source = cleanText(input.source, 120);
  const timestamp = cleanText(input.timestamp, 64);
  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags.map((tag) => cleanText(tag, 40)).filter((tag): tag is string => Boolean(tag)))].slice(0, 8)
    : [];

  return {
    itemId,
    metadata: {
      type,
      title,
      ...(description ? { description } : {}),
      ...(url ? { url } : {}),
      ...(thumbnail ? { thumbnail } : {}),
      ...(tags.length ? { tags } : {}),
      ...(source ? { source } : {}),
      ...(timestamp ? { timestamp } : {}),
    },
  };
}

export function bookmarkSearchText(metadata: Pick<BookmarkMetadata, 'title' | 'description' | 'tags'>): string {
  return [metadata.title, metadata.description, ...(metadata.tags || [])]
    .filter((entry): entry is string => Boolean(entry))
    .join(' ')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function searchTermsForBookmark(metadata: Pick<BookmarkMetadata, 'title' | 'description' | 'tags'>): string[] {
  const words = [...new Set(bookmarkSearchText(metadata).split(' ').filter((word) => word.length >= 2))].slice(0, 40);
  return [...new Set(words.flatMap((word) => {
    const capped = word.slice(0, 32);
    return Array.from({ length: capped.length - 1 }, (_, index) => capped.slice(0, index + 2));
  }))];
}

export function bookmarkQueryTerms(value: string): string[] {
  return [...new Set(bookmarkSearchText({ title: value }).split(' ').filter((word) => word.length >= 2).map((word) => word.slice(0, 32)))];
}

export function encodeBookmarkCursor(cursor: BookmarkCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeBookmarkCursor(value: string): BookmarkCursor | null {
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as BookmarkCursor;
    return typeof cursor.bookmarkedAt === 'string' && typeof cursor.id === 'string' ? cursor : null;
  } catch {
    return null;
  }
}
