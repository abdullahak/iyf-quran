import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  RECENT_PAGES_STORAGE_KEY,
  addRecentPage,
  createRecentPage,
  parseRecentPages,
  type RecentPage,
} from './recentPages';

type ReadingHistoryContextValue = {
  recentPages: readonly RecentPage[];
  ready: boolean;
  recordPosition: (surah: number, ayah: number) => void;
};

const ReadingHistoryContext = createContext<ReadingHistoryContextValue | null>(null);

export function ReadingHistoryProvider({ children }: { children: React.ReactNode }) {
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const [ready, setReady] = useState(false);
  const persistenceQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(RECENT_PAGES_STORAGE_KEY)
      .then((raw) => {
        if (active) setRecentPages(parseRecentPages(raw));
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
    const serialized = JSON.stringify(recentPages);
    const write = persistenceQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(RECENT_PAGES_STORAGE_KEY, serialized));
    persistenceQueueRef.current = write;
    void write.catch(() => undefined);
  }, [ready, recentPages]);

  const recordPosition = useCallback((surah: number, ayah: number) => {
    const next = createRecentPage(surah, ayah);
    setRecentPages((current) => addRecentPage(current, next));
  }, []);

  const value = useMemo<ReadingHistoryContextValue>(() => ({
    recentPages,
    ready,
    recordPosition,
  }), [ready, recentPages, recordPosition]);

  return <ReadingHistoryContext.Provider value={value}>{children}</ReadingHistoryContext.Provider>;
}

export function useReadingHistory(): ReadingHistoryContextValue {
  const value = useContext(ReadingHistoryContext);
  if (!value) throw new Error('useReadingHistory must be used inside ReadingHistoryProvider.');
  return value;
}
