import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { listenEntriesForPage, listenEntryForJuzSegment } from '@/audio/listenBrowse';
import { useOfflineAudio } from '@/audio/OfflineAudioProvider';
import {
  canStartOfflineDownload,
  offlineAudioAction,
  offlineDownloadsAvailable,
} from '@/audio/offlineAudio';
import type { PlaybackQueueEntry } from '@/audio/playbackLibrary';
import { recitationTrack, reciterById } from '@/audio/reciter';
import { Atmosphere } from '@/components/Atmosphere';
import { AppSymbol } from '@/components/AppSymbol';
import { ChapterRow } from '@/components/ChapterRow';
import { IconButton } from '@/components/IconButton';
import { QuranBrowseModeControl, type QuranBrowseMode } from '@/components/QuranBrowseModeControl';
import { QuranSearchField } from '@/components/QuranSearchField';
import { CHAPTERS, type Chapter } from '@/data/chapters';
import { JUZ_SECTIONS, type JuzSection, type JuzSurahSegment } from '@/data/juz';
import { medinaPage } from '@/data/pages';
import { readingRouteForPosition } from '@/reader/readingRoute';
import { useAppSettings } from '@/settings/AppSettingsProvider';
import { useI18n } from '@/i18n/useI18n';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius } from '@/theme/tokens';
import { normalizeQuranSearch } from '@/utils/quranSearch';

export default function QuranScreen() {
  const colors = useAppPalette();
  const { isRTL, language, number: localizedNumber, t, tCount } = useI18n();
  const router = useRouter();
  const audio = useQuranAudio();
  const { settings } = useAppSettings();
  const selectedReciter = reciterById(settings.reciterId)!;
  const { cancelDownload, downloadSurahs, errors, progress, records, removeDownload } = useOfflineAudio();
  const [query, setQuery] = useState('');
  const [browseMode, setBrowseMode] = useState<QuranBrowseMode>('surah');
  const [selectedJuz, setSelectedJuz] = useState<number>();
  const [pageInput, setPageInput] = useState('1');
  const [queueError, setQueueError] = useState<string>();
  const [selectedDownloads, setSelectedDownloads] = useState<Set<number>>(new Set());
  const [batchDownloading, setBatchDownloading] = useState(false);
  const chapters = useMemo(() => {
    const normalized = normalizeQuranSearch(query);
    if (!normalized) return [...CHAPTERS];
    return CHAPTERS.filter((chapter) =>
      normalizeQuranSearch(
        `${chapter.number} ${chapter.englishName} ${chapter.arabicName}`,
      ).includes(normalized),
    );
  }, [query]);
  const selectedJuzSection = selectedJuz ? JUZ_SECTIONS[selectedJuz - 1] : undefined;
  const requestedPage = Number(pageInput);
  const pageValid = Boolean(medinaPage(requestedPage));
  const downloadsAvailable = offlineDownloadsAvailable(Platform.OS, selectedReciter.supportsOffline);
  const selectedDownloadNumbers = Array.from(selectedDownloads).sort((left, right) => left - right);
  const selectedDownloadBytes = selectedDownloadNumbers.reduce(
    (total, surah) => total + recitationTrack({ number: surah }).bytes,
    0,
  );
  const canDownloadSelection = canStartOfflineDownload(
    selectedDownloadNumbers.length,
    batchDownloading,
  );

  const openPosition = (surah: number, ayah: number) => {
    const route = readingRouteForPosition(settings.readerMode, surah, ayah);
    if (route) router.push(route);
  };

  const selectMode = (mode: QuranBrowseMode) => {
    setBrowseMode(mode);
    setSelectedJuz(undefined);
    setQuery('');
    setQueueError(undefined);
  };

  const playSelection = async (entries: readonly PlaybackQueueEntry[]) => {
    setQueueError(undefined);
    try {
      const started = await audio.playQueue(entries, 0);
      if (!started) setQueueError(t('listen.queueUnavailable'));
    } catch {
      setQueueError(t('listen.queueUnavailable'));
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <Atmosphere />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{t('tabs.quran')}</Text>
          <IconButton name="bookmark" label={t('read.openBookmarks')} onPress={() => router.push('/bookmarks')} />
        </View>
        <QuranBrowseModeControl mode={browseMode} onChange={selectMode} />
        {browseMode === 'surah' ? (
          <QuranSearchField value={query} onChangeText={setQuery} />
        ) : null}
        {browseMode === 'surah' && downloadsAvailable ? (
          <View style={[styles.downloadPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.downloadCopy}>
              <Text style={[styles.downloadTitle, { color: colors.text }]} numberOfLines={1}>
                {selectedReciter.name}
              </Text>
              <Text style={[styles.downloadMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {t('listen.offlineTitle')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.manageDownloads')}
              onPress={() => router.push('/downloads')}
              style={styles.manageDownloads}
            >
              <AppSymbol name="downloaded" size={17} tintColor={colors.primary} />
            </Pressable>
            <Pressable
              disabled={!canDownloadSelection}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canDownloadSelection }}
              onPress={() => {
                const queued = selectedDownloadNumbers;
                setBatchDownloading(true);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                void downloadSurahs(queued).finally(() => {
                  setBatchDownloading(false);
                  setSelectedDownloads(new Set());
                });
              }}
              style={[
                styles.downloadSelected,
                {
                  backgroundColor: canDownloadSelection ? colors.primary : colors.surfaceMuted,
                },
              ]}
            >
              <Text style={[styles.downloadSelectedText, { color: canDownloadSelection ? colors.onPrimary : colors.textFaint }]}>
                {batchDownloading
                  ? t('listen.downloadingSelection')
                  : selectedDownloadNumbers.length
                    ? t('listen.downloadSelection', {
                        count: localizedNumber(selectedDownloadNumbers.length),
                        size: localizedNumber(Math.round(selectedDownloadBytes / 1_000_000)),
                      })
                    : t('listen.selectSurahs')}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {queueError ? (
          <Text
            accessibilityLiveRegion="assertive"
            style={[styles.queueError, { color: colors.danger, borderColor: colors.danger }]}
          >
            {queueError}
          </Text>
        ) : null}
      </View>

      {browseMode === 'surah' ? (
        <FlatList<Chapter>
          data={chapters}
          keyExtractor={(chapter) => String(chapter.number)}
          renderItem={({ item }) => {
            const downloaded = records[item.number];
            const downloadProgress = progress[item.number];
            const downloadAction = offlineAudioAction(Boolean(downloaded), downloadProgress);
            const isSelected = selectedDownloads.has(item.number);
            return (
              <ChapterRow
                chapter={item}
                onPress={() => openPosition(item.number, 1)}
                subtitle={errors[item.number]
                  ? errors[item.number]
                  : downloaded
                    ? t('listen.downloaded', { count: localizedNumber(item.ayahCount) })
                    : downloadProgress !== undefined
                      ? t('listen.downloading', { percent: localizedNumber(Math.round(downloadProgress * 100)) })
                      : undefined}
                trailing={(
                  <View style={styles.rowActions}>
                    {downloadsAvailable ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={downloadAction === 'cancel'
                          ? t('downloads.cancelLabel', { surah: language === 'ar' ? item.arabicName.replace(/^سُورَةُ\s*/, '') : item.englishName })
                          : downloadAction === 'remove'
                            ? t('downloads.removeLabel', { surah: language === 'ar' ? item.arabicName.replace(/^سُورَةُ\s*/, '') : item.englishName })
                            : isSelected
                              ? t('listen.removeSelection', { surah: language === 'ar' ? item.arabicName.replace(/^سُورَةُ\s*/, '') : item.englishName })
                              : t('listen.selectDownload', { surah: language === 'ar' ? item.arabicName.replace(/^سُورَةُ\s*/, '') : item.englishName })}
                        accessibilityState={{ selected: isSelected || Boolean(downloaded) }}
                        onPress={(event) => {
                          event.stopPropagation();
                          void Haptics.selectionAsync();
                          if (downloadAction === 'cancel') {
                            void cancelDownload(item.number);
                          } else if (downloadAction === 'remove') {
                            void removeDownload(item.number);
                          } else {
                            setSelectedDownloads((current) => {
                              const next = new Set(current);
                              if (next.has(item.number)) next.delete(item.number);
                              else next.add(item.number);
                              return next;
                            });
                          }
                        }}
                        style={styles.rowAction}
                      >
                        <AppSymbol
                          name={downloadAction === 'cancel'
                            ? 'close'
                            : downloadAction === 'remove'
                              ? 'trash'
                              : isSelected ? 'downloaded' : 'download'}
                          size={17}
                          tintColor={downloadAction === 'cancel' || downloadAction === 'remove'
                            ? colors.danger
                            : isSelected ? colors.primary : colors.textMuted}
                        />
                      </Pressable>
                    ) : null}
                    <Pressable
                      testID={`play-surah-${item.number}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('read.playSurah', { surah: language === 'ar' ? item.arabicName.replace(/^سُورَةُ\s*/, '') : item.englishName })}
                      onPress={(event) => {
                        event.stopPropagation();
                        void audio.playChapter(item);
                      }}
                      style={styles.rowAction}
                    >
                      <AppSymbol name="play" size={15} tintColor={colors.primary} />
                    </Pressable>
                  </View>
                )}
              />
            );
          }}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<Text style={[styles.listMeta, { color: colors.textMuted }]}>{query.trim() ? tCount(chapters.length, 'read.oneResult', 'read.results') : t('read.count', { count: localizedNumber(114) })}</Text>}
          ListEmptyComponent={
            <View style={styles.empty}>
              <AppSymbol name="search" size={28} tintColor={colors.textFaint} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('read.noSurah')}</Text>
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{t('read.tryAnother')}</Text>
            </View>
          }
        />
      ) : browseMode === 'juz' && !selectedJuzSection ? (
        <FlatList<JuzSection>
          data={[...JUZ_SECTIONS]}
          keyExtractor={(section) => String(section.juz)}
          renderItem={({ item }) => (
            <JuzRow section={item} onPress={() => setSelectedJuz(item.juz)} />
          )}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<Text style={[styles.listMeta, { color: colors.textMuted }]}>{t('read.canonicalJuz')}</Text>}
        />
      ) : browseMode === 'juz' && selectedJuzSection ? (
        <FlatList<JuzSurahSegment>
          data={[...selectedJuzSection.segments]}
          keyExtractor={(segment) => segment.key}
          renderItem={({ item }) => (
            <ChapterRow
              chapter={item.chapter}
              startAyah={item.startAyah}
              onPress={() => openPosition(item.chapter.number, item.startAyah)}
              subtitle={item.startAyah === 1 && item.endAyah === item.chapter.ayahCount
                ? t('common.ayahs', { count: localizedNumber(item.chapter.ayahCount) })
                : t('common.ayahRange', { start: localizedNumber(item.startAyah), end: localizedNumber(item.endAyah) })}
              trailing={(
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('read.playSurah', {
                    surah: language === 'ar'
                      ? item.chapter.arabicName.replace(/^سُورَةُ\s*/, '')
                      : item.chapter.englishName,
                  })}
                  onPress={(event) => {
                    event.stopPropagation();
                    if (selectedJuzSection) {
                      void playSelection([listenEntryForJuzSegment(selectedJuzSection.juz, item)]);
                    }
                  }}
                  style={styles.rowPlay}
                >
                  <AppSymbol name="play" size={15} tintColor={colors.primary} />
                </Pressable>
              )}
            />
          )}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Pressable accessibilityRole="button" onPress={() => setSelectedJuz(undefined)} style={styles.juzBack}>
              <AppSymbol name={isRTL ? 'forward' : 'back'} size={14} tintColor={colors.primary} />
              <View>
                <Text style={[styles.juzBackTitle, { color: colors.text }]}>{t('common.juz', { number: localizedNumber(selectedJuzSection.juz) })}</Text>
                <Text style={[styles.juzBackMeta, { color: colors.textMuted }]}>{t('read.allJuz')}</Text>
              </View>
            </Pressable>
          }
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageJumpContent}>
          <View style={[styles.pageJump, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.pageJumpTitle, { color: colors.text }]}>{t('read.openPageTitle')}</Text>
            <Text style={[styles.pageJumpBody, { color: colors.textMuted }]}>{t('read.pageBody')}</Text>
            <View style={styles.pageJumpControls}>
              <TextInput
                value={pageInput}
                onChangeText={setPageInput}
                keyboardType="number-pad"
                returnKeyType="go"
                accessibilityLabel={t('read.pageInput')}
                onSubmitEditing={() => {
                  if (pageValid) router.push({ pathname: '/mushaf/[page]', params: { page: String(requestedPage) } });
                }}
                style={[styles.pageInput, { color: colors.text, borderColor: pageValid ? colors.border : colors.danger }]}
              />
              <View style={styles.pageJumpActions}>
                <Pressable
                  disabled={!pageValid}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !pageValid }}
                  onPress={() => router.push({ pathname: '/mushaf/[page]', params: { page: String(requestedPage) } })}
                  style={[styles.openPageButton, { backgroundColor: colors.surfaceMuted, opacity: pageValid ? 1 : 0.35 }]}
                >
                  <Text style={[styles.openPageText, { color: colors.text }]}>{t('read.openPage')}</Text>
                </Pressable>
                <Pressable
                  disabled={!pageValid}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !pageValid }}
                  onPress={() => void playSelection(listenEntriesForPage(requestedPage))}
                  style={[styles.openPageButton, styles.playPageButton, { backgroundColor: colors.primary, opacity: pageValid ? 1 : 0.35 }]}
                >
                  <AppSymbol name="play" size={15} tintColor={colors.onPrimary} />
                  <Text style={[styles.openPageText, { color: colors.onPrimary }]}>{t('listen.playPage')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function JuzRow({ section, onPress }: { section: JuzSection; onPress: () => void }) {
  const colors = useAppPalette();
  const { isRTL, number: localizedNumber, t } = useI18n();
  const uniqueSurahs = new Set(section.segments.map((segment) => segment.chapter.number)).size;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('read.openJuz', { juz: localizedNumber(section.juz), count: localizedNumber(uniqueSurahs) })}
      onPress={onPress}
      style={({ pressed }) => [styles.juzRow, { backgroundColor: pressed ? colors.primarySoft : 'transparent' }]}
    >
      <View style={[styles.juzNumber, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.juzNumberText, { color: colors.primary }]}>{localizedNumber(section.juz)}</Text>
      </View>
      <View style={styles.juzCopy}>
        <Text style={[styles.juzTitle, { color: colors.text }]}>{t('common.juz', { number: localizedNumber(section.juz) })}</Text>
        <Text style={[styles.juzMeta, { color: colors.textMuted }]}>{t('read.juzMeta', { count: localizedNumber(uniqueSurahs), first: `${localizedNumber(section.first[0])}:${localizedNumber(section.first[1])}`, last: `${localizedNumber(section.last[0])}:${localizedNumber(section.last[1])}` })}</Text>
      </View>
      <AppSymbol name={isRTL ? 'back' : 'forward'} size={15} tintColor={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 34, lineHeight: 41, fontWeight: '600', letterSpacing: -1.1 },
  downloadPanel: { minHeight: 62, marginTop: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingStart: 12, paddingEnd: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  downloadCopy: { flex: 1, minWidth: 0 },
  downloadTitle: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  downloadMeta: { fontSize: 10, lineHeight: 14 },
  manageDownloads: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  downloadSelected: { minWidth: 96, minHeight: 40, borderRadius: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  downloadSelectedText: { fontSize: 10, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  queueError: { marginTop: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, lineHeight: 18 },

  listContent: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 154 },
  listMeta: { paddingHorizontal: 4, paddingVertical: 10, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  separator: { height: StyleSheet.hairlineWidth, marginStart: 56, marginEnd: 10 },
  rowActions: { flexDirection: 'row', alignItems: 'center' },
  rowAction: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowPlay: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  juzRow: { minHeight: 72, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
  juzNumber: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  juzNumberText: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  juzCopy: { flex: 1, marginStart: 13 },
  juzTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  juzMeta: { marginTop: 2, fontSize: 11, lineHeight: 16 },
  juzBack: { minHeight: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 12 },
  juzBackTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  juzBackMeta: { fontSize: 11, lineHeight: 15 },
  pageJumpContent: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 154 },
  pageJump: { marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, padding: 20 },
  pageJumpTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  pageJumpBody: { marginTop: 5, fontSize: 13, lineHeight: 19 },
  pageJumpControls: { marginTop: 18, gap: 10 },
  pageJumpActions: { flexDirection: 'row', gap: 10 },
  pageInput: { width: '100%', height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingHorizontal: 14, fontSize: 17, fontVariant: ['tabular-nums'] },
  openPageButton: { flex: 1, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  playPageButton: { flexDirection: 'row', gap: 7 },
  openPageText: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  empty: { paddingVertical: 78, alignItems: 'center' },
  emptyTitle: { marginTop: 14, fontSize: 17, fontWeight: '600' },
  emptyBody: { marginTop: 5, fontSize: 13 },
});