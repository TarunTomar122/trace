import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeedItem } from './firestore';

const BOOKMARKS_KEY = '@trace_bookmarks';

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
}

export async function removeBookmark(itemId: string): Promise<void> {
  const bookmarks = await getBookmarks();
  const filtered = bookmarks.filter((b) => b.id !== itemId);
  await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(filtered));
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

