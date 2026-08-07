import { useCallback, useMemo } from 'react';

import {
  formatLocalizedNumber,
  translate,
  translateCount,
  type TranslationKey,
} from './i18n';
import { useAppSettings } from '@/settings/AppSettingsProvider';

export function useI18n() {
  const { language = 'en', isRTL = false } = useAppSettings();
  const t = useCallback(
    (key: TranslationKey, values?: Readonly<Record<string, string | number>>) => translate(language, key, values),
    [language],
  );
  const tCount = useCallback(
    (
      count: number,
      singularKey: TranslationKey,
      pluralKey: TranslationKey,
      values?: Readonly<Record<string, string | number>>,
    ) => translateCount(language, count, singularKey, pluralKey, values),
    [language],
  );
  return useMemo(() => ({
    language,
    isRTL,
    t,
    tCount,
    number: (value: number) => formatLocalizedNumber(language, value),
  }), [isRTL, language, t, tCount]);
}
