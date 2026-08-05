import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { useOfflineAudio } from '@/audio/OfflineAudioProvider';
import { formatPlaybackTime } from '@/audio/playbackQueue';
import { AppSymbol } from '@/components/AppSymbol';
import { useAppPalette } from '@/theme/useAppPalette';

export default function PlayerScreen() {
  const colors = useAppPalette();
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const [progressWidth, setProgressWidth] = useState(1);
  const {
    activeAyah,
    canPlayNext,
    canPlayPrevious,
    chapter,
    nextChapter,
    previousChapter,
    seekTo,
    sourceKind,
    status,
    timingStatus,
    toggle,
  } = useQuranAudio();
  const { downloadSurahs, errors, progress, records, removeDownload } = useOfflineAudio();
  const downloadsAvailable = Platform.OS !== 'web';

  if (!chapter) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing playing</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close player"
            onPress={() => router.back()}
            style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}
          >
            <AppSymbol name="close" tintColor={colors.text} size={18} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const playbackProgress = status.duration > 0
    ? Math.max(0, Math.min(1, status.currentTime / status.duration))
    : 0;
  const downloaded = records[chapter.number];
  const downloadProgress = progress[chapter.number];
  const downloading = !downloaded && downloadProgress !== undefined;
  const artworkSize = Math.min(340, width - 64, Math.max(220, height * 0.38));
  const syncLabel = timingStatus === 'verified'
    ? 'Verified Ayah sync'
    : timingStatus === 'machineAligned'
      ? 'Beta Ayah sync · machine aligned'
      : 'Continuous playback · sync under review';

  const seekFromPress = (event: GestureResponderEvent) => {
    if (status.duration <= 0) return;
    void seekTo((event.nativeEvent.locationX / progressWidth) * status.duration);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close player"
          style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.6 : 1 }]}
        >
          <AppSymbol name="close" tintColor={colors.text} size={17} weight="semibold" />
        </Pressable>
        <Text style={[styles.nowPlaying, { color: colors.textMuted }]}>NOW PLAYING</Text>
        <View style={styles.closeButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.artwork,
            {
              width: artworkSize,
              height: artworkSize,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <View style={[styles.artworkRing, { borderColor: colors.primarySoft }]}>
            <Text accessibilityLanguage="ar" style={[styles.artworkArabic, { color: colors.text }]}>
              {chapter.arabicName.replace(/^سُورَةُ\s*/, '')}
            </Text>
            <View style={[styles.artworkRule, { backgroundColor: colors.primary }]} />
            <Text style={[styles.artworkNumber, { color: colors.primary }]}>SURAH {chapter.number}</Text>
          </View>
        </View>

        <View style={styles.metadata}>
          <Text accessibilityLanguage="ar" style={[styles.arabicTitle, { color: colors.text }]}>
            {chapter.arabicName}
          </Text>
          <Text style={[styles.englishTitle, { color: colors.text }]}>{chapter.englishName}</Text>
          <Text style={[styles.reciter, { color: colors.textMuted }]}>Muhammad Al-Faqih</Text>
          <Text style={[styles.syncStatus, { color: colors.primary }]}>
            {activeAyah ? `Ayah ${activeAyah} · ` : ''}{syncLabel}
          </Text>
        </View>

        <View style={styles.timeline}>
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel="Recitation position"
            accessibilityValue={{ min: 0, max: Math.round(status.duration), now: Math.round(status.currentTime) }}
            accessibilityActions={[
              { name: 'increment', label: 'Forward 15 seconds' },
              { name: 'decrement', label: 'Back 15 seconds' },
            ]}
            onAccessibilityAction={({ nativeEvent: { actionName } }) => {
              const delta = actionName === 'increment' ? 15 : actionName === 'decrement' ? -15 : 0;
              if (delta !== 0) void seekTo(Math.max(0, Math.min(status.duration, status.currentTime + delta)));
            }}
            onLayout={(event) => setProgressWidth(Math.max(1, event.nativeEvent.layout.width))}
            onPress={seekFromPress}
            style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}
          >
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${playbackProgress * 100}%` }]} />
          </Pressable>
          <View style={styles.times}>
            <Text style={[styles.time, { color: colors.textMuted }]}>{formatPlaybackTime(status.currentTime)}</Text>
            <Text style={[styles.time, { color: colors.textMuted }]}>{formatPlaybackTime(status.duration)}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <PlayerControl
            disabled={!canPlayPrevious}
            label="Previous Surah"
            onPress={previousChapter}
            icon="previous"
            colors={colors}
          />
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              toggle();
            }}
            accessibilityRole="button"
            accessibilityLabel={status.playing ? 'Pause recitation' : 'Play recitation'}
            style={({ pressed }) => [
              styles.primaryControl,
              { backgroundColor: colors.primary, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <AppSymbol name={status.playing ? 'pause' : 'play'} tintColor="#FFFFFF" size={30} weight="bold" />
          </Pressable>
          <PlayerControl
            disabled={!canPlayNext}
            label="Next Surah"
            onPress={nextChapter}
            icon="next"
            colors={colors}
          />
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open Surah ${chapter.englishName} in the reader`}
            onPress={() => router.push({ pathname: '/surah/[id]', params: { id: String(chapter.number) } })}
            style={({ pressed }) => [styles.actionButton, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <AppSymbol name="book" tintColor={colors.primary} size={18} />
            <Text style={[styles.actionText, { color: colors.text }]}>Open reader</Text>
          </Pressable>
          {downloadsAvailable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={downloaded ? `Remove downloaded Surah ${chapter.englishName}` : `Download Surah ${chapter.englishName}`}
              disabled={downloading}
              onPress={() => {
                if (downloaded) void removeDownload(chapter.number);
                else void downloadSurahs([chapter.number]);
              }}
              style={({ pressed }) => [styles.actionButton, { borderColor: colors.border, opacity: downloading ? 0.55 : pressed ? 0.6 : 1 }]}
            >
              <AppSymbol
                name={downloaded ? 'downloaded' : 'download'}
                tintColor={colors.primary}
                size={18}
              />
              <Text style={[styles.actionText, { color: colors.text }]}>
                {downloaded
                  ? `Downloaded · ${sourceKind === 'offline' ? 'playing offline' : 'ready next play'}`
                  : downloading
                    ? `Downloading ${Math.round((downloadProgress ?? 0) * 100)}%`
                    : 'Download Surah'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {downloadsAvailable && errors[chapter.number] ? (
          <Text style={[styles.error, { color: colors.danger }]}>{errors[chapter.number]}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlayerControl({
  colors,
  disabled,
  icon,
  label,
  onPress,
}: {
  colors: ReturnType<typeof useAppPalette>;
  disabled: boolean;
  icon: 'next' | 'previous';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.secondaryPlayerControl, { opacity: disabled ? 0.25 : pressed ? 0.55 : 1 }]}
    >
      <AppSymbol name={icon} tintColor={colors.text} size={29} weight="semibold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  nowPlaying: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.6 },
  content: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 8, paddingBottom: 30 },
  artwork: { maxWidth: 360, maxHeight: 360, borderWidth: StyleSheet.hairlineWidth, borderRadius: 32, padding: 24, alignItems: 'center', justifyContent: 'center' },
  artworkRing: { width: '100%', height: '100%', borderWidth: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', padding: 24 },
  artworkArabic: { fontFamily: 'AmiriQuran_400Regular', fontSize: 48, lineHeight: 72, textAlign: 'center', writingDirection: 'rtl' },
  artworkRule: { width: 38, height: 2, borderRadius: 2, marginVertical: 12 },
  artworkNumber: { fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 2 },
  metadata: { alignItems: 'center', paddingTop: 14 },
  arabicTitle: { fontFamily: 'AmiriQuran_400Regular', fontSize: 28, lineHeight: 40, textAlign: 'center', writingDirection: 'rtl' },
  englishTitle: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  reciter: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  syncStatus: { fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 6 },
  timeline: { width: '100%', maxWidth: 520, marginTop: 18 },
  progressTrack: { height: 7, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  time: { fontSize: 11, lineHeight: 14, fontVariant: ['tabular-nums'] },
  controls: { width: '100%', maxWidth: 340, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 18 },
  primaryControl: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  secondaryPlayerControl: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  actions: { width: '100%', maxWidth: 520, gap: 10, marginTop: 18 },
  actionButton: { minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  error: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  emptyTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
});
