import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { makeAyahTarget, makeSurahTarget } from '@/bookmarks/bookmarks';
import { useBookmarks } from '@/bookmarks/BookmarksProvider';
import { Atmosphere } from '@/components/Atmosphere';
import { AppSymbol } from '@/components/AppSymbol';
import { IconButton } from '@/components/IconButton';
import { AL_FATIHA_FALLBACK, type QuranChapter } from '@/data/alFatiha';
import { chapterByNumber } from '@/data/chapters';
import { loadChapter } from '@/services/quran';
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
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const scrollRef = useRef<ScrollView>(null);
  const ayahListOffset = useRef<number | undefined>(undefined);
  const ayahOffsets = useRef(new Map<number, number>());
  const didScrollTo = useRef<string | undefined>(undefined);

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
  }, [number]);

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
          {audio.chapter?.number === number ? (
            <View style={styles.navigationSpacer} />
          ) : (
            <IconButton
              name="play"
              label="Play recitation"
              onPress={() => audio.playChapter(metadata)}
            />
          )}
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
            <Text style={[styles.surahMeaning, { color: colors.textMuted }]}>
              {metadata.meaning} · {metadata.ayahCount} ayahs
            </Text>
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
            style={styles.ayahList}
          >
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
                    ayahOffsets.current.set(ayah.number, event.nativeEvent.layout.y);
                    if (targeted) scrollToBookmarkedAyah();
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
                        backgroundColor: colors.goldSoft,
                        borderStartColor: colors.gold,
                      },
                    ]}
                  >
                    <View style={styles.ayahTopline}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          bookmarked
                            ? `Remove bookmark for Ayah ${ayah.number}`
                            : `Bookmark Ayah ${ayah.number}`
                        }
                        accessibilityState={{ selected: bookmarked }}
                        hitSlop={8}
                        onPress={() => {
                          void Haptics.notificationAsync(
                            bookmarked
                              ? Haptics.NotificationFeedbackType.Warning
                              : Haptics.NotificationFeedbackType.Success,
                          );
                          toggleBookmark(ayahTarget);
                        }}
                        style={[
                          styles.ayahNumber,
                          {
                            borderColor: colors.gold,
                            backgroundColor: bookmarked ? colors.goldSoft : 'transparent',
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
                      </Pressable>
                      <View style={styles.ayahMetaGroup}>
                        {audio.hasVerifiedTimings ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Play from Ayah ${ayah.number}`}
                            hitSlop={8}
                            onPress={() => {
                              void Haptics.selectionAsync();
                              void audio.seekToAyah(ayah.number);
                            }}
                            style={styles.ayahAudioButton}
                          >
                            <AppSymbol
                              name="waveform"
                              size={14}
                              tintColor={active ? colors.gold : colors.textFaint}
                            />
                          </Pressable>
                        ) : null}
                        {startsBoundary ? (
                          <Text style={[styles.ayahMeta, { color: colors.textFaint }]}>Juz {ayah.juz} · Page {ayah.page}</Text>
                        ) : null}
                      </View>
                    </View>
                    <Text
                      accessibilityLanguage="ar"
                      style={[styles.ayahArabic, { color: colors.text }]}
                    >
                      {ayah.arabic}
                    </Text>
                    <Text style={[styles.translation, { color: colors.textMuted }]}>{ayah.translation}</Text>
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
              Uthmani Arabic · {chapter.translationName}
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
  navigationSpacer: { width: 44, height: 44 },
  navTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  navMeta: { fontSize: 10, marginTop: 2 },
  scrollContent: { paddingBottom: 54 },
  scrollContentWithPlayer: { paddingBottom: 132 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18 },
  surahHeader: { alignItems: 'center', paddingTop: 20, paddingBottom: 24 },
  surahNumber: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  surahArabic: {
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 40,
    lineHeight: 60,
    writingDirection: 'rtl',
    marginTop: 10,
  },
  surahEnglish: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  surahMeaning: { fontSize: 13, lineHeight: 18, marginTop: 4 },
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
  ayahList: { paddingBottom: 10 },
  ayah: {
    borderStartWidth: 2,
    borderStartColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 28,
  },
  ayahTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ayahNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayahNumberText: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  ayahMetaGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ayahAudioButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  ayahMeta: { fontSize: 10, fontWeight: '500' },
  ayahArabic: {
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 34,
    lineHeight: 64,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 15,
  },
  translation: { fontSize: 17, lineHeight: 26, marginTop: 16 },
  ayahDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 8 },
  attribution: { textAlign: 'center', fontSize: 10, marginTop: 24, marginBottom: 18 },
});