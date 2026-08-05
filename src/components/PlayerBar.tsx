import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useQuranAudio } from '@/audio/AudioProvider';
import { AppSymbol } from '@/components/AppSymbol';
import { GlassSurface } from '@/components/GlassSurface';
import { useAppPalette } from '@/theme/useAppPalette';
import { shadow } from '@/theme/tokens';

type Props = {
  embedded?: boolean;
  compact?: boolean;
  bottomOffset?: number;
};

export function PlayerBar({ embedded = false, compact = false, bottomOffset = 88 }: Props) {
  const colors = useAppPalette();
  const router = useRouter();
  const {
    canPlayNext,
    canPlayPrevious,
    chapter,
    nextChapter,
    previousChapter,
    status,
    toggle,
  } = useQuranAudio();
  if (!chapter) return null;

  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  const progressPercent = Math.round(progress * 100);

  const content = (
    <View style={[styles.content, compact && styles.compactContent]}>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          router.push('/player');
        }}
        style={styles.details}
        accessibilityRole="button"
        accessibilityLabel={`Open Surah ${chapter.englishName}`}
      >
        <Text
          accessibilityLanguage="ar"
          style={[styles.title, { color: colors.text }]}
          numberOfLines={compact ? 1 : undefined}
        >
          {chapter.arabicName.replace(/^سُورَةُ\s*/, '')}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {chapter.englishName}{compact ? '' : ' · Muhammad Al-Faqih'}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          previousChapter();
        }}
        disabled={!canPlayPrevious}
        accessibilityRole="button"
        accessibilityLabel="Previous Surah"
        accessibilityState={{ disabled: !canPlayPrevious }}
        hitSlop={8}
        style={({ pressed }) => [
          styles.secondaryControl,
          { opacity: !canPlayPrevious ? 0.28 : pressed ? 0.55 : 1 },
        ]}
      >
        <AppSymbol name="previous" tintColor={colors.text} size={compact ? 17 : 19} weight="semibold" />
      </Pressable>
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          toggle();
        }}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause recitation' : 'Play recitation'}
        accessibilityState={{ selected: status.playing }}
        style={({ pressed }) => [
          styles.playControl,
          { backgroundColor: colors.primarySoft, opacity: pressed ? 0.62 : 1 },
        ]}
      >
        <AppSymbol
          name={status.playing ? 'pause' : 'play'}
          tintColor={colors.primary}
          size={17}
          weight="semibold"
        />
      </Pressable>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          nextChapter();
        }}
        disabled={!canPlayNext}
        accessibilityRole="button"
        accessibilityLabel="Next Surah"
        accessibilityState={{ disabled: !canPlayNext }}
        hitSlop={8}
        style={({ pressed }) => [
          styles.secondaryControl,
          { opacity: !canPlayNext ? 0.28 : pressed ? 0.55 : 1 },
        ]}
      >
        <AppSymbol name="next" tintColor={colors.text} size={compact ? 17 : 19} weight="semibold" />
      </Pressable>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Recitation progress"
        accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
        style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
      >
        <View
          style={[
            styles.progress,
            { backgroundColor: colors.primary, width: `${progressPercent}%` },
          ]}
        />
      </View>
    </View>
  );

  if (embedded) return content;

  return (
    <View style={[styles.shellPosition, { bottom: bottomOffset }]}>
      <GlassSurface strength="regular" style={[styles.shell, shadow.floating]}>
        {content}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  shellPosition: {
    position: 'absolute',
    left: 14,
    right: 14,
    alignItems: 'center',
    zIndex: 20,
  },
  shell: {
    width: '100%',
    maxWidth: 620,
    borderRadius: 18,
  },
  content: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  compactContent: {
    minHeight: 54,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  track: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    height: 2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progress: { height: '100%', borderRadius: 2 },
  details: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 2 },
  title: {
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 18,
    lineHeight: 23,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  meta: { fontSize: 10, lineHeight: 13 },
  secondaryControl: {
    width: 32,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playControl: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
});