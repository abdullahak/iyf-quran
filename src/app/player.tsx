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
import { offlineAudioAction, offlineDownloadsAvailable } from '@/audio/offlineAudio';
import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import { isSleepTimerSelected } from '@/audio/playbackEndRule';
import { formatPlaybackTime } from '@/audio/playbackQueue';
import { nextPlaybackRate } from '@/audio/playbackRate';
import { AppSymbol } from '@/components/AppSymbol';
import { dismissPlayer } from '@/navigation/dismissPlayer';
import { useI18n } from '@/i18n/useI18n';
import { readingRouteForPosition } from '@/reader/readingRoute';
import { useAppSettings } from '@/settings/AppSettingsProvider';
import { useAppPalette } from '@/theme/useAppPalette';

export default function PlayerScreen() {
  const colors = useAppPalette();
  const { isRTL, language, number: localizedNumber, t, tCount } = useI18n();
  const { settings: { readerMode } } = useAppSettings();
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const [progressWidth, setProgressWidth] = useState(1);
  const [controlMessage, setControlMessage] = useState<string>();
  const {
    activeAyah,
    canPlayNext,
    canPlayPrevious,
    chapter,
    endRule,
    nextChapter,
    playbackRate,
    previousChapter,
    reciter,
    seekTo,
    sourceKind,
    status,
    setPlaybackRate,
    setPlaybackScope,
    setSleepTimer,
    toggle,
  } = useQuranAudio();
  const { enqueueRange, queue } = usePlaybackLibrary();
  const { cancelDownload, downloadSurahs, errors, progress, records, removeDownload } = useOfflineAudio();
  const downloadsAvailable = offlineDownloadsAvailable(Platform.OS, reciter.supportsOffline);
  const closePlayer = () => dismissPlayer(router);

  if (!chapter) {
    return (
      <SafeAreaView
        edges={['top', 'right', 'bottom', 'left']}
        style={[styles.safe, { backgroundColor: colors.background }]}
      >
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('player.nothing')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('player.close')}
            onPress={closePlayer}
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
  const downloadAction = offlineAudioAction(Boolean(downloaded), downloadProgress);
  const artworkSize = Math.min(340, width - 64, Math.max(220, height * 0.38));

  const seekFromPress = (event: GestureResponderEvent) => {
    if (status.duration <= 0) return;
    void seekTo((event.nativeEvent.locationX / progressWidth) * status.duration);
  };

  return (
    <SafeAreaView
      edges={['top', 'right', 'bottom', 'left']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={closePlayer}
          accessibilityRole="button"
          accessibilityLabel={t('player.close')}
          style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.6 : 1 }]}
        >
          <AppSymbol name="close" tintColor={colors.text} size={17} weight="semibold" />
        </Pressable>
        <Text style={[styles.nowPlaying, { color: colors.textMuted }]}>{t('player.nowPlaying')}</Text>
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
            <Text style={[styles.artworkNumber, { color: colors.primary }]}>{t('player.surahNumber', { number: localizedNumber(chapter.number) })}</Text>
          </View>
        </View>

        <View style={styles.metadata}>
          <Text accessibilityLanguage="ar" style={[styles.arabicTitle, { color: colors.text }]}>
            {chapter.arabicName}
          </Text>
          <Text style={[styles.englishTitle, { color: colors.text }]}>{chapter.englishName}</Text>
          <Text style={[styles.reciter, { color: colors.textMuted }]}>{reciter.name}</Text>
          {activeAyah ? (
            <Text style={[styles.syncStatus, { color: colors.primary }]}>{t('player.ayah', { number: localizedNumber(activeAyah) })}</Text>
          ) : null}
        </View>

        <View style={styles.timeline}>
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel={t('player.position')}
            accessibilityValue={{ min: 0, max: Math.round(status.duration), now: Math.round(status.currentTime) }}
            accessibilityActions={[
              { name: 'increment', label: t('player.forward15') },
              { name: 'decrement', label: t('player.back15') },
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
            label={t('player.previous')}
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
            accessibilityLabel={status.playing ? t('player.pause') : t('player.play')}
            style={({ pressed }) => [
              styles.primaryControl,
              { backgroundColor: colors.primary, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <AppSymbol name={status.playing ? 'pause' : 'play'} tintColor="#FFFFFF" size={30} weight="bold" />
          </Pressable>
          <PlayerControl
            disabled={!canPlayNext}
            label={t('player.next')}
            onPress={nextChapter}
            icon="next"
            colors={colors}
          />
        </View>

        <View style={[styles.listeningPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.speedRow}>
            <View>
              <Text style={[styles.controlTitle, { color: colors.text }]}>{t('player.speed')}</Text>
              <Text style={[styles.controlSubtitle, { color: colors.textMuted }]}>{t('player.pitchCorrected')}</Text>
            </View>
            <View style={[styles.stepper, { backgroundColor: colors.surfaceMuted }]}>
              <Pressable
                disabled={playbackRate === 0.5}
                accessibilityRole="button"
                accessibilityLabel={t('player.decreaseSpeed')}
                onPress={() => setPlaybackRate(nextPlaybackRate(playbackRate, -1))}
                style={styles.stepperButton}
              >
                <AppSymbol name="minus" size={15} tintColor={playbackRate === 0.5 ? colors.textFaint : colors.text} />
              </Pressable>
              <Text accessibilityLiveRegion="polite" style={[styles.speedValue, { color: colors.text }]}>{playbackRate}×</Text>
              <Pressable
                disabled={playbackRate === 2}
                accessibilityRole="button"
                accessibilityLabel={t('player.increaseSpeed')}
                onPress={() => setPlaybackRate(nextPlaybackRate(playbackRate, 1))}
                style={styles.stepperButton}
              >
                <AppSymbol name="add" size={15} tintColor={playbackRate === 2 ? colors.textFaint : colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.panelDivider, { backgroundColor: colors.border }]} />
          <Text style={[styles.controlTitle, { color: colors.text }]}>{t('player.playUntil')}</Text>
          <View style={styles.choiceRow}>
            {(['quran', 'page', 'juz', 'surah'] as const).map((scope) => {
              const selected = endRule.kind === scope;
              const label = {
                quran: t('player.quranEnd'),
                page: t('player.page'),
                juz: t('player.juz'),
                surah: t('player.surah'),
              }[scope];
              return (
                <Pressable
                  key={scope}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  onPress={async () => {
                    const applied = await setPlaybackScope(scope);
                    setControlMessage(applied ? undefined : t('player.synchronizedRequired'));
                  }}
                  style={[styles.choice, { backgroundColor: selected ? colors.primary : colors.surfaceMuted }]}
                >
                  <Text style={[styles.choiceText, { color: selected ? colors.onPrimary : colors.text }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {controlMessage ? <Text accessibilityLiveRegion="polite" style={[styles.controlMessage, { color: colors.textMuted }]}>{controlMessage}</Text> : null}

          <Text style={[styles.timerLabel, { color: colors.textMuted }]}>{t('player.sleepTimer')}</Text>
          <View style={styles.choiceRow}>
            {[undefined, 15, 30, 45, 60].map((minutes) => {
              const selected = isSleepTimerSelected(endRule, minutes);
              return (
                <Pressable
                  key={minutes ?? 'off'}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  onPress={() => { void setSleepTimer(minutes); }}
                  style={[styles.timerChoice, { backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted }]}
                >
                  <Text style={[styles.timerChoiceText, { color: selected ? colors.primary : colors.textMuted }]}>{minutes ? t('player.minutes', { count: localizedNumber(minutes) }) : t('player.off')}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('player.openReaderLabel', { surah: language === 'ar' ? chapter.arabicName.replace(/^سُورَةُ\s*/, '') : chapter.englishName })}
            onPress={() => {
              const route = readingRouteForPosition(readerMode, chapter.number, activeAyah ?? 1);
              if (route) router.dismissTo(route);
            }}
            style={({ pressed }) => [styles.actionButton, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <AppSymbol name="book" tintColor={colors.primary} size={18} />
            <Text style={[styles.actionText, { color: colors.text }]}>{t('player.openReader')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('player.addQueueLabel', { surah: language === 'ar' ? chapter.arabicName.replace(/^سُورَةُ\s*/, '') : chapter.englishName })}
            onPress={() => {
              enqueueRange(chapter.number);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
            style={({ pressed }) => [styles.actionButton, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <AppSymbol name="queue" tintColor={colors.primary} size={18} />
            <Text style={[styles.actionText, { color: colors.text }]}>{t('player.addQueue')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('player.addPlaylistLabel', { surah: language === 'ar' ? chapter.arabicName.replace(/^سُورَةُ\s*/, '') : chapter.englishName })}
            onPress={() => router.push({
              pathname: '/add-to-playlist',
              params: { surah: String(chapter.number) },
            })}
            style={({ pressed }) => [styles.actionButton, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <AppSymbol name="more" tintColor={colors.primary} size={18} />
            <Text style={[styles.actionText, { color: colors.text }]}>{t('player.addPlaylist')}</Text>
          </Pressable>
          {queue.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tCount(queue.length, 'player.openQueueOne', 'player.openQueue')}
              onPress={() => router.push('/queue')}
              style={({ pressed }) => [styles.actionButton, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <AppSymbol name={isRTL ? 'back' : 'forward'} tintColor={colors.primary} size={17} />
              <Text style={[styles.actionText, { color: colors.text }]}>{t('player.viewQueue', { count: localizedNumber(queue.length) })}</Text>
            </Pressable>
          ) : null}
          {downloadsAvailable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={downloadAction === 'cancel'
                ? t('downloads.cancelLabel', { surah: language === 'ar' ? chapter.arabicName.replace(/^سُورَةُ\s*/, '') : chapter.englishName })
                : downloadAction === 'remove'
                  ? t('downloads.removeLabel', { surah: language === 'ar' ? chapter.arabicName.replace(/^سُورَةُ\s*/, '') : chapter.englishName })
                  : t('downloads.downloadLabel', { surah: language === 'ar' ? chapter.arabicName.replace(/^سُورَةُ\s*/, '') : chapter.englishName })}
              onPress={() => {
                if (downloadAction === 'cancel') void cancelDownload(chapter.number);
                else if (downloadAction === 'remove') void removeDownload(chapter.number);
                else void downloadSurahs([chapter.number]);
              }}
              style={({ pressed }) => [styles.actionButton, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <AppSymbol
                name={downloadAction === 'cancel' ? 'close' : downloadAction === 'remove' ? 'downloaded' : 'download'}
                tintColor={downloadAction === 'cancel' ? colors.danger : colors.primary}
                size={18}
              />
              <Text style={[styles.actionText, { color: colors.text }]}>
                {downloadAction === 'remove'
                  ? t(sourceKind === 'offline' ? 'downloads.downloadedOffline' : 'downloads.downloadedReady')
                  : downloadAction === 'cancel'
                    ? t('downloads.cancelProgress', { percent: localizedNumber(Math.round((downloadProgress ?? 0) * 100)) })
                    : t('downloads.downloadSurah')}
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
  listeningPanel: { width: '100%', maxWidth: 520, marginTop: 24, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 16 },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  controlTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  controlSubtitle: { marginTop: 2, fontSize: 10, lineHeight: 14 },
  stepper: { height: 40, borderRadius: 13, flexDirection: 'row', alignItems: 'center' },
  stepperButton: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' },
  speedValue: { minWidth: 48, textAlign: 'center', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  panelDivider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  choiceRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { minHeight: 36, borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  controlMessage: { marginTop: 8, fontSize: 10, lineHeight: 15 },
  timerLabel: { marginTop: 15, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  timerChoice: { minWidth: 48, height: 34, borderRadius: 11, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  timerChoiceText: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  actions: { width: '100%', maxWidth: 520, gap: 10, marginTop: 18 },
  actionButton: { minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  error: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  emptyTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
});
