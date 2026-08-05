import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import type { ReciterId } from '@/audio/reciter';
import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APP_SETTINGS,
  parseAppSettings,
  resolveColorScheme,
  type AppearanceMode,
  type AppSettings,
  type ReaderMode,
  type ResolvedColorScheme,
} from './appSettings';

type AppSettingsContextValue = {
  settings: AppSettings;
  ready: boolean;
  colorScheme: ResolvedColorScheme;
  setAppearance: (appearance: AppearanceMode) => void;
  setReaderMode: (readerMode: ReaderMode) => void;
  setReciterId: (reciterId: ReciterId) => void;
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS);
  const [ready, setReady] = useState(false);
  const persistenceQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(APP_SETTINGS_STORAGE_KEY)
      .then((raw) => {
        if (active) setSettings(parseAppSettings(raw));
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
    const serialized = JSON.stringify(settings);
    const write = persistenceQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(APP_SETTINGS_STORAGE_KEY, serialized));
    persistenceQueueRef.current = write;
    void write.catch(() => undefined);
  }, [ready, settings]);

  const setAppearance = useCallback((appearance: AppearanceMode) => {
    setSettings((current) => ({ ...current, appearance }));
  }, []);
  const setReaderMode = useCallback((readerMode: ReaderMode) => {
    setSettings((current) => ({ ...current, readerMode }));
  }, []);
  const setReciterId = useCallback((reciterId: ReciterId) => {
    setSettings((current) => ({ ...current, reciterId }));
  }, []);

  const value = useMemo<AppSettingsContextValue>(() => ({
    settings,
    ready,
    colorScheme: resolveColorScheme(settings.appearance, systemScheme),
    setAppearance,
    setReaderMode,
    setReciterId,
  }), [ready, setAppearance, setReaderMode, setReciterId, settings, systemScheme]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const value = useContext(AppSettingsContext);
  if (!value) throw new Error('useAppSettings must be used inside AppSettingsProvider.');
  return value;
}
