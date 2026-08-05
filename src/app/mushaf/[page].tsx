import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import { playWithUnavailableFeedback } from '@/audio/playbackFeedback';
import { makeAyahTarget } from '@/bookmarks/bookmarks';
import { useBookmarks } from '@/bookmarks/BookmarksProvider';
import { AppSymbol } from '@/components/AppSymbol';
import { GlassSurface } from '@/components/GlassSurface';
import { IconButton } from '@/components/IconButton';
import type { Ayah, QuranChapter } from '@/data/alFatiha';
import { chapterByNumber } from '@/data/chapters';
import { medinaPage, medinaPageSegments } from '@/data/pages';
import { useReadingHistory } from '@/reader/ReadingHistoryProvider';
import { useReaderSettings } from '@/reader/ReaderSettingsProvider';
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

function toArabicIndic(value: number) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

export default function MushafPageScreen() {
  const params = useLocalSearchParams<{ page: string | string[] }>();
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const pageNumber = Number(pageParam);
  const boundary = medinaPage(pageNumber);
  const colors = useAppPalette();
  const router = useRouter();
  const audio = useQuranAudio();
  const { fontScale } = useReaderSettings();
  const { recordPosition } = useReadingHistory();
  const { enqueueRange } = usePlaybackLibrary();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [segments, setSegments] = useState<PageSegment[]>([]);
  const [selected, setSelected] = useState<SelectedAyah>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!boundary) return;
    let active = true;
    const ranges = medinaPageSegments(pageNumber);
    Promise.all(ranges.map(async (range) => {
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
        setSegments(loaded);
        setError(undefined);
        setSelected(undefined);
        recordPosition(boundary.first[0], boundary.first[1]);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'This Mushaf page could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [boundary, pageNumber, recordPosition]);

  const selectedTarget = useMemo(
    () => selected ? makeAyahTarget(selected.surah, selected.ayah) : undefined,
    [selected],
  );
  const selectedSaved = selectedTarget ? isBookmarked(selectedTarget.key) : false;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/quran'));
  const openPage = (page: number) => {
    if (!medinaPage(page)) return;
    void Haptics.selectionAsync();
    router.replace({ pathname: '/mushaf/[page]', params: { page: String(page) } });
  };

  if (!boundary) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Page not found</Text>
        <Pressable onPress={() => router.replace('/(tabs)/quran')}>
          <Text style={[styles.errorAction, { color: colors.primary }]}>Return to Read</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.navigation}>
        <IconButton name="back" label="Close Mushaf page" onPress={close} />
        <View style={styles.navigationTitle}>
          <Text style={[styles.navTitle, { color: colors.text }]}>Page {pageNumber}</Text>
          <Text style={[styles.navMeta, { color: colors.textMuted }]}>Hafs · Medina pages</Text>
        </View>
        <View style={styles.navigationEnd} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Preparing page {pageNumber}…</Text>
            </View>
          ) : null}
          {error ? (
            <View style={styles.loading}>
              <AppSymbol name="wifiError" size={23} tintColor={colors.gold} />
              <Text style={[styles.errorTitle, { color: colors.text }]}>Could not load this page</Text>
              <Text style={[styles.errorBody, { color: colors.textMuted }]}>{error}</Text>
            </View>
          ) : null}
          {segments.map((segment) => (
            <View key={`${segment.chapter.number}:${segment.startAyah}`}>
              {segment.startAyah === 1 ? (
                <View style={styles.surahOpening}>
                  <View style={[styles.ornamentRule, { backgroundColor: colors.gold }]} />
                  <Text accessibilityLanguage="ar" style={[styles.surahName, { color: colors.text }]}>
                    {segment.chapter.arabicName}
                  </Text>
                  <Text style={[styles.surahNameLatin, { color: colors.textMuted }]}>{segment.chapter.englishName}</Text>
                  {segment.chapter.number !== 1 && segment.chapter.number !== 9 ? (
                    <Text accessibilityLanguage="ar" style={[styles.basmala, { color: colors.text }]}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</Text>
                  ) : null}
                </View>
              ) : null}
              <Text
                accessibilityLanguage="ar"
                style={[
                  styles.mushafText,
                  { color: colors.text, fontSize: 29 * fontScale, lineHeight: 52 * fontScale },
                ]}
              >
                {segment.ayahs.map((ayah) => {
                  const active = selected?.surah === segment.chapter.number && selected.ayah === ayah.number;
                  return (
                    <Text
                      key={`${segment.chapter.number}:${ayah.number}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Select Surah ${segment.chapter.englishName}, Ayah ${ayah.number}`}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setSelected({ surah: segment.chapter.number, ayah: ayah.number });
                        recordPosition(segment.chapter.number, ayah.number);
                      }}
                      style={active ? { backgroundColor: colors.primarySoft, color: colors.primaryStrong } : undefined}
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
            accessibilityLabel="Previous Mushaf page"
            accessibilityState={{ disabled: pageNumber === 1 }}
            onPress={() => openPage(pageNumber - 1)}
            style={[styles.pageNavButton, { opacity: pageNumber === 1 ? 0.25 : 1 }]}
          >
            <AppSymbol name="back" size={17} tintColor={colors.text} />
            <Text style={[styles.pageNavText, { color: colors.text }]}>Previous</Text>
          </Pressable>
          <Pressable
            disabled={pageNumber === 604}
            accessibilityRole="button"
            accessibilityLabel="Next Mushaf page"
            accessibilityState={{ disabled: pageNumber === 604 }}
            onPress={() => openPage(pageNumber + 1)}
            style={[styles.pageNavButton, { opacity: pageNumber === 604 ? 0.25 : 1 }]}
          >
            <Text style={[styles.pageNavText, { color: colors.text }]}>Next</Text>
            <AppSymbol name="forward" size={17} tintColor={colors.text} />
          </Pressable>
        </View>
      </ScrollView>

      {selected && selectedTarget ? (
        <GlassSurface interactive strength="regular" style={styles.selectionBar}>
          <View style={styles.selectionIdentity}>
            <Text style={[styles.selectionTitle, { color: colors.text }]}>Ayah {selected.surah}:{selected.ayah}</Text>
            <Text style={[styles.selectionHint, { color: colors.textMuted }]}>Selected</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selectedSaved ? 'Remove Ayah bookmark' : 'Bookmark selected Ayah'}
            onPress={() => toggleBookmark(selectedTarget)}
            style={styles.selectionAction}
          >
            <AppSymbol name={selectedSaved ? 'bookmarkFilled' : 'bookmark'} size={18} tintColor={selectedSaved ? colors.gold : colors.primary} />
            <Text style={[styles.selectionActionText, { color: colors.text }]}>{selectedSaved ? 'Saved' : 'Bookmark'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Play from Ayah ${selected.ayah}`}
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
            <Text style={[styles.selectionActionText, { color: colors.text }]}>Play</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add Ayah ${selected.ayah} to queue`}
            onPress={() => {
              enqueueRange(selected.surah, selected.ayah, selected.ayah);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
            style={styles.selectionAction}
          >
            <AppSymbol name="queue" size={18} tintColor={colors.primary} />
            <Text style={[styles.selectionActionText, { color: colors.text }]}>Queue</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add Ayah ${selected.ayah} to playlist`}
            onPress={() => router.push({
              pathname: '/add-to-playlist',
              params: { surah: String(selected.surah), start: String(selected.ayah), end: String(selected.ayah) },
            })}
            style={styles.selectionAction}
          >
            <AppSymbol name="more" size={15} tintColor={colors.primary} />
            <Text style={[styles.selectionActionText, { color: colors.text }]}>Playlist</Text>
          </Pressable>
          <IconButton name="close" label="Clear Ayah selection" onPress={() => setSelected(undefined)} />
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
  navTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  navMeta: { marginTop: 1, fontSize: 10, lineHeight: 14 },
  scrollContent: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 12, paddingBottom: 150 },
  page: { minHeight: 680, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, paddingHorizontal: 20, paddingVertical: 22 },
  loading: { minHeight: 540, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 12 },
  surahOpening: { alignItems: 'center', paddingTop: 6, paddingBottom: 10 },
  ornamentRule: { width: 36, height: 1, marginBottom: 8 },
  surahName: { fontFamily: 'AmiriQuran_400Regular', fontSize: 27, lineHeight: 38, writingDirection: 'rtl' },
  surahNameLatin: { fontSize: 10, lineHeight: 14, fontWeight: '600' },
  basmala: { marginTop: 9, fontFamily: 'AmiriQuran_400Regular', fontSize: 23, lineHeight: 40, textAlign: 'center', writingDirection: 'rtl' },
  mushafText: { fontFamily: 'AmiriQuran_400Regular', textAlign: 'justify', writingDirection: 'rtl' },
  pageFooter: { marginTop: 18, textAlign: 'center', fontSize: 11, fontVariant: ['tabular-nums'] },
  pageNavigation: { height: 58, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageNavButton: { minWidth: 100, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pageNavText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  selectionBar: { position: 'absolute', left: 12, right: 12, bottom: 12, minHeight: 72, borderRadius: 24, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  selectionIdentity: { width: 55 },
  selectionTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  selectionHint: { fontSize: 10, lineHeight: 14 },
  selectionAction: { minWidth: 48, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  selectionActionText: { marginTop: 2, fontSize: 9, lineHeight: 12, fontWeight: '600' },
  errorTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  errorBody: { maxWidth: 320, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  errorAction: { marginTop: 12, fontSize: 14, fontWeight: '600' },
});
