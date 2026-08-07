import { DEFAULT_RECITER_ID, reciterById, type ReciterId } from '@/audio/reciter';
import type { LanguageChoice } from '@/i18n/i18n';

export const APP_SETTINGS_STORAGE_KEY = 'quran:app-settings:v1';

export type AppearanceMode = 'system' | 'light' | 'dark';
export type ReaderMode = 'ayah' | 'classic' | 'mushaf';
export type ResolvedColorScheme = 'light' | 'dark';

export type AppSettings = {
  appearance: AppearanceMode;
  language: LanguageChoice;
  reciterId: ReciterId;
  readerMode: ReaderMode;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  appearance: 'system',
  language: 'system',
  reciterId: DEFAULT_RECITER_ID,
  readerMode: 'ayah',
};

export function parseAppSettings(raw: string | null): AppSettings {
  if (!raw) return DEFAULT_APP_SETTINGS;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof AppSettings, unknown>>;
    const appearance = value.appearance === 'light' || value.appearance === 'dark'
      ? value.appearance
      : 'system';
    const reciterId = typeof value.reciterId === 'string' && reciterById(value.reciterId)
      ? value.reciterId as ReciterId
      : DEFAULT_RECITER_ID;
    const language = value.language === 'en' || value.language === 'ar'
      ? value.language
      : 'system';
    const readerMode = value.readerMode === 'classic' || value.readerMode === 'mushaf'
      ? value.readerMode
      : 'ayah';
    return { appearance, language, reciterId, readerMode };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function resolveColorScheme(
  appearance: AppearanceMode,
  systemScheme: ResolvedColorScheme | 'unspecified' | null | undefined,
): ResolvedColorScheme {
  if (appearance === 'light' || appearance === 'dark') return appearance;
  return systemScheme === 'dark' ? 'dark' : 'light';
}
