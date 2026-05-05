import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeedItem } from './firestore';
import { trackEvent } from './posthog';

const BOOKMARKS_KEY = '@trace_bookmarks';
const SNIPPETS_KEY = '@trace_snippets';

export interface BookmarkedItem extends FeedItem {
  bookmarkedAt: string; // ISO date string
}

export async function getBookmarks(): Promise<BookmarkedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BookmarkedItem[];
  } catch {
    return [];
  }
}

export async function addBookmark(item: FeedItem): Promise<void> {
  const bookmarks = await getBookmarks();
  // Don't add duplicates
  if (bookmarks.some((b) => b.id === item.id)) return;
  const entry: BookmarkedItem = {
    ...item,
    bookmarkedAt: new Date().toISOString(),
  };
  bookmarks.unshift(entry); // newest first
  await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  trackEvent('bookmark_added', {
    item_id: item.id,
    title: item.title,
    source: item.source_name || item.source,
    item_type: item.type || item.feed_type,
  });
}

export async function removeBookmark(itemId: string): Promise<void> {
  const bookmarks = await getBookmarks();
  const removed = bookmarks.find((b) => b.id === itemId);
  const filtered = bookmarks.filter((b) => b.id !== itemId);
  await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(filtered));
  trackEvent('bookmark_removed', {
    item_id: itemId,
    title: removed?.title,
  });
}

export async function isBookmarked(itemId: string): Promise<boolean> {
  const bookmarks = await getBookmarks();
  return bookmarks.some((b) => b.id === itemId);
}

export async function toggleBookmark(item: FeedItem): Promise<boolean> {
  const exists = await isBookmarked(item.id);
  if (exists) {
    await removeBookmark(item.id);
    return false;
  } else {
    await addBookmark(item);
    return true;
  }
}

// ─── Snippets (saved excerpts from deep dives) ───

export interface Snippet {
  id: string;
  content: string;
  label: string;
  savedAt: string;
}

export async function getSnippets(): Promise<Snippet[]> {
  try {
    const raw = await AsyncStorage.getItem(SNIPPETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Snippet[];
  } catch {
    return [];
  }
}

export async function addSnippet(content: string, label: string): Promise<void> {
  const snippets = await getSnippets();
  const id = `snippet_${Date.now()}`;
  const entry: Snippet = {
    id,
    content,
    label,
    savedAt: new Date().toISOString(),
  };
  snippets.unshift(entry);
  await AsyncStorage.setItem(SNIPPETS_KEY, JSON.stringify(snippets));
  trackEvent('snippet_added', { snippet_id: id, label });
}

export async function removeSnippet(snippetId: string): Promise<void> {
  const snippets = await getSnippets();
  const removed = snippets.find((s) => s.id === snippetId);
  const filtered = snippets.filter((s) => s.id !== snippetId);
  await AsyncStorage.setItem(SNIPPETS_KEY, JSON.stringify(filtered));
  trackEvent('snippet_removed', { snippet_id: snippetId, label: removed?.label });
}

