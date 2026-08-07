import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import { playWithUnavailableFeedback } from '@/audio/playbackFeedback';
import {
  DEFAULT_RECITER_ID,
  isRecitationSelectionActive,
  reciterById,
} from '@/audio/reciter';
import { makeAyahTarget, makeRangeTarget, makeSurahTarget } from '@/bookmarks/bookmarks';
import { useBookmarks } from '@/bookmarks/BookmarksProvider';
import { Atmosphere } from '@/components/Atmosphere';
import { AppSymbol } from '@/components/AppSymbol';
import { IconButton } from '@/components/IconButton';
import {
  bottomControlOffset,
  floatingPlayerBottomOffset,
  readerScrollPadding,
} from '@/components/playerBarLayout';
import { SurahOpening } from '@/components/SurahOpening';
import { AL_FATIHA_FALLBACK, type QuranChapter } from '@/data/alFatiha';
import { chapterByNumber } from '@/data/chapters';
import { useReadingHistory } from '@/reader/ReadingHistoryProvider';
import { updateAyahSelection, type AyahSelection } from '@/reader/ayahSelection';
import { readingRouteForPlaybackTransition } from '@/reader/readingRoute';
import { useReaderSettings } from '@/reader/ReaderSettingsProvider';
import { loadChapter } from '@/services/quran';
import { useAppSettings } from '@/settings/AppSettingsProvider';
import { useI18n } from '@/i18n/useI18n';
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
  const insets = useSafeAreaInsets();
  const { isRTL, language, number: localizedNumber, t } = useI18n();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const ayahParam = Array.isArray(params.ayah) ? params.ayah[0] : params.ayah;
  const number = Number(id);
  const targetAyah = Number(ayahParam);
  const metadata = chapterByNumber(number);
  const [chapter, setChapter] = useState<QuranChapter | null>(
    number === 1 ? AL_FATIHA_FALLBACK : null,
  );
  const [error, setError] = useState<string>();
  const [ayahSelection, setAyahSelection] = useState<AyahSelection>();
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
  const previousPlaybackSurah = useRef(audio.chapter?.number);

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

  useEffect(() => {
    const currentPlaybackSurah = audio.chapter?.number;
    const route = readingRouteForPlaybackTransition(
      settings.readerMode,
      number,
      previousPlaybackSurah.current,
      currentPlaybackSurah,
      audio.activeAyah,
    );
    previousPlaybackSurah.current = currentPlaybackSurah;
    if (route) router.replace(route);
  }, [audio.activeAyah, audio.chapter?.number, number, router, settings.readerMode]);

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
        <Text style={[styles.errorTitle, { color: colors.text }]}>{t('surah.notFound')}</Text>
        <Pressable onPress={() => router.replace('/(tabs)/quran')}>
          <Text style={[styles.errorLink, { color: colors.primary }]}>{t('surah.returnQuran')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const revelation = t(metadata.revelationType === 'Meccan' ? 'surah.meccan' : 'surah.medinan');
  const localizedSurahName = language === 'ar'
    ? metadata.arabicName.replace(/^سُورَةُ\s*/, '')
    : metadata.englishName;
  const surahTarget = makeSurahTarget(number);
  const surahBookmarked = isBookmarked(surahTarget.key);
  const selectionTarget = ayahSelection
    ? ayahSelection.startAyah === ayahSelection.endAyah
      ? makeAyahTarget(number, ayahSelection.startAyah)
      : makeRangeTarget(number, ayahSelection.startAyah, ayahSelection.endAyah)
    : undefined;
  const selectionSaved = selectionTarget ? isBookmarked(selectionTarget.key) : false;
  const selectionLabel = ayahSelection
    ? ayahSelection.startAyah === ayahSelection.endAyah
      ? t('common.selectedAyah', { ayah: localizedNumber(ayahSelection.startAyah) })
      : t('common.selectedRange', {
          start: localizedNumber(ayahSelection.startAyah),
          end: localizedNumber(ayahSelection.endAyah),
        })
    : '';
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Atmosphere />
      <View style={styles.navigation}>
        <View style={styles.navigationStart}>
          <IconButton name={isRTL ? 'forward' : 'back'} label={t('common.goBack')} onPress={goBack} />
        </View>
        <View style={styles.navigationTitle}>
          <Text style={[styles.navTitle, { color: colors.text }]}>{localizedSurahName}</Text>
          <Text style={[styles.navMeta, { color: colors.textMuted }]}>{t('surah.number', { number: localizedNumber(metadata.number) })}</Text>
        </View>
        <View style={styles.navigationActions}>
          <IconButton
            name="more"
            label={t('player.addPlaylistLabel', { surah: localizedSurahName })}
            onPress={() => router.push({
              pathname: '/add-to-playlist',
              params: { surah: String(number), start: '1', end: String(metadata.ayahCount) },
            })}
          />
          <IconButton
            name={surahBookmarked ? 'bookmarkFilled' : 'bookmark'}
            label={surahBookmarked ? t('surah.removeBookmark') : t('surah.bookmark')}
            onPress={() => toggleBookmark(surahTarget)}
          />
          <IconButton
            name={selectedRecitationActive && audio.status.playing ? 'pause' : 'play'}
            label={selectedRecitationActive && audio.status.playing ? t('player.pause') : t('player.play')}
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
          { paddingBottom: readerScrollPadding(Boolean(audio.chapter), 54) },
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
              {t('surah.headingMeta', { number: localizedNumber(metadata.number), revelation })}
            </Text>
            <SurahOpening
              accessibilityLabel={t('surahOpening.label', { surah: localizedSurahName })}
              accessibilityLanguage={language}
              arabicName={metadata.arabicName}
              chapterNumber={metadata.number}
            />
            <Text style={[styles.surahMeta, { color: colors.textMuted }]}>
              {t('surah.detailMeta', { count: localizedNumber(metadata.ayahCount), revelation })}
            </Text>
            <View style={styles.readerToolbar}>
              <View style={[styles.fontControls, { borderColor: colors.border }]}>
                <Pressable
                  disabled={!canDecreaseFont}
                  onPress={decreaseFont}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.decreaseFont')}
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
                  accessibilityLabel={t('common.increaseFont')}
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
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('surah.preparing')}</Text>
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
              <Text style={[styles.errorTitle, { color: colors.text }]}>{t('surah.loadError')}</Text>
              <Text style={[styles.errorBody, { color: colors.textMuted }]}>{language === 'ar' ? t('surah.loadErrorBody') : error}</Text>
              <Pressable
                onPress={() => {
                  setError(undefined);
                  setChapter(null);
                  void loadChapter(number).then(setChapter).catch((reason: unknown) => {
                    setError(reason instanceof Error ? reason.message : 'This surah could not be loaded.');
                  });
                }}
              >
                <Text style={[styles.errorLink, { color: colors.primary }]}>{t('common.tryAgain')}</Text>
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
            {chapter?.ayahs.map((ayah, index) => {
              const active = audio.chapter?.number === number && audio.activeAyah === ayah.number;
              const targeted = !(
                audio.chapter?.number === number && audio.activeAyah
              ) && targetAyah === ayah.number;
              const ayahTarget = makeAyahTarget(number, ayah.number);
              const bookmarked = isBookmarked(ayahTarget.key);
              const selectedForRange = Boolean(
                ayahSelection &&
                ayah.number >= ayahSelection.startAyah &&
                ayah.number <= ayahSelection.endAyah,
              );
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
                      selectedForRange && {
                        backgroundColor: colors.goldSoft,
                        borderStartColor: colors.gold,
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
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('mushaf.selectAyah', {
                            surah: localizedNumber(number),
                            ayah: localizedNumber(ayah.number),
                          })}
                          accessibilityState={{ selected: selectedForRange }}
                          onPress={() => setAyahSelection((current) => updateAyahSelection(current, ayah.number))}
                          style={[
                            styles.ayahSelectButton,
                            { backgroundColor: selectedForRange ? colors.goldSoft : 'transparent' },
                          ]}
                        >
                          <AppSymbol name={selectedForRange ? 'check' : 'add'} size={12} tintColor={selectedForRange ? colors.gold : colors.textMuted} />
                          <Text style={[styles.ayahSelectLabel, { color: selectedForRange ? colors.gold : colors.textMuted }]}>
                            {t('common.select')}
                          </Text>
                        </Pressable>
                        {metadata ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('common.playAyah', { ayah: localizedNumber(ayah.number) })}
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
                          accessibilityLabel={t('common.queueAyah', { ayah: localizedNumber(ayah.number) })}
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
                          accessibilityLabel={t('common.playlistAyah', { ayah: localizedNumber(ayah.number) })}
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
                          <Text style={[styles.ayahMeta, { color: colors.textFaint }]}>{t('common.boundaryMeta', { juz: localizedNumber(ayah.juz), page: localizedNumber(ayah.page) })}</Text>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={bookmarked
                            ? t('common.removeAyahBookmark', { ayah: localizedNumber(ayah.number) })
                            : t('common.bookmarkAyah', { ayah: localizedNumber(ayah.number) })}
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
                            {bookmarked ? t('common.saved') : t('common.bookmark')}
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
              {t('surah.attribution')}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      {ayahSelection && selectionTarget ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.selectionBar,
            {
              bottom: bottomControlOffset(Boolean(audio.chapter), floatingPlayerBottomOffset(insets.bottom)),
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.selectionLabel, { color: colors.text }]} numberOfLines={1}>
            {selectionLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.bookmarkSelection')}
            onPress={() => {
              toggleBookmark(selectionTarget);
              void Haptics.notificationAsync(
                selectionSaved
                  ? Haptics.NotificationFeedbackType.Warning
                  : Haptics.NotificationFeedbackType.Success,
              );
            }}
            style={styles.selectionAction}
          >
            <AppSymbol name={selectionSaved ? 'bookmarkFilled' : 'bookmark'} size={17} tintColor={selectionSaved ? colors.gold : colors.primary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.addSelectionPlaylist')}
            onPress={() => router.push({
              pathname: '/add-to-playlist',
              params: {
                surah: String(number),
                start: String(ayahSelection.startAyah),
                end: String(ayahSelection.endAyah),
              },
            })}
            style={styles.selectionAction}
          >
            <AppSymbol name="more" size={18} tintColor={colors.primary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.clearSelection')}
            onPress={() => setAyahSelection(undefined)}
            style={styles.selectionAction}
          >
            <AppSymbol name="close" size={16} tintColor={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
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
  navigationActions: { width: 132, flexDirection: 'row', justifyContent: 'flex-end' },
  navTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  navMeta: { fontSize: 10, marginTop: 2 },
  scrollContent: { paddingBottom: 54 },
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
  ayahSelectButton: { minHeight: 28, borderRadius: 14, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  ayahSelectLabel: { fontSize: 10, lineHeight: 14, fontWeight: '600' },
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
  selectionBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    minHeight: 58,
    maxWidth: 620,
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.glass,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionLabel: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  selectionAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});