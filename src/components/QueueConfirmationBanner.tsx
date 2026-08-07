import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import type { PlaybackQueueEntry } from '@/audio/playbackLibrary';
import { chapterByNumber } from '@/data/chapters';
import { formatLocalizedNumber, translate, type AppLanguage } from '@/i18n/i18n';
import { useI18n } from '@/i18n/useI18n';
import { useAppPalette } from '@/theme/useAppPalette';

export function queueConfirmationLabel(entry: PlaybackQueueEntry, language: AppLanguage): string {
  const chapter = chapterByNumber(entry.surah);
  if (!chapter) return '';
  const surah = language === 'ar'
    ? chapter.arabicName.replace(/^سُورَةُ\s*/, '')
    : chapter.englishName;
  const number = (value: number) => formatLocalizedNumber(language, value);
  if (entry.startAyah === 1 && entry.endAyah === chapter.ayahCount) {
    return translate(language, 'queue.addedSurah', { surah });
  }
  if (entry.startAyah === entry.endAyah) {
    return translate(language, 'queue.addedAyah', { surah, ayah: number(entry.startAyah) });
  }
  return translate(language, 'queue.addedRange', {
    surah,
    start: number(entry.startAyah),
    end: number(entry.endAyah),
  });
}

export function QueueConfirmationBanner() {
  const { enqueueConfirmation } = usePlaybackLibrary();
  const { language } = useI18n();
  const colors = useAppPalette();
  const insets = useSafeAreaInsets();
  if (!enqueueConfirmation) return null;

  const label = queueConfirmationLabel(enqueueConfirmation, language);
  return (
    <View pointerEvents="none" style={[styles.position, { top: insets.top + 8 }]}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessible
        style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',
    start: 16,
    end: 16,
    zIndex: 1000,
    alignItems: 'center',
  },
  banner: {
    maxWidth: 520,
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
