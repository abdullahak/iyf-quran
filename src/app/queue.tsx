import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import { playWithUnavailableFeedback } from '@/audio/playbackFeedback';
import { AppSymbol } from '@/components/AppSymbol';
import { IconButton } from '@/components/IconButton';
import { chapterByNumber } from '@/data/chapters';
import { useAppPalette } from '@/theme/useAppPalette';

export default function QueueScreen() {
  const colors = useAppPalette();
  const router = useRouter();
  const audio = useQuranAudio();
  const { clearQueue, queue, removeFromQueue } = usePlaybackLibrary();
  const close = () => (router.canDismiss() ? router.dismiss() : router.canGoBack() ? router.back() : router.replace('/'));

  const startAt = async (index: number) => {
    const started = await playWithUnavailableFeedback(() => audio.playQueue(queue, index));
    if (!started) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    close();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.navigation}>
        <IconButton name="close" label="Close queue" onPress={close} />
        <Text accessibilityRole="header" style={[styles.navTitle, { color: colors.text }]}>Queue</Text>
        {queue.length > 0 ? <IconButton name="trash" label="Clear queue" onPress={() => {
          void audio.clearPlaybackQueue();
          clearQueue();
        }} /> : <View style={styles.navigationEnd} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {queue.length > 0 ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Play queue from the beginning"
              onPress={() => void startAt(0)}
              style={[styles.playAll, { backgroundColor: colors.primary }]}
            >
              <AppSymbol name="play" size={17} tintColor={colors.onPrimary} weight="bold" />
              <Text style={[styles.playAllText, { color: colors.onPrimary }]}>Play queue</Text>
            </Pressable>
            <Text style={[styles.queueMeta, { color: colors.textMuted }]}>{queue.length === 1 ? '1 item' : `${queue.length} items`} · plays in order</Text>
            {queue.map((item, index) => {
              const chapter = chapterByNumber(item.surah)!;
              const wholeSurah = item.startAyah === 1 && item.endAyah === chapter.ayahCount;
              const active = audio.activeQueueEntry?.id === item.id;
              return (
                <View key={item.id}>
                  <View style={[styles.itemRow, active && { backgroundColor: colors.primarySoft }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Play ${chapter.englishName}${wholeSurah ? '' : ` Ayahs ${item.startAyah} to ${item.endAyah}`}`}
                      onPress={() => void startAt(index)}
                      style={styles.itemMain}
                    >
                      <View style={[styles.itemNumber, { backgroundColor: active ? colors.primary : colors.surfaceMuted }]}>
                        {active ? (
                          <AppSymbol name="play" size={12} tintColor={colors.onPrimary} />
                        ) : (
                          <Text style={[styles.itemNumberText, { color: colors.textMuted }]}>{index + 1}</Text>
                        )}
                      </View>
                      <View style={styles.itemCopy}>
                        <Text style={[styles.itemTitle, { color: colors.text }]}>{chapter.englishName}</Text>
                        <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                          {wholeSurah ? `Surah ${chapter.number}` : `Ayahs ${item.startAyah}–${item.endAyah}`}
                        </Text>
                      </View>
                      <Text accessibilityLanguage="ar" style={[styles.itemArabic, { color: colors.text }]}>
                        {chapter.arabicName.replace(/^سُورَةُ\s*/, '')}
                      </Text>
                    </Pressable>
                    <IconButton name="close" label={`Remove ${chapter.englishName} from queue`} onPress={() => removeFromQueue(item.id)} />
                  </View>
                  {index < queue.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                </View>
              );
            })}
          </>
        ) : (
          <View style={styles.empty}>
            <AppSymbol name="queue" size={28} tintColor={colors.textFaint} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Your queue is empty</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Add a Surah from Now Playing or an Ayah while reading.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navigation: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 21, fontWeight: '600' },
  navigationEnd: { width: 44 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 70 },
  playAll: { height: 50, marginTop: 18, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  playAllText: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  queueMeta: { marginTop: 13, marginBottom: 8, fontSize: 12, lineHeight: 17 },
  itemRow: { minHeight: 76, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingEnd: 2 },
  itemMain: { flex: 1, minHeight: 76, paddingStart: 8, flexDirection: 'row', alignItems: 'center' },
  itemNumber: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemNumberText: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  itemCopy: { flex: 1, marginStart: 11 },
  itemTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  itemMeta: { marginTop: 2, fontSize: 11, lineHeight: 15 },
  itemArabic: { maxWidth: 110, fontFamily: 'AmiriQuran_400Regular', fontSize: 21, lineHeight: 32, writingDirection: 'rtl' },
  divider: { height: StyleSheet.hairlineWidth, marginStart: 55 },
  empty: { paddingVertical: 96, alignItems: 'center' },
  emptyTitle: { marginTop: 13, fontSize: 18, lineHeight: 23, fontWeight: '600' },
  emptyBody: { maxWidth: 300, marginTop: 5, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
