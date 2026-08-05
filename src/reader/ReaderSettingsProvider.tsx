import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEFAULT_READER_FONT_SCALE,
  nextReaderFontScale,
  parseReaderFontScale,
  READER_FONT_SCALE_STORAGE_KEY,
} from './readerSettings';

type ReaderSettingsContextValue = {
  fontScale: number;
  canDecreaseFont: boolean;
  canIncreaseFont: boolean;
  decreaseFont: () => void;
  increaseFont: () => void;
};

const ReaderSettingsContext = createContext<ReaderSettingsContextValue | null>(null);

export function ReaderSettingsProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setFontScale] = useState(DEFAULT_READER_FONT_SCALE);
  const [ready, setReady] = useState(false);
  const persistenceQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(READER_FONT_SCALE_STORAGE_KEY)
      .then((raw) => {
        if (active) setFontScale(parseReaderFontScale(raw));
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
    const serialized = JSON.stringify(fontScale);
    const write = persistenceQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(READER_FONT_SCALE_STORAGE_KEY, serialized));
    persistenceQueueRef.current = write;
    void write.catch(() => undefined);
  }, [fontScale, ready]);

  const decreaseFont = useCallback(
    () => setFontScale((current) => nextReaderFontScale(current, -1)),
    [],
  );
  const increaseFont = useCallback(
    () => setFontScale((current) => nextReaderFontScale(current, 1)),
    [],
  );

  const value = useMemo<ReaderSettingsContextValue>(
    () => ({
      fontScale,
      canDecreaseFont: fontScale > 0.85,
      canIncreaseFont: fontScale < 1.45,
      decreaseFont,
      increaseFont,
    }),
    [decreaseFont, fontScale, increaseFont],
  );

  return <ReaderSettingsContext.Provider value={value}>{children}</ReaderSettingsContext.Provider>;
}

export function useReaderSettings(): ReaderSettingsContextValue {
  const value = useContext(ReaderSettingsContext);
  if (!value) throw new Error('useReaderSettings must be used inside ReaderSettingsProvider.');
  return value;
}
