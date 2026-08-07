import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { SurahOpening } from '@/components/SurahOpening';
import type { Ayah, QuranChapter } from '@/data/alFatiha';
import { useI18n } from '@/i18n/useI18n';
import {
  paginateResponsiveAyahs,
  RESPONSIVE_MUSHAF_OPENING_LINE_COST,
  responsiveMushafSectionLineCount,
  responsiveMushafScreenAfterSwipe,
  responsiveMushafTypography,
  responsiveMushafViewport,
  type ResponsiveMushafAyah,
} from '@/reader/responsiveMushaf';
import { pageTurnOffsets, shouldCapturePageSwipe } from '@/reader/pageSwipe';
import { useAppPalette } from '@/theme/useAppPalette';

type ResponsiveMushafSegment = {
  chapter: QuranChapter;
  ayahs: readonly Ayah[];
};

type Props = {
  active?: { surah: number; ayah: number };
  availableHeight: number;
  segments: readonly ResponsiveMushafSegment[];
  fontScale: number;
  initialPosition?: { surah: number; ayah: number };
  focused?: { surah: number; ayah: number };
  onSelect: (surah: number, ayah: number) => void;
  onPositionChange: (surah: number, ayah: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function ResponsiveMushafPage({
  active,
  availableHeight,
  segments,
  fontScale,
  initialPosition,
  focused,
  onSelect,
  onPositionChange,
  onPreviousPage,
  onNextPage,
}: Props) {
  const colors = useAppPalette();
  const { language, number: localizedNumber, t } = useI18n();
  const { height, width } = useWindowDimensions();
  const viewportStyle = responsiveMushafViewport(width, availableHeight);
  const contentWidth = Math.min(620, width - 32);
  const typography = useMemo(
    () => responsiveMushafTypography(width, availableHeight, fontScale),
    [availableHeight, fontScale, width],
  );
  const { charsPerLine, fontSize, lineCapacity, lineHeight } = typography;
  const flattened = useMemo<ResponsiveMushafAyah[]>(
    () => segments.flatMap((segment) => segment.ayahs.map((ayah) => ({
      key: `${segment.chapter.number}:${ayah.number}`,
      surah: segment.chapter.number,
      ayah: ayah.number,
      arabic: ayah.arabic,
      marker: ` ﴿${localizedNumber(ayah.number)}﴾ `,
      startsSurah: ayah.number === 1,
    }))),
    [localizedNumber, segments],
  );
  const pages = useMemo(
    () => paginateResponsiveAyahs(flattened, typography),
    [flattened, typography],
  );
  const paginationKey = `${width}:${height}:${availableHeight}:${charsPerLine}:${lineCapacity}:${flattened[0]?.key ?? ''}:${flattened.at(-1)?.key ?? ''}:${flattened.length}:${active?.surah ?? ''}:${active?.ayah ?? ''}`;
  const [screenPosition, setScreenPosition] = useState({ key: '', index: 0 });
  const initialTarget = initialPosition ?? active ?? focused;
  const focusedScreenIndex = initialTarget
    ? Math.max(0, pages.findIndex((page) => page.some((ayah) => (
        ayah.surah === initialTarget.surah && ayah.ayah === initialTarget.ayah
      ))))
    : 0;
  const screenIndex = screenPosition.key === paginationKey
    ? Math.min(screenPosition.index, Math.max(0, pages.length - 1))
    : focusedScreenIndex;
  const visibleFirstAyah = pages[screenIndex]?.[0];
  const screenSections = useMemo(() => (
    pages[screenIndex] ?? []
  ).reduce<ResponsiveMushafAyah[][]>((sections, ayah) => {
    if (ayah.startsSurah || sections.length === 0) sections.push([]);
    sections.at(-1)!.push(ayah);
    return sections;
  }, []), [pages, screenIndex]);
  const [translateX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visibleFirstAyah) onPositionChange(visibleFirstAyah.surah, visibleFirstAyah.ayah);
  }, [onPositionChange, visibleFirstAyah]);

  const restoreScreen = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      damping: 24,
      stiffness: 260,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const animateToScreen = useCallback((targetIndex: number) => {
    const direction = targetIndex > screenIndex ? 'next' : 'previous';
    const { enterX, exitX } = pageTurnOffsets(direction, width);
    Animated.timing(translateX, {
      toValue: exitX,
      duration: 170,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        restoreScreen();
        return;
      }
      translateX.setValue(enterX);
      setScreenPosition({ key: paginationKey, index: targetIndex });
      requestAnimationFrame(() => {
        Animated.timing(translateX, {
          toValue: 0,
          duration: 190,
          useNativeDriver: true,
        }).start();
      });
    });
  }, [paginationKey, restoreScreen, screenIndex, translateX, width]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) => (
      shouldCapturePageSwipe(gesture.dx, gesture.dy)
    ),
    onPanResponderMove: (_event, gesture) => translateX.setValue(gesture.dx),
    onPanResponderRelease: (_event, gesture) => {
      const target = responsiveMushafScreenAfterSwipe(
        screenIndex,
        pages.length,
        gesture.dx,
        gesture.vx,
      );
      if (!target) {
        restoreScreen();
      } else if (target.kind === 'screen') {
        animateToScreen(target.index);
      } else {
        restoreScreen();
        if (target.direction === 'next') onNextPage();
        else onPreviousPage();
      }
    },
    onPanResponderTerminate: restoreScreen,
    onPanResponderTerminationRequest: () => false,
  }), [animateToScreen, onNextPage, onPreviousPage, pages.length, restoreScreen, screenIndex, translateX]);

  return (
    <View
      style={[styles.root, viewportStyle]}
      testID="reading-mushaf-view"
      {...panResponder.panHandlers}
    >
      <Animated.View
        testID="reading-mushaf-pager"
        style={[
          styles.pager,
          { width: viewportStyle.width, transform: [{ translateX }] },
        ]}
      >
        <View
          testID={`reading-mushaf-screen-${screenIndex}`}
          style={[styles.screen, { width, paddingHorizontal: Math.max(16, (width - contentWidth) / 2) }]}
        >
          {screenSections.map((section) => {
            const first = section[0];
            const last = section[section.length - 1];
            const opening = first?.startsSurah
              ? segments.find((segment) => segment.chapter.number === first.surah)?.chapter
              : undefined;
            const sectionLineLimit = Math.max(
              1,
              Math.min(
                responsiveMushafSectionLineCount(section, charsPerLine),
                lineCapacity - (opening ? RESPONSIVE_MUSHAF_OPENING_LINE_COST : 0),
              ),
            );
            return (
              <View
                key={first?.key ?? 'empty'}
                testID={first && last
                  ? `reading-mushaf-section-${first.surah}-${first.ayah}-${last.ayah}`
                  : 'reading-mushaf-section-empty'}
              >
                {opening ? (
                  <SurahOpening
                    chapterNumber={opening.number}
                    arabicName={opening.arabicName}
                    maxHeight={lineHeight * RESPONSIVE_MUSHAF_OPENING_LINE_COST}
                    accessibilityLanguage={language}
                    accessibilityLabel={t('surahOpening.label', {
                      surah: language === 'ar'
                        ? opening.arabicName.replace(/^سُورَةُ\s*/, '')
                        : opening.englishName,
                    })}
                  />
                ) : null}
                <Text
                  adjustsFontSizeToFit
                  accessibilityLanguage="ar"
                  minimumFontScale={0.1}
                  numberOfLines={sectionLineLimit}
                  style={[styles.quranText, { color: colors.text, fontSize, lineHeight }]}
                  testID={`reading-mushaf-text-${first?.key ?? 'empty'}`}
                >
                  {section.map((ayah) => {
                    const playing = active?.surah === ayah.surah && active.ayah === ayah.ayah;
                    const selected = !active && focused?.surah === ayah.surah && focused.ayah === ayah.ayah;
                    return (
                      <Text
                        key={ayah.key}
                        accessibilityRole="button"
                        accessibilityLabel={t('mushaf.selectAyah', {
                          surah: localizedNumber(ayah.surah),
                          ayah: localizedNumber(ayah.ayah),
                        })}
                        onPress={() => onSelect(ayah.surah, ayah.ayah)}
                        style={playing || selected
                          ? { color: colors.primary, backgroundColor: colors.primarySoft }
                          : undefined}
                      >
                        {ayah.arabic}{ayah.marker}
                      </Text>
                    );
                  })}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>
      {pages.length > 1 ? (
        <Text style={[styles.pageIndicator, { color: colors.textMuted }]}>
          {localizedNumber(screenIndex + 1)}/{localizedNumber(pages.length)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  pager: { flex: 1 },
  screen: { flex: 1, justifyContent: 'flex-start', paddingVertical: 12 },
  quranText: {
    flexShrink: 1,
    fontFamily: 'AmiriQuran_400Regular',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    fontSize: 10,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
});
