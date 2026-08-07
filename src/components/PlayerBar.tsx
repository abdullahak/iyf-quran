import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useQuranAudio } from '@/audio/AudioProvider';
import { AppSymbol } from '@/components/AppSymbol';
import { GlassSurface } from '@/components/GlassSurface';
import {
  FLOATING_PLAYER_HEIGHT,
  PLAYER_TEXT_METRICS,
} from '@/components/playerBarLayout';
import { useAppPalette } from '@/theme/useAppPalette';
import { useI18n } from '@/i18n/useI18n';
import { shadow } from '@/theme/tokens';

type Props = {
  embedded?: boolean;
  compact?: boolean;
  bottomOffset?: number;
};

export function PlayerBar({ embedded = false, compact = false, bottomOffset = 88 }: Props) {
  const colors = useAppPalette();
  const { language, t } = useI18n();
  const router = useRouter();
  const {
    canPlayNext,
    canPlayPrevious,
    chapter,
    nextChapter,
    previousChapter,
    reciter,
    status,
    toggle,
  } = useQuranAudio();
  if (!chapter) return null;

  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  const progressPercent = Math.round(progress * 100);

  const content = (
    <View
      testID="player-bar-content"
      style={[styles.content, embedded && styles.embeddedContent, compact && styles.compactContent]}
    >
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          router.push('/player');
        }}
        style={styles.details}
        accessibilityRole="button"
        accessibilityLabel={t('player.open', {
          surah: language === 'ar' ? chapter.arabicName.replace(/^سُورَةُ\s*/, '') : chapter.englishName,
        })}
      >
        <Text
          accessibilityLanguage="ar"
          style={[styles.title, { color: colors.text }]}
          numberOfLines={1}
        >
          {chapter.arabicName.replace(/^سُورَةُ\s*/, '')}
        </Text>
        {!compact ? (
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {chapter.englishName} · {reciter.name}
          </Text>
        ) : null}
      </Pressable>
      {!compact ? (
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            previousChapter();
          }}
          disabled={!canPlayPrevious}
          accessibilityRole="button"
          accessibilityLabel={t('player.previous')}
          accessibilityState={{ disabled: !canPlayPrevious }}
          style={({ pressed }) => [
            styles.secondaryControl,
            { opacity: !canPlayPrevious ? 0.28 : pressed ? 0.55 : 1 },
          ]}
        >
          <AppSymbol name="previous" tintColor={colors.text} size={19} weight="semibold" />
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          toggle();
        }}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? t('player.pause') : t('player.play')}
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
      {!compact ? (
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            nextChapter();
          }}
          disabled={!canPlayNext}
          accessibilityRole="button"
          accessibilityLabel={t('player.next')}
          accessibilityState={{ disabled: !canPlayNext }}
          style={({ pressed }) => [
            styles.secondaryControl,
            { opacity: !canPlayNext ? 0.28 : pressed ? 0.55 : 1 },
          ]}
        >
          <AppSymbol name="next" tintColor={colors.text} size={19} weight="semibold" />
        </Pressable>
      ) : null}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('player.progress')}
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
    minHeight: FLOATING_PLAYER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  embeddedContent: { height: '100%', minHeight: 0, paddingVertical: 4 },
  compactContent: {
    height: '100%',
    minHeight: 0,
    paddingVertical: 0,
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
  details: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  title: {
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 18,
    lineHeight: PLAYER_TEXT_METRICS.titleLineHeight,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  meta: { fontSize: 12, lineHeight: PLAYER_TEXT_METRICS.metaLineHeight },
  secondaryControl: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playControl: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});