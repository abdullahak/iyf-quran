import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APP_SETTINGS,
  parseAppSettings,
  resolveColorScheme,
} from './appSettings';

describe('app settings', () => {
  it('uses a versioned storage key and system-first defaults', () => {
    expect(APP_SETTINGS_STORAGE_KEY).toBe('quran:app-settings:v1');
    expect(parseAppSettings(null)).toEqual(DEFAULT_APP_SETTINGS);
    expect(DEFAULT_APP_SETTINGS).toEqual({
      appearance: 'system',
      language: 'system',
      reciterId: 'muhammad-al-faqih',
      readerMode: 'ayah',
    });
  });

  it('restores supported appearance, reciter, and reader choices', () => {
    expect(parseAppSettings(JSON.stringify({
      appearance: 'dark',
      language: 'ar',
      reciterId: 'mishary-alafasi',
      readerMode: 'mushaf',
    }))).toEqual({
      appearance: 'dark',
      language: 'ar',
      reciterId: 'mishary-alafasi',
      readerMode: 'mushaf',
    });
    expect(parseAppSettings(JSON.stringify({ readerMode: 'classic' })).readerMode).toBe('classic');
  });

  it('falls back per field instead of accepting unknown persisted values', () => {
    expect(parseAppSettings(JSON.stringify({
      appearance: 'sepia',
      language: 'french',
      reciterId: 'unknown',
      readerMode: 'translation',
    }))).toEqual(DEFAULT_APP_SETTINGS);
    expect(parseAppSettings('{broken')).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('resolves system appearance without making system a third color palette', () => {
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
    expect(resolveColorScheme('system', null)).toBe('light');
  });
});
