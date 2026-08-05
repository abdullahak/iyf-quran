import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import { playWithUnavailableFeedback } from '@/audio/playbackFeedback';
import {
  DEFAULT_RECITER_ID,
  isRecitationSelectionActive,
  reciterById,
} from '@/audio/reciter';
import { makeAyahTarget, makeSurahTarget } from '@/bookmarks/bookmarks';
import { useBookmarks } from '@/bookmarks/BookmarksProvider';
import { Atmosphere } from '@/components/Atmosphere';
import { AppSymbol } from '@/components/AppSymbol';
import { IconButton } from '@/components/IconButton';
import { AL_FATIHA_FALLBACK, type QuranChapter } from '@/data/alFatiha';
import { chapterByNumber } from '@/data/chapters';
import { useReadingHistory } from '@/reader/ReadingHistoryProvider';
import { useReaderSettings } from '@/reader/ReaderSettingsProvider';
import { loadChapter } from '@/services/quran';
import { useAppSettings } from '@/settings/AppSettingsProvider';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius } from '@/theme/tokens';

function toArabicIndic(value: number) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

export default function SurahScreen() {
  const params = useLocalSearchParams<{
    id: string | string[];
    ayah?: string | string[];
  }>();
  const router = useRouter();
  const colors = useAppPalette();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const ayahParam = Array.isArray(params.ayah) ? params.ayah[0] : params.ayah;
  const number = Number(id);
  const targetAyah = Number(ayahParam);
  const metadata = chapterByNumber(number);
  const [chapter, setChapter] = useState<QuranChapter | null>(
    number === 1 ? AL_FATIHA_FALLBACK : null,
  );
  const [error, setError] = useState<string>();
  const audio = useQuranAudio();
  const { settings } = useAppSettings();
  const selectedReciter = reciterById(settings.reciterId) ?? reciterById(DEFAULT_RECITER_ID)!;
  const selectedRecitationActive = isRecitationSelectionActive(
    audio.chapter?.number,
    audio.reciter.id,
    number,
    selectedReciter.id,
  );
  const {
    canDecreaseFont,
    canIncreaseFont,
    decreaseFont,
    fontScale,
    increaseFont,
  } = useReaderSettings();
  const { recordPosition } = useReadingHistory();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { enqueueRange } = usePlaybackLibrary();
  const scrollRef = useRef<ScrollView>(null);
  const ayahListOffset = useRef<number | undefined>(undefined);
  const ayahOffsets = useRef(new Map<number, number>());
  const didScrollTo = useRef<string | undefined>(undefined);
  const lastFollowedAyah = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadChapter(number)
      .then((result) => {
        if (!cancelled) {
          setChapter(result);
          setError(undefined);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'This surah could not be loaded.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [number]);

  useEffect(() => {
    ayahListOffset.current = undefined;
    ayahOffsets.current.clear();
    lastFollowedAyah.current = undefined;
  }, [number]);

  useEffect(() => {
    if (!chapter) return;
    const initialAyah = Number.isInteger(targetAyah) && targetAyah >= 1 && targetAyah <= chapter.ayahs.length
      ? targetAyah
      : 1;
    recordPosition(number, initialAyah);
  }, [chapter, number, recordPosition, targetAyah]);

  useEffect(() => {
    const activeAyah = audio.activeAyah;
    if (
      audio.chapter?.number !== number ||
      !audio.status.playing ||
      !activeAyah ||
      lastFollowedAyah.current === activeAyah
    ) return;
    const listY = ayahListOffset.current;
    const ayahY = ayahOffsets.current.get(activeAyah);
    if (listY === undefined || ayahY === undefined) return;
    lastFollowedAyah.current = activeAyah;
    scrollRef.current?.scrollTo({ y: Math.max(0, listY + ayahY - 110), animated: true });
  }, [audio.activeAyah, audio.chapter?.number, audio.status.playing, number]);

  const scrollToBookmarkedAyah = () => {
    if (!Number.isInteger(targetAyah) || targetAyah < 1 || targetAyah > (metadata?.ayahCount ?? 0)) {
      return;
    }
    const key = `${number}:${targetAyah}`;
    const listY = ayahListOffset.current;
    const ayahY = ayahOffsets.current.get(targetAyah);
    if (didScrollTo.current === key || listY === undefined || ayahY === undefined) return;
    didScrollTo.current = key;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, listY + ayahY - 12), animated: false });
    });
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/quran'));

  if (!metadata || !Number.isInteger(number)) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <Atmosphere />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Surah not found</Text>
        <Pressable onPress={() => router.replace('/(tabs)/quran')}>
          <Text style={[styles.errorLink, { color: colors.primary }]}>Return to the Quran</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const surahTarget = makeSurahTarget(number);
  const surahBookmarked = isBookmarked(surahTarget.key);
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Atmosphere />
      <View style={styles.navigation}>
        <View style={styles.navigationStart}>
          <IconButton name="back" label="Go back" onPress={goBack} />
        </View>
        <View style={styles.navigationTitle}>
          <Text style={[styles.navTitle, { color: colors.text }]}>{metadata.englishName}</Text>
          <Text style={[styles.navMeta, { color: colors.textMuted }]}>Surah {metadata.number}</Text>
        </View>
        <View style={styles.navigationActions}>
          <IconButton
            name={surahBookmarked ? 'bookmarkFilled' : 'bookmark'}
            label={surahBookmarked ? 'Remove surah bookmark' : 'Bookmark this surah'}
            onPress={() => toggleBookmark(surahTarget)}
          />
          <IconButton
            name={selectedRecitationActive && audio.status.playing ? 'pause' : 'play'}
            label={selectedRecitationActive && audio.status.playing ? 'Pause recitation' : 'Play recitation'}
            onPress={() => {
              if (selectedRecitationActive) audio.toggle();
              else audio.playChapter(metadata);
            }}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scrollContent,
          audio.chapter ? styles.scrollContentWithPlayer : null,
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          if (!chapter || ayahListOffset.current === undefined) return;
          const readingLine = event.nativeEvent.contentOffset.y + 120 - ayahListOffset.current;
          let visibleAyah = chapter.ayahs[0];
          for (const ayah of chapter.ayahs) {
            const offset = ayahOffsets.current.get(ayah.number);
            if (offset === undefined || offset > readingLine) break;
            visibleAyah = ayah;
          }
          if (visibleAyah) recordPosition(number, visibleAyah.number);
        }}
      >
        <View style={styles.content}>
          <View style={styles.surahHeader}>
            <Text style={[styles.surahNumber, { color: colors.primary }]}>
              Surah {metadata.number} · {metadata.revelationType}
            </Text>
            <Text accessibilityLanguage="ar" style={[styles.surahArabic, { color: colors.text }]}>
              {metadata.arabicName.replace(/^سُورَةُ\s*/, '')}
            </Text>
            <Text style={[styles.surahEnglish, { color: colors.text }]}>{metadata.englishName}</Text>
            <Text style={[styles.surahMeta, { color: colors.textMuted }]}>
              {metadata.ayahCount} ayahs · {metadata.revelationType}
            </Text>
            <View style={styles.readerToolbar}>
              <View style={[styles.fontControls, { borderColor: colors.border }]}>
                <Pressable
                  disabled={!canDecreaseFont}
                  onPress={decreaseFont}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease Quran font size"
                  accessibilityState={{ disabled: !canDecreaseFont }}
                  style={[styles.fontButton, { opacity: canDecreaseFont ? 1 : 0.3 }]}
                >
                  <AppSymbol name="fontDecrease" size={17} tintColor={colors.text} />
                </Pressable>
                <Text style={[styles.fontScaleLabel, { color: colors.textMuted }]}>Aa</Text>
                <Pressable
                  disabled={!canIncreaseFont}
                  onPress={increaseFont}
                  accessibilityRole="button"
                  accessibilityLabel="Increase Quran font size"
                  accessibilityState={{ disabled: !canIncreaseFont }}
                  style={[styles.fontButton, { opacity: canIncreaseFont ? 1 : 0.3 }]}
                >
                  <AppSymbol name="fontIncrease" size={17} tintColor={colors.text} />
                </Pressable>
              </View>
            </View>
          </View>

          {!chapter && !error ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Preparing the surah…</Text>
            </View>
          ) : null}

          {error ? (
            <View
              style={[
                styles.errorPanel,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <AppSymbol name="wifiError" size={24} tintColor={colors.gold} />
              <Text style={[styles.errorTitle, { color: colors.text }]}>Could not load this surah</Text>
              <Text style={[styles.errorBody, { color: colors.textMuted }]}>{error}</Text>
              <Pressable
                onPress={() => {
                  setError(undefined);
                  setChapter(null);
                  void loadChapter(number).then(setChapter).catch((reason: unknown) => {
                    setError(reason instanceof Error ? reason.message : 'This surah could not be loaded.');
                  });
                }}
              >
                <Text style={[styles.errorLink, { color: colors.primary }]}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          <View
            onLayout={(event) => {
              ayahListOffset.current = event.nativeEvent.layout.y;
              scrollToBookmarkedAyah();
            }}
            style={[
              styles.ayahList,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {chapter && number !== 1 && number !== 9 ? (
              <>
                <View style={styles.basmalaRow}>
                  <Text
                    accessibilityLanguage="ar"
                    style={[
                      styles.basmalaText,
                      {
                        color: colors.text,
                        fontSize: 29 * fontScale,
                        lineHeight: 50 * fontScale,
                      },
                    ]}
                  >
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                  </Text>
                </View>
                <View style={[styles.ayahDivider, { backgroundColor: colors.border }]} />
              </>
            ) : null}
            {chapter?.ayahs.map((ayah, index) => {
              const active = audio.chapter?.number === number && audio.activeAyah === ayah.number;
              const targeted = targetAyah === ayah.number;
              const ayahTarget = makeAyahTarget(number, ayah.number);
              const bookmarked = isBookmarked(ayahTarget.key);
              const previousAyah = chapter.ayahs[index - 1];
              const startsBoundary =
                !previousAyah || previousAyah.juz !== ayah.juz || previousAyah.page !== ayah.page;
              return (
                <View
                  key={ayah.number}
                  onLayout={(event) => {
                    const y = event.nativeEvent.layout.y;
                    ayahOffsets.current.set(ayah.number, y);
                    if (targeted) scrollToBookmarkedAyah();
                    if (
                      active &&
                      audio.status.playing &&
                      lastFollowedAyah.current !== ayah.number &&
                      ayahListOffset.current !== undefined
                    ) {
                      lastFollowedAyah.current = ayah.number;
                      requestAnimationFrame(() => {
                        scrollRef.current?.scrollTo({
                          y: Math.max(0, ayahListOffset.current! + y - 92),
                          animated: true,
                        });
                      });
                    }
                  }}
                >
                  <View
                    style={[
                      styles.ayah,
                      targeted && {
                        backgroundColor: colors.primarySoft,
                        borderStartColor: colors.primary,
                      },
                      active && {
                        backgroundColor: colors.primarySoft,
                        borderStartColor: colors.primary,
                      },
                    ]}
                  >
                    <View style={styles.ayahTopline}>
                      <View
                        style={[
                          styles.ayahNumber,
                          {
                            borderColor: colors.gold,
                            backgroundColor: 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.ayahNumberText,
                            { color: colors.gold },
                          ]}
                        >
                          {toArabicIndic(ayah.number)}
                        </Text>
                      </View>
                      <View style={styles.ayahMetaGroup}>
                        {metadata ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Play from Ayah ${ayah.number}`}
                            hitSlop={8}
                            onPress={() => {
                              void Haptics.selectionAsync();
                              void playWithUnavailableFeedback(
                                () => audio.playFromAyah(metadata, ayah.number),
                              );
                            }}
                            style={styles.ayahAudioButton}
                          >
                            <AppSymbol
                              name="waveform"
                              size={14}
                              tintColor={active ? colors.primary : colors.textFaint}
                            />
                          </Pressable>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Add Ayah ${ayah.number} to queue`}
                          hitSlop={8}
                          onPress={() => {
                            enqueueRange(number, ayah.number, ayah.number);
                            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }}
                          style={styles.ayahAudioButton}
                        >
                          <AppSymbol name="queue" size={14} tintColor={colors.textFaint} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Add Ayah ${ayah.number} to playlist`}
                          hitSlop={8}
                          onPress={() => router.push({
                            pathname: '/add-to-playlist',
                            params: { surah: String(number), start: String(ayah.number), end: String(ayah.number) },
                          })}
                          style={styles.ayahAudioButton}
                        >
                          <AppSymbol name="more" size={15} tintColor={colors.textFaint} />
                        </Pressable>
                        {startsBoundary ? (
                          <Text style={[styles.ayahMeta, { color: colors.textFaint }]}>Juz {ayah.juz} · Page {ayah.page}</Text>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={bookmarked
                            ? `Remove bookmark for Ayah ${ayah.number}`
                            : `Bookmark Ayah ${ayah.number}`}
                          accessibilityState={{ selected: bookmarked }}
                          hitSlop={6}
                          onPress={() => {
                            void Haptics.notificationAsync(
                              bookmarked
                                ? Haptics.NotificationFeedbackType.Warning
                                : Haptics.NotificationFeedbackType.Success,
                            );
                            toggleBookmark(ayahTarget);
                          }}
                          style={[
                            styles.ayahBookmarkButton,
                            { backgroundColor: bookmarked ? colors.goldSoft : 'transparent' },
                          ]}
                        >
                          <AppSymbol
                            name={bookmarked ? 'bookmarkFilled' : 'bookmark'}
                            size={13}
                            tintColor={bookmarked ? colors.gold : colors.textMuted}
                          />
                          <Text style={[styles.ayahBookmarkLabel, { color: bookmarked ? colors.gold : colors.textMuted }]}>
                            {bookmarked ? 'Saved' : 'Bookmark'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                    <Text
                      accessibilityLanguage="ar"
                      style={[
                        styles.ayahArabic,
                        {
                          color: colors.text,
                          fontSize: 34 * fontScale,
                          lineHeight: 61 * fontScale,
                        },
                      ]}
                    >
                      {ayah.arabic}
                    </Text>
                  </View>
                  {index < (chapter?.ayahs.length ?? 0) - 1 ? (
                    <View style={[styles.ayahDivider, { backgroundColor: colors.border }]} />
                  ) : null}
                </View>
              );
            })}
          </View>

          {chapter ? (
            <Text style={[styles.attribution, { color: colors.textFaint }]}>
              Uthmani Arabic Quran text
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  navigation: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    height: 66,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  navigationStart: { width: 88, flexDirection: 'row' },
  navigationTitle: { flex: 1, alignItems: 'center' },
  navigationActions: { width: 88, flexDirection: 'row', justifyContent: 'flex-end' },
  navTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  navMeta: { fontSize: 10, marginTop: 2 },
  scrollContent: { paddingBottom: 54 },
  scrollContentWithPlayer: { paddingBottom: 132 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 14 },
  surahHeader: { alignItems: 'center', paddingTop: 18, paddingBottom: 18 },
  surahNumber: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  surahArabic: {
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 40,
    lineHeight: 60,
    writingDirection: 'rtl',
    marginTop: 10,
  },
  surahEnglish: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  surahMeta: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  readerToolbar: {
    width: '100%',
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  fontControls: {
    height: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fontButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  fontScaleLabel: { fontSize: 10, lineHeight: 14, fontWeight: '700' },
  loading: { paddingVertical: 70, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13 },
  errorPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.panel,
    padding: 22,
    marginVertical: 8,
    alignItems: 'flex-start',
  },
  errorTitle: { marginTop: 12, fontSize: 18, fontWeight: '600' },
  errorBody: { fontSize: 13, lineHeight: 20, marginTop: 6 },
  errorLink: { fontSize: 14, fontWeight: '600', marginTop: 14 },
  ayahList: {
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.panel,
    overflow: 'hidden',
  },
  basmalaRow: { paddingHorizontal: 16, paddingVertical: 10 },
  basmalaText: {
    fontFamily: 'AmiriQuran_400Regular',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  ayah: {
    borderStartWidth: 3,
    borderStartColor: 'transparent',
    marginHorizontal: 7,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 15,
  },
  ayahTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ayahNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayahNumberText: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  ayahMetaGroup: { flex: 1, marginStart: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  ayahAudioButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  ayahMeta: { fontSize: 10, fontWeight: '500' },
  ayahBookmarkButton: { minHeight: 30, borderRadius: 15, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  ayahBookmarkLabel: { fontSize: 10, lineHeight: 14, fontWeight: '600' },
  ayahArabic: {
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 34,
    lineHeight: 61,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 8,
  },
  ayahDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20 },
  attribution: { textAlign: 'center', fontSize: 10, marginTop: 24, marginBottom: 18 },
});