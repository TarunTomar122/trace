import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateGoalProgress } from './dailyGoals';

const STORAGE_KEY = '@wonder_bookmarks';

const BookmarksContext = createContext(null);

export function BookmarksProvider({ children }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load bookmarks on mount
  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setBookmarks(JSON.parse(data));
      }
      setIsLoaded(true);
    } catch (e) {
      console.error('Failed to load bookmarks:', e);
      setIsLoaded(true);
    }
  };

  const saveBookmarks = async (newBookmarks) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newBookmarks));
    } catch (e) {
      console.error('Failed to save bookmarks:', e);
    }
  };

  // Add a bookmark
  const addBookmark = useCallback((item) => {
    setBookmarks((prev) => {
      // Don't add duplicates
      if (prev.some((b) => b.id === item.id)) {
        return prev;
      }
      const newBookmarks = [
        {
          ...item,
          bookmarkedAt: new Date().toISOString(),
        },
        ...prev,
      ];
      saveBookmarks(newBookmarks);
      // Track for daily goals
      updateGoalProgress('bookmarks_added', 1);
      return newBookmarks;
    });
  }, []);

  // Remove a bookmark
  const removeBookmark = useCallback((itemId) => {
    setBookmarks((prev) => {
      const newBookmarks = prev.filter((b) => b.id !== itemId);
      saveBookmarks(newBookmarks);
      return newBookmarks;
    });
  }, []);

  // Toggle bookmark
  const toggleBookmark = useCallback((item) => {
    const isBookmarked = bookmarks.some((b) => b.id === item.id);
    if (isBookmarked) {
      removeBookmark(item.id);
    } else {
      addBookmark(item);
    }
    return !isBookmarked;
  }, [bookmarks, addBookmark, removeBookmark]);

  // Check if item is bookmarked
  const isBookmarked = useCallback((itemId) => {
    return bookmarks.some((b) => b.id === itemId);
  }, [bookmarks]);

  // Get bookmark count
  const getBookmarkCount = useCallback(() => {
    return bookmarks.length;
  }, [bookmarks]);

  // Get bookmarks by type
  const getBookmarksByType = useCallback((type) => {
    if (!type || type === 'all') return bookmarks;
    return bookmarks.filter((b) => b.type === type);
  }, [bookmarks]);

  const value = {
    bookmarks,
    isLoaded,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    isBookmarked,
    getBookmarkCount,
    getBookmarksByType,
  };

  return (
    <BookmarksContext.Provider value={value}>
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks() {
  const context = useContext(BookmarksContext);
  if (!context) {
    throw new Error('useBookmarks must be used within a BookmarksProvider');
  }
  return context;
}
