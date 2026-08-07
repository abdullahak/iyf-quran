import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import { playWithUnavailableFeedback } from '@/audio/playbackFeedback';
import { makeAyahTarget } from '@/bookmarks/bookmarks';
import { useBookmarks } from '@/bookmarks/BookmarksProvider';
import { ClassicMedinaPage } from '@/classic-medina/ClassicMedinaPage';
import { AppSymbol } from '@/components/AppSymbol';
import { GlassSurface } from '@/components/GlassSurface';
import { IconButton } from '@/components/IconButton';
import { ResponsiveMushafPage } from '@/components/ResponsiveMushafPage';
import {
  bottomControlOffset,
  floatingPlayerBottomOffset,
  readerScrollPadding,
} from '@/components/playerBarLayout';
import { SurahOpening } from '@/components/SurahOpening';
import type { Ayah, QuranChapter } from '@/data/alFatiha';
import { chapterByNumber } from '@/data/chapters';
import {
  medinaPage,
  medinaPageForAyah,
  medinaPageMetadata,
  medinaPageSegments,
} from '@/data/pages';
import { useReadingHistory } from '@/reader/ReadingHistoryProvider';
import { useI18n } from '@/i18n/useI18n';
import {
  pageTurnAfterSwipe,
  pageTurnOffsets,
  shouldCapturePageSwipe,
  type PageTurn,
} from '@/reader/pageSwipe';
import {
  parseQuranPosition,
  parseReadingFocus,
  readingRouteForMushafPlaybackTransition,
  readingRouteForResponsiveWindow,
  type ReadingFocus,
} from '@/reader/readingRoute';
import {
  immediatelyPreviousResponsiveReadingPosition,
  nextResponsiveReadingPosition,
  previousResponsiveReadingPosition,
  responsiveReadingWindow,
} from '@/reader/responsiveReadingWindow';
import {
  fittedMushafContentHeight,
  mushafReaderSurface,
} from '@/reader/mushafReaderSurface';
import { useReaderSettings } from '@/reader/ReaderSettingsProvider';
import { useAppSettings } from '@/settings/AppSettingsProvider';
import { loadChapter } from '@/services/quran';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius, shadow } from '@/theme/tokens';

type PageSegment = {
  chapter: QuranChapter;
  startAyah: number;
  endAyah: number;
  ayahs: Ayah[];
};

type SelectedAyah = { surah: number; ayah: number };

type LoadedContent = {
  key: string;
  segments: PageSegment[];
  error?: string;
};

function toArabicIndic(value: number) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

export default function MushafPageScreen() {
  const params = useLocalSearchParams<{
    page: string | string[];
    focus?: string | string[];
    initial?: string | string[];
    until?: string | string[];
  }>();
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const focusParam = Array.isArray(params.focus) ? params.focus[0] : params.focus;
  const initialParam = Array.isArray(params.initial) ? params.initial[0] : params.initial;
  const untilParam = Array.isArray(params.until) ? params.until[0] : params.until;
  const pageNumber = Number(pageParam);
  const boundary = medinaPage(pageNumber);
  const colors = useAppPalette();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const { isRTL, language, number: localizedNumber, t } = useI18n();
  const router = useRouter();
  const audio = useQuranAudio();
  const { settings } = useAppSettings();
  const { fontScale } = useReaderSettings();
  const { recordPosition } = useReadingHistory();
  const { enqueueRange } = usePlaybackLibrary();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [loadedContent, setLoadedContent] = useState<LoadedContent>({ key: '', segments: [] });
  const [selected, setSelected] = useState<SelectedAyah>();
  const [pageTranslateX] = useState(() => new Animated.Value(0));
  const [pendingTurn, setPendingTurn] = useState<Pick<PageTurn, 'direction' | 'targetPage'>>();
  const [transitionInFlight, setTransitionInFlight] = useState(false);
  const [visibleReadingPosition, setVisibleReadingPosition] = useState<ReadingFocus>();
  const previousPlaybackPosition = useRef<ReadingFocus | undefined>(audio.chapter
    ? { surah: audio.chapter.number, ayah: audio.activeAyah ?? 1 }
    : undefined);
  const activePlaybackPosition = audio.chapter && audio.activeAyah
    ? { surah: audio.chapter.number, ayah: audio.activeAyah }
    : undefined;
  const readerSurface = mushafReaderSurface(settings.readerMode);
  const fittedContentHeight = fittedMushafContentHeight({
    viewportHeight,
    safeAreaTop: insets.top,
    safeAreaBottom: insets.bottom,
    playerVisible: Boolean(audio.chapter),
    selectionVisible: Boolean(selected),
  });
  const displayedPageNumber = settings.readerMode === 'mushaf' && visibleReadingPosition
    ? medinaPageForAyah(visibleReadingPosition.surah, visibleReadingPosition.ayah)?.page ?? pageNumber
    : pageNumber;
  const pageMetadata = useMemo(
    () => medinaPageMetadata(displayedPageNumber),
    [displayedPageNumber],
  );
  const focusedAyah = useMemo(
    () => parseReadingFocus(focusParam, pageNumber),
    [focusParam, pageNumber],
  );
  const responsiveWindowStart = useMemo<ReadingFocus | undefined>(() => {
    if (!boundary || settings.readerMode !== 'mushaf') return undefined;
    return focusedAyah ?? { surah: boundary.first[0], ayah: boundary.first[1] };
  }, [boundary, focusedAyah, settings.readerMode]);
  const responsiveWindowEnd = useMemo(
    () => parseQuranPosition(untilParam),
    [untilParam],
  );
  const responsiveInitialPosition = useMemo(
    () => parseQuranPosition(initialParam),
    [initialParam],
  );
  const responsiveWindow = useMemo(() => {
    if (!responsiveWindowStart) return [];
    try {
      return responsiveReadingWindow(responsiveWindowStart, undefined, responsiveWindowEnd);
    } catch {
      return responsiveReadingWindow(responsiveWindowStart);
    }
  }, [responsiveWindowEnd, responsiveWindowStart]);
  const nextResponsivePosition = useMemo(
    () => nextResponsiveReadingPosition(responsiveWindow),
    [responsiveWindow],
  );
  const previousResponsivePosition = useMemo(
    () => responsiveWindowStart
      ? previousResponsiveReadingPosition(responsiveWindowStart)
      : undefined,
    [responsiveWindowStart],
  );
  const previousResponsiveInitialPosition = useMemo(
    () => responsiveWindowStart
      ? immediatelyPreviousResponsiveReadingPosition(responsiveWindowStart)
      : undefined,
    [responsiveWindowStart],
  );
  const contentRanges = useMemo(() => {
    if (!boundary) return [];
    return settings.readerMode === 'mushaf'
      ? responsiveWindow
      : medinaPageSegments(pageNumber);
  }, [boundary, pageNumber, responsiveWindow, settings.readerMode]);
  const contentKey = `${settings.readerMode}:${pageNumber}:${responsiveInitialPosition?.surah ?? ''}:${responsiveInitialPosition?.ayah ?? ''}:${contentRanges.map((range) => (
    `${range.surah}:${range.startAyah}-${range.endAyah}`
  )).join('|')}`;
  const segments = loadedContent.key === contentKey ? loadedContent.segments : [];
  const error = loadedContent.key === contentKey ? loadedContent.error : undefined;
  const pageContextLabel = useMemo(() => {
    if (!pageMetadata) return t('mushaf.meta');
    const chapterName = (number: number) => {
      const chapter = chapterByNumber(number);
      if (!chapter) return '';
      return language === 'ar'
        ? chapter.arabicName.replace(/^سُورَةُ\s*/, '')
        : chapter.englishName;
    };
    const firstSurah = pageMetadata.surahNumbers[0];
    const lastSurah = pageMetadata.surahNumbers.at(-1);
    const firstJuz = pageMetadata.juzNumbers[0];
    const lastJuz = pageMetadata.juzNumbers.at(-1);
    if (firstSurah === undefined || lastSurah === undefined || firstJuz === undefined || lastJuz === undefined) {
      return t('mushaf.meta');
    }
    const surahLabel = firstSurah === lastSurah
      ? chapterName(firstSurah)
      : `${chapterName(firstSurah)}–${chapterName(lastSurah)}`;
    const juzLabel = firstJuz === lastJuz
      ? t('common.juz', { number: localizedNumber(firstJuz) })
      : `${t('common.juz', { number: localizedNumber(firstJuz) })}–${t('common.juz', { number: localizedNumber(lastJuz) })}`;
    return `${surahLabel} · ${juzLabel}`;
  }, [language, localizedNumber, pageMetadata, t]);

  useEffect(() => {
    if (!boundary) return;
    let active = true;
    Promise.all(contentRanges.map(async (range) => {
      const chapter = await loadChapter(range.surah);
      return {
        chapter,
        startAyah: range.startAyah,
        endAyah: range.endAyah,
        ayahs: chapter.ayahs.filter((ayah) => ayah.number >= range.startAyah && ayah.number <= range.endAyah),
      };
    }))
      .then((loaded) => {
        if (!active) return;
        setLoadedContent({ key: contentKey, segments: loaded });
        setSelected(responsiveInitialPosition ? undefined : focusedAyah);
        setVisibleReadingPosition(
          responsiveInitialPosition ?? focusedAyah ?? { surah: boundary.first[0], ayah: boundary.first[1] },
        );
        recordPosition(
          responsiveInitialPosition?.surah ?? focusedAyah?.surah ?? boundary.first[0],
          responsiveInitialPosition?.ayah ?? focusedAyah?.ayah ?? boundary.first[1],
        );
      })
      .catch((reason: unknown) => {
        if (active) {
          setLoadedContent({
            key: contentKey,
            segments: [],
            error: reason instanceof Error ? reason.message : 'This Mushaf page could not be loaded.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [boundary, contentKey, contentRanges, focusedAyah, recordPosition, responsiveInitialPosition]);

  useEffect(() => {
    const currentPlaybackPosition = audio.chapter
      ? { surah: audio.chapter.number, ayah: audio.activeAyah ?? 1 }
      : undefined;
    const route = readingRouteForMushafPlaybackTransition(
      settings.readerMode,
      displayedPageNumber,
      previousPlaybackPosition.current,
      currentPlaybackPosition,
    );
    previousPlaybackPosition.current = currentPlaybackPosition;
    if (route) router.replace(route);
  }, [audio.activeAyah, audio.chapter, displayedPageNumber, router, settings.readerMode]);

  const selectedTarget = useMemo(
    () => selected ? makeAyahTarget(selected.surah, selected.ayah) : undefined,
    [selected],
  );
  const selectedSaved = selectedTarget ? isBookmarked(selectedTarget.key) : false;
  const selectAyah = useCallback((surah: number, ayah: number) => {
    void Haptics.selectionAsync();
    setSelected({ surah, ayah });
    recordPosition(surah, ayah);
  }, [recordPosition]);
  const updateVisibleReadingPosition = useCallback((surah: number, ayah: number) => {
    setVisibleReadingPosition({ surah, ayah });
    recordPosition(surah, ayah);
  }, [recordPosition]);
  const openNextResponsiveWindow = useCallback(() => {
    if (!nextResponsivePosition) return;
    const route = readingRouteForResponsiveWindow(nextResponsivePosition);
    if (route) router.replace(route);
  }, [nextResponsivePosition, router]);
  const openPreviousResponsiveWindow = useCallback(() => {
    if (
      !previousResponsivePosition ||
      !previousResponsiveInitialPosition ||
      !responsiveWindowStart
    ) return;
    const route = readingRouteForResponsiveWindow(
      previousResponsivePosition,
      responsiveWindowStart,
      previousResponsiveInitialPosition,
    );
    if (route) router.replace(route);
  }, [
    previousResponsiveInitialPosition,
    previousResponsivePosition,
    responsiveWindowStart,
    router,
  ]);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/quran'));
  useEffect(() => {
    if (!pendingTurn) {
      pageTranslateX.setValue(0);
      return;
    }
    if (pendingTurn.targetPage !== pageNumber) return;
    const { enterX } = pageTurnOffsets(pendingTurn.direction, viewportWidth);
    pageTranslateX.setValue(enterX);
    Animated.timing(pageTranslateX, {
      toValue: 0,
      duration: 190,
      useNativeDriver: true,
    }).start(() => {
      setPendingTurn(undefined);
      setTransitionInFlight(false);
    });
  }, [pageNumber, pageTranslateX, pendingTurn, viewportWidth]);

  const restoreCurrentPage = useCallback(() => {
    Animated.spring(pageTranslateX, {
      toValue: 0,
      damping: 24,
      stiffness: 260,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [pageTranslateX]);

  const animatePageTurn = useCallback((turn: PageTurn) => {
    if (transitionInFlight || !medinaPage(turn.targetPage)) return;
    setTransitionInFlight(true);
    void Haptics.selectionAsync();
    const { exitX } = pageTurnOffsets(turn.direction, viewportWidth);
    Animated.timing(pageTranslateX, {
      toValue: exitX,
      duration: 170,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        setTransitionInFlight(false);
        restoreCurrentPage();
        return;
      }
      setPendingTurn({ direction: turn.direction, targetPage: turn.targetPage });
      router.replace({ pathname: '/mushaf/[page]', params: { page: String(turn.targetPage) } });
    });
  }, [pageTranslateX, restoreCurrentPage, router, transitionInFlight, viewportWidth]);

  const animateToPage = useCallback((targetPage: number) => {
    if (!medinaPage(targetPage) || targetPage === pageNumber) return;
    const direction = targetPage > pageNumber ? 'next' : 'previous';
    animatePageTurn(direction === 'next'
      ? { targetPage, direction, exitEdge: 'right', enterEdge: 'left' }
      : { targetPage, direction, exitEdge: 'left', enterEdge: 'right' });
  }, [animatePageTurn, pageNumber]);

  const pagePanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) => (
      !transitionInFlight && shouldCapturePageSwipe(gesture.dx, gesture.dy)
    ),
    onPanResponderMove: (_event, gesture) => pageTranslateX.setValue(gesture.dx),
    onPanResponderRelease: (_event, gesture) => {
      const turn = pageTurnAfterSwipe(pageNumber, gesture.dx, gesture.vx);
      if (turn) animatePageTurn(turn);
      else restoreCurrentPage();
    },
    onPanResponderTerminate: restoreCurrentPage,
    onPanResponderTerminationRequest: () => false,
  }), [animatePageTurn, pageNumber, pageTranslateX, restoreCurrentPage, transitionInFlight]);

  if (!boundary) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>{t('mushaf.notFound')}</Text>
        <Pressable onPress={() => router.replace('/(tabs)/quran')}>
          <Text style={[styles.errorAction, { color: colors.primary }]}>{t('mushaf.returnRead')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.navigation}>
        <IconButton name={isRTL ? 'forward' : 'back'} label={t('mushaf.close')} onPress={close} />
        <View style={styles.navigationTitle}>
          <Text style={[styles.navTitle, { color: colors.text }]}>{t('common.page', { number: localizedNumber(displayedPageNumber) })}</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            style={[styles.navMeta, { color: colors.textMuted }]}
          >
            {pageContextLabel}
          </Text>
        </View>
        <View style={styles.navigationEnd} />
      </View>

      <View style={styles.readerBody}>
        <Animated.View
          testID="mushaf-page-turn-surface"
          style={[styles.pageTurnSurface, { transform: [{ translateX: pageTranslateX }] }]}
          {...(readerSurface.ownsCanonicalSwipe ? pagePanResponder.panHandlers : {})}
        >
          {readerSurface.kind === 'classic-medina' ? (
            <View style={[styles.fittedSurface, { height: fittedContentHeight }]}>
              <ClassicMedinaPage
                active={activePlaybackPosition}
                availableHeight={fittedContentHeight}
                color={colors.text}
                errorTitle={t('mushaf.loadError')}
                errorBody={t('mushaf.loadErrorBody')}
                focused={selected}
                onSelectAyah={selectAyah}
                pageNumber={pageNumber}
                style={{ backgroundColor: colors.surface }}
              />
            </View>
          ) : readerSurface.kind === 'responsive-mushaf' ? (
            <View style={[styles.fittedSurface, { height: fittedContentHeight, backgroundColor: colors.surface }]}>
              {segments.length === 0 && !error ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : error ? (
                <View style={styles.loading}>
                  <AppSymbol name="wifiError" size={23} tintColor={colors.gold} />
                  <Text style={[styles.errorTitle, { color: colors.text }]}>{t('mushaf.loadError')}</Text>
                  <Text style={[styles.errorBody, { color: colors.textMuted }]}>
                    {language === 'ar' ? t('mushaf.loadErrorBody') : error}
                  </Text>
                </View>
              ) : (
                <ResponsiveMushafPage
                  active={activePlaybackPosition}
                  availableHeight={fittedContentHeight}
                  segments={segments}
                  fontScale={fontScale}
                  initialPosition={responsiveInitialPosition}
                  focused={selected}
                  onSelect={selectAyah}
                  onPositionChange={updateVisibleReadingPosition}
                  onPreviousPage={openPreviousResponsiveWindow}
                  onNextPage={openNextResponsiveWindow}
                />
              )}
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: readerScrollPadding(Boolean(audio.chapter), 150) },
              ]}
            >
              <View
                style={[
                  styles.page,
                  shadow.subtle,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {segments.length === 0 && !error ? (
                  <View style={styles.loading}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : null}
                {error ? (
                  <View style={styles.loading}>
                    <AppSymbol name="wifiError" size={23} tintColor={colors.gold} />
                    <Text style={[styles.errorTitle, { color: colors.text }]}>{t('mushaf.loadError')}</Text>
                    <Text style={[styles.errorBody, { color: colors.textMuted }]}>
                      {language === 'ar' ? t('mushaf.loadErrorBody') : error}
                    </Text>
                  </View>
                ) : null}
                {segments.map((segment) => (
                  <View key={`${segment.chapter.number}:${segment.startAyah}`}>
                    {segment.startAyah === 1 ? (
                      <SurahOpening
                        accessibilityLabel={t('surahOpening.label', {
                          surah: language === 'ar'
                            ? segment.chapter.arabicName.replace(/^سُورَةُ\s*/, '')
                            : segment.chapter.englishName,
                        })}
                        accessibilityLanguage={language}
                        chapterNumber={segment.chapter.number}
                        arabicName={segment.chapter.arabicName}
                      />
                    ) : null}
                    <Text
                      accessibilityLanguage="ar"
                      style={[
                        styles.mushafText,
                        { color: colors.text, fontSize: 29 * fontScale, lineHeight: 52 * fontScale },
                      ]}
                    >
                      {segment.ayahs.map((ayah) => {
                        const playing = activePlaybackPosition?.surah === segment.chapter.number
                          && activePlaybackPosition.ayah === ayah.number;
                        const active = !activePlaybackPosition
                          && selected?.surah === segment.chapter.number
                          && selected.ayah === ayah.number;
                        return (
                          <Text
                            key={`${segment.chapter.number}:${ayah.number}`}
                            accessibilityRole="button"
                            accessibilityLabel={t('mushaf.selectAyah', {
                              surah: language === 'ar'
                                ? segment.chapter.arabicName.replace(/^سُورَةُ\s*/, '')
                                : segment.chapter.englishName,
                              ayah: localizedNumber(ayah.number),
                            })}
                            onPress={() => selectAyah(segment.chapter.number, ayah.number)}
                            style={playing || active
                              ? { backgroundColor: colors.primarySoft, color: colors.primaryStrong }
                              : undefined}
                          >
                            {ayah.arabic} ﴿{toArabicIndic(ayah.number)}﴾{' '}
                          </Text>
                        );
                      })}
                    </Text>
                  </View>
                ))}
                <Text style={[styles.pageFooter, { color: colors.textFaint }]}>{pageNumber}</Text>
              </View>

              <View style={styles.pageNavigation}>
                <Pressable
                  disabled={pageNumber === 1}
                  accessibilityRole="button"
                  accessibilityLabel={t('mushaf.previousPage')}
                  accessibilityState={{ disabled: pageNumber === 1 }}
                  onPress={() => animateToPage(pageNumber - 1)}
                  style={[styles.pageNavButton, { opacity: pageNumber === 1 ? 0.25 : 1 }]}
                >
                  <AppSymbol name={isRTL ? 'forward' : 'back'} size={17} tintColor={colors.text} />
                  <Text style={[styles.pageNavText, { color: colors.text }]}>{t('common.previous')}</Text>
                </Pressable>
                <Pressable
                  disabled={pageNumber === 604}
                  accessibilityRole="button"
                  accessibilityLabel={t('mushaf.nextPage')}
                  accessibilityState={{ disabled: pageNumber === 604 }}
                  onPress={() => animateToPage(pageNumber + 1)}
                  style={[styles.pageNavButton, { opacity: pageNumber === 604 ? 0.25 : 1 }]}
                >
                  <Text style={[styles.pageNavText, { color: colors.text }]}>{t('common.next')}</Text>
                  <AppSymbol name={isRTL ? 'back' : 'forward'} size={17} tintColor={colors.text} />
                </Pressable>
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </View>

      {selected && selectedTarget ? (
        <GlassSurface
          interactive
          strength="regular"
          style={[
            styles.selectionBar,
            {
              bottom: bottomControlOffset(
                Boolean(audio.chapter),
                floatingPlayerBottomOffset(insets.bottom),
              ),
            },
          ]}
        >
          <View style={styles.selectionIdentity}>
            <Text style={[styles.selectionTitle, { color: colors.text }]}>{t('mushaf.selectedAyah', { surah: localizedNumber(selected.surah), ayah: localizedNumber(selected.ayah) })}</Text>
            <Text style={[styles.selectionHint, { color: colors.textMuted }]}>{t('common.selected')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selectedSaved ? t('mushaf.removeBookmark') : t('mushaf.bookmarkSelected')}
            onPress={() => toggleBookmark(selectedTarget)}
            style={styles.selectionAction}
          >
            <AppSymbol name={selectedSaved ? 'bookmarkFilled' : 'bookmark'} size={18} tintColor={selectedSaved ? colors.gold : colors.primary} />
            <Text numberOfLines={1} style={[styles.selectionActionText, { color: colors.text }]}>{selectedSaved ? t('common.saved') : t('common.bookmark')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.playAyah', { ayah: localizedNumber(selected.ayah) })}
            onPress={() => {
              const chapter = chapterByNumber(selected.surah);
              if (chapter) {
                void playWithUnavailableFeedback(
                  () => audio.playFromAyah(chapter, selected.ayah),
                );
              }
            }}
            style={styles.selectionAction}
          >
            <AppSymbol name="play" size={15} tintColor={colors.primary} />
            <Text numberOfLines={1} style={[styles.selectionActionText, { color: colors.text }]}>{t('common.play')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.queueAyah', { ayah: localizedNumber(selected.ayah) })}
            onPress={() => {
              enqueueRange(selected.surah, selected.ayah, selected.ayah);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
            style={styles.selectionAction}
          >
            <AppSymbol name="queue" size={18} tintColor={colors.primary} />
            <Text numberOfLines={1} style={[styles.selectionActionText, { color: colors.text }]}>{t('common.queue')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.playlistAyah', { ayah: localizedNumber(selected.ayah) })}
            onPress={() => router.push({
              pathname: '/add-to-playlist',
              params: { surah: String(selected.surah), start: String(selected.ayah), end: String(selected.ayah) },
            })}
            style={styles.selectionAction}
          >
            <AppSymbol name="more" size={15} tintColor={colors.primary} />
            <Text numberOfLines={1} style={[styles.selectionActionText, { color: colors.text }]}>{t('common.playlist')}</Text>
          </Pressable>
          <IconButton name="close" label={t('mushaf.clearSelection')} onPress={() => setSelected(undefined)} />
        </GlassSurface>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  navigation: { height: 60, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  navigationTitle: { flex: 1, alignItems: 'center' },
  navigationEnd: { width: 44 },
  readerBody: { flex: 1, overflow: 'hidden' },
  pageTurnSurface: { flex: 1 },
  fittedSurface: { width: '100%', alignSelf: 'center', alignItems: 'center', overflow: 'hidden' },
  navTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  navMeta: { marginTop: 1, fontSize: 10, lineHeight: 14 },
  scrollContent: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 12, paddingBottom: 150 },
  page: { minHeight: 680, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, paddingHorizontal: 20, paddingVertical: 22 },
  loading: { minHeight: 540, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 12 },

  mushafText: { fontFamily: 'AmiriQuran_400Regular', textAlign: 'justify', writingDirection: 'rtl' },
  pageFooter: { marginTop: 18, textAlign: 'center', fontSize: 11, fontVariant: ['tabular-nums'] },
  pageNavigation: { height: 58, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageNavButton: { minWidth: 100, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pageNavText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  selectionBar: { position: 'absolute', left: 12, right: 12, bottom: 12, minHeight: 72, borderRadius: 24, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  selectionIdentity: { width: 62, flexShrink: 0 },
  selectionTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  selectionHint: { fontSize: 10, lineHeight: 14 },
  selectionAction: { flex: 1, minWidth: 0, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  selectionActionText: { marginTop: 2, fontSize: 9, lineHeight: 12, fontWeight: '600' },
  errorTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  errorBody: { maxWidth: 320, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  errorAction: { marginTop: 12, fontSize: 14, fontWeight: '600' },
});
