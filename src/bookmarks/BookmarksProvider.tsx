import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  BOOKMARK_STORAGE_KEY,
  createBookmark,
  parseBookmarks,
  type BookmarkTarget,
  type QuranBookmark,
} from '@/bookmarks/bookmarks';

type BookmarksContextValue = {
  bookmarks: readonly QuranBookmark[];
  ready: boolean;
  isBookmarked: (key: BookmarkTarget['key']) => boolean;
  toggleBookmark: (target: BookmarkTarget) => void;
  removeBookmark: (key: BookmarkTarget['key']) => void;
};

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(BOOKMARK_STORAGE_KEY)
      .then((raw) => {
        if (active) setBookmarks(parseBookmarks(raw));
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarks));
  }, [bookmarks, ready]);

  const isBookmarked = useCallback(
    (key: BookmarkTarget['key']) => bookmarks.some((bookmark) => bookmark.target.key === key),
    [bookmarks],
  );

  const toggleBookmark = useCallback((target: BookmarkTarget) => {
    setBookmarks((current) => {
      const existing = current.some((bookmark) => bookmark.target.key === target.key);
      if (existing) return current.filter((bookmark) => bookmark.target.key !== target.key);
      return [createBookmark(target), ...current];
    });
  }, []);

  const removeBookmark = useCallback((key: BookmarkTarget['key']) => {
    setBookmarks((current) => current.filter((bookmark) => bookmark.target.key !== key));
  }, []);

  const value = useMemo<BookmarksContextValue>(
    () => ({ bookmarks, ready, isBookmarked, toggleBookmark, removeBookmark }),
    [bookmarks, isBookmarked, ready, removeBookmark, toggleBookmark],
  );

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export function useBookmarks() {
  const value = useContext(BookmarksContext);
  if (!value) throw new Error('useBookmarks must be used inside BookmarksProvider.');
  return value;
}
