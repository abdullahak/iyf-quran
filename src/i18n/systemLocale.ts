import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeLocale = {
  languageTag?: string | null;
};

type ExpoLocalizationNativeModule = {
  getLocales: () => readonly NativeLocale[];
};

type SystemLanguageTagOptions = {
  browserLanguageTags?: readonly string[];
  intlLanguageTag?: string | null;
};

const expoLocalization =
  requireOptionalNativeModule<ExpoLocalizationNativeModule>('ExpoLocalization');

function browserLanguageTags(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages;
  }
  return navigator.language ? [navigator.language] : [];
}

function intlLanguageTag(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

export function getSystemLanguageTag(
  options: SystemLanguageTagOptions = {},
): string | undefined {
  try {
    const nativeLanguageTag = expoLocalization?.getLocales()[0]?.languageTag;
    if (nativeLanguageTag) return nativeLanguageTag;
  } catch {
    // Continue to standards-based runtime fallbacks when native locale access fails.
  }

  const browserTag = (options.browserLanguageTags ?? browserLanguageTags()).find(Boolean);
  if (browserTag) return browserTag;

  return options.intlLanguageTag === undefined
    ? intlLanguageTag()
    : options.intlLanguageTag || undefined;
}
