import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { listenEntriesForPage, listenEntryForJuzSegment } from '@/audio/listenBrowse';
import { useOfflineAudio } from '@/audio/OfflineAudioProvider';
import type { PlaybackQueueEntry } from '@/audio/playbackLibrary';
import {
  canStartOfflineDownload,
  offlineAudioAction,
  offlineDownloadsAvailable,
} from '@/audio/offlineAudio';
import { isRecitationSelectionActive, recitationTrack, reciterById } from '@/audio/reciter';
import { Atmosphere } from '@/components/Atmosphere';
import { AppSymbol } from '@/components/AppSymbol';
import { ChapterRow } from '@/components/ChapterRow';
import { QuranBrowseModeControl, type QuranBrowseMode } from '@/components/QuranBrowseModeControl';
import { QuranSearchField } from '@/components/QuranSearchField';
import { CHAPTERS } from '@/data/chapters';
import { JUZ_SECTIONS, type JuzSection } from '@/data/juz';
import { medinaPage } from '@/data/pages';
import { useAppSettings } from '@/settings/AppSettingsProvider';
import { useI18n } from '@/i18n/useI18n';
import { useAppPalette } from '@/theme/useAppPalette';
import { normalizeQuranSearch } from '@/utils/quranSearch';

export default function ListenScreen() {
  const colors = useAppPalette();
  const { isRTL, language, number: localizedNumber, t } = useI18n();
  const { settings } = useAppSettings();
  const selectedReciter = reciterById(settings.reciterId)!;
  const audio = useQuranAudio();
  const { chapter: activeChapter, reciter: activeReciter, status, playChapter, toggle } = audio;
  const { cancelDownload, downloadSurahs, errors, progress, records, removeDownload } = useOfflineAudio();
  const [browseMode, setBrowseMode] = useState<QuranBrowseMode>('surah');
  const [query, setQuery] = useState('');
  const [selectedJuz, setSelectedJuz] = useState<number>();
  const [pageInput, setPageInput] = useState('1');
  const [queueError, setQueueError] = useState<string>();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchDownloading, setBatchDownloading] = useState(false);
  const downloadsAvailable = offlineDownloadsAvailable(Platform.OS, selectedReciter.supportsOffline);
  const alFatihaActive = isRecitationSelectionActive(
    activeChapter?.number,
    activeReciter.id,
    1,
    selectedReciter.id,
  );
  const alFatihaPlaying = alFatihaActive && status.playing;
  const selectedNumbers = Array.from(selected).sort((a, b) => a - b);
  const selectedBytes = selectedNumbers.reduce(
    (total, surah) => total + recitationTrack({ number: surah }).bytes,
    0,
  );
  const canStartSelection = canStartOfflineDownload(selectedNumbers.length, batchDownloading);
  const selectedJuzSection = selectedJuz ? JUZ_SECTIONS[selectedJuz - 1] : undefined;
  const requestedPage = Number(pageInput);
  const pageValid = Boolean(medinaPage(requestedPage));
  const chapters = useMemo(() => {
    const normalized = normalizeQuranSearch(query);
    if (!normalized) return [...CHAPTERS];
    return CHAPTERS.filter((chapter) =>
      normalizeQuranSearch(
        `${chapter.number} ${chapter.englishName} ${chapter.arabicName}`,
      ).includes(normalized),
    );
  }, [query]);

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

  const toggleAlFatiha = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (alFatihaActive) toggle();
    else playChapter(CHAPTERS[0]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <Atmosphere />
      <FlatList
        data={browseMode === 'surah' ? chapters : []}
        keyExtractor={(chapter) => String(chapter.number)}
        renderItem={({ item }) => {
          const active = isRecitationSelectionActive(
            activeChapter?.number,
            activeReciter.id,
            item.number,
            selectedReciter.id,
          );
          const playing = active && status.playing;
          const downloaded = records[item.number];
          const downloadProgress = progress[item.number];
          const downloading = !downloaded && downloadProgress !== undefined;
          const downloadAction = offlineAudioAction(Boolean(downloaded), downloadProgress);
          const isSelected = selected.has(item.number);
          return (
            <ChapterRow
              chapter={item}
              action="play"
              playing={playing}
              subtitle={downloadsAvailable && errors[item.number]
                ? errors[item.number]
                : downloadsAvailable && downloaded
                  ? t('listen.downloaded', { count: localizedNumber(item.ayahCount) })
                  : downloadsAvailable && downloading
                    ? t('listen.downloading', { percent: localizedNumber(Math.round((downloadProgress ?? 0) * 100)) })
                    : t('listen.surahMeta', { number: localizedNumber(item.number), count: localizedNumber(item.ayahCount) })}
              onPress={() => {
                if (active) toggle();
                else playChapter(item);
              }}
              trailing={downloadsAvailable ? (
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
                  hitSlop={6}
                  onPress={(event) => {
                    event.stopPropagation();
                    void Haptics.selectionAsync();
                    if (downloadAction === 'cancel') {
                      void cancelDownload(item.number);
                      return;
                    }
                    if (downloadAction === 'remove') {
                      void removeDownload(item.number);
                      return;
                    }
                    setSelected((current) => {
                      const next = new Set(current);
                      if (next.has(item.number)) next.delete(item.number);
                      else next.add(item.number);
                      return next;
                    });
                  }}
                  style={({ pressed }) => [styles.downloadAction, { opacity: pressed ? 0.55 : 1 }]}
                >
                  <AppSymbol
                    name={downloadAction === 'cancel' ? 'close' : downloadAction === 'remove' ? 'trash' : isSelected ? 'downloaded' : 'download'}
                    size={19}
                    tintColor={downloadAction === 'cancel' || downloadAction === 'remove' ? colors.danger : isSelected ? colors.primary : colors.textMuted}
                  />
                </Pressable>
              ) : undefined}
            />
          );
        }}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{t('listen.title')}</Text>
            <QuranBrowseModeControl mode={browseMode} onChange={selectMode} />
            {browseMode === 'surah' ? (
              <QuranSearchField value={query} onChangeText={setQuery} />
            ) : null}

            <View style={[styles.reciterIdentity, { borderBottomColor: colors.border }]}>
              <View style={styles.reciterCopy}>
                <Text
                  accessibilityLanguage="ar"
                  style={[styles.reciterArabic, { color: colors.text }]}
                >
                  {selectedReciter.arabicName}
                </Text>
                <Text style={[styles.reciterName, { color: colors.text }]}>{selectedReciter.name}</Text>
                <Text style={[styles.reciterMeta, { color: colors.textMuted }]}>{t('listen.reciterMeta')}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={alFatihaPlaying ? t('listen.pauseFatiha') : t('listen.playFatiha')}
                accessibilityState={{ selected: alFatihaPlaying }}
                onPress={toggleAlFatiha}
                style={({ pressed }) => [
                  styles.reciterControl,
                  {
                    backgroundColor: colors.primarySoft,
                    opacity: pressed ? 0.62 : 1,
                  },
                ]}
              >
                <AppSymbol
                  name={alFatihaPlaying ? 'pause' : 'play'}
                  size={19}
                  tintColor={colors.primary}
                  weight="semibold"
                />
              </Pressable>
            </View>

            {queueError ? (
              <Text
                accessibilityLiveRegion="assertive"
                style={[styles.queueError, { color: colors.danger, borderColor: colors.danger }]}
              >
                {queueError}
              </Text>
            ) : null}

            {browseMode === 'surah' && downloadsAvailable ? (
              <View style={[styles.downloadPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.downloadCopy}>
                  <Text style={[styles.downloadTitle, { color: colors.text }]}>{t('listen.offlineTitle')}</Text>
                  <Text style={[styles.downloadMeta, { color: colors.textMuted }]}>{t('listen.offlineBody')}</Text>
                </View>
                <Pressable
                  disabled={!canStartSelection}
                  onPress={() => {
                    const queued = selectedNumbers;
                    setBatchDownloading(true);
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    void downloadSurahs(queued).finally(() => {
                      setBatchDownloading(false);
                      setSelected(new Set());
                    });
                  }}
                  style={({ pressed }) => [
                    styles.downloadSelected,
                    {
                      backgroundColor: canStartSelection ? colors.primary : colors.surfaceMuted,
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <AppSymbol name="download" size={16} tintColor={canStartSelection ? colors.onPrimary : colors.textFaint} />
                  <Text style={[styles.downloadSelectedText, { color: canStartSelection ? colors.onPrimary : colors.textFaint }]}>
                    {batchDownloading
                      ? t('listen.downloadingSelection')
                      : selectedNumbers.length
                        ? t('listen.downloadSelection', { count: localizedNumber(selectedNumbers.length), size: localizedNumber(Math.round(selectedBytes / 1_000_000)) })
                        : t('listen.selectSurahs')}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {browseMode === 'surah' ? (
              <Text accessibilityRole="header" style={[styles.listTitle, { color: colors.text }]}>{t('common.surahs')}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={browseMode === 'surah' ? (
          <View style={styles.empty}>
            <AppSymbol name="search" size={28} tintColor={colors.textFaint} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('read.noSurah')}</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{t('read.tryAnother')}</Text>
          </View>
        ) : browseMode === 'juz' ? (
          <View style={styles.modeContent}>
            {!selectedJuzSection ? (
              <>
                <Text style={[styles.modeMeta, { color: colors.textMuted }]}>{t('read.canonicalJuz')}</Text>
                {JUZ_SECTIONS.map((section) => (
                  <JuzListenRow key={section.juz} section={section} onPress={() => setSelectedJuz(section.juz)} />
                ))}
              </>
            ) : (
              <>
                <Pressable accessibilityRole="button" onPress={() => setSelectedJuz(undefined)} style={styles.juzBack}>
                  <AppSymbol name={isRTL ? 'forward' : 'back'} size={14} tintColor={colors.primary} />
                  <View>
                    <Text style={[styles.juzBackTitle, { color: colors.text }]}>{t('common.juz', { number: localizedNumber(selectedJuzSection.juz) })}</Text>
                    <Text style={[styles.juzBackMeta, { color: colors.textMuted }]}>{t('read.allJuz')}</Text>
                  </View>
                </Pressable>
                {selectedJuzSection.segments.map((segment) => (
                  <View key={segment.key}>
                    <ChapterRow
                      action="play"
                      chapter={segment.chapter}
                      startAyah={segment.startAyah}
                      subtitle={segment.startAyah === 1 && segment.endAyah === segment.chapter.ayahCount
                        ? t('common.wholeSurah', { count: localizedNumber(segment.chapter.ayahCount) })
                        : t('common.ayahRange', { start: localizedNumber(segment.startAyah), end: localizedNumber(segment.endAyah) })}
                      onPress={() => void playSelection([listenEntryForJuzSegment(selectedJuzSection.juz, segment)])}
                    />
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  </View>
                ))}
              </>
            )}
          </View>
        ) : browseMode === 'page' ? (
          <View style={styles.modeContent}>
            <View style={[styles.pageJump, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.pageJumpTitle, { color: colors.text }]}>{t('listen.pageTitle')}</Text>
              <Text style={[styles.pageJumpBody, { color: colors.textMuted }]}>{t('read.pageBody')}</Text>
              <View style={styles.pageJumpControls}>
                <TextInput
                  value={pageInput}
                  onChangeText={setPageInput}
                  keyboardType="number-pad"
                  returnKeyType="go"
                  accessibilityLabel={t('read.pageInput')}
                  onSubmitEditing={() => {
                    if (pageValid) void playSelection(listenEntriesForPage(requestedPage));
                  }}
                  style={[styles.pageInput, { color: colors.text, borderColor: pageValid ? colors.border : colors.danger }]}
                />
                <Pressable
                  disabled={!pageValid}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !pageValid }}
                  onPress={() => void playSelection(listenEntriesForPage(requestedPage))}
                  style={[styles.playPageButton, { backgroundColor: colors.primary, opacity: pageValid ? 1 : 0.35 }]}
                >
                  <AppSymbol name="play" size={16} tintColor={colors.onPrimary} />
                  <Text style={[styles.playPageText, { color: colors.onPrimary }]}>{t('listen.playPage')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

function JuzListenRow({ section, onPress }: { section: JuzSection; onPress: () => void }) {
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
        <Text style={[styles.juzMeta, { color: colors.textMuted }]}>
          {t('read.juzMeta', { count: localizedNumber(uniqueSurahs), first: `${localizedNumber(section.first[0])}:${localizedNumber(section.first[1])}`, last: `${localizedNumber(section.last[0])}:${localizedNumber(section.last[1])}` })}
        </Text>
      </View>
      <AppSymbol name={isRTL ? 'back' : 'forward'} size={15} tintColor={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingBottom: 154,
  },
  header: { paddingTop: 18 },
  title: { fontSize: 34, lineHeight: 41, fontWeight: '600', letterSpacing: -1.1 },
  reciterIdentity: {
    minHeight: 132,
    marginTop: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    paddingBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reciterCopy: { flex: 1, minWidth: 0 },
  reciterArabic: {
    fontSize: 27,
    lineHeight: 39,
    writingDirection: 'rtl',
    alignSelf: 'flex-start',
  },
  reciterName: { marginTop: 5, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  reciterMeta: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  queueError: {
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 19,
  },
  reciterControl: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginStart: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadPanel: {
    marginTop: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  downloadCopy: { gap: 4 },
  downloadTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  downloadMeta: { fontSize: 12, lineHeight: 18 },
  downloadSelected: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  downloadSelectedText: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  downloadAction: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  listTitle: {
    marginTop: 28,
    marginBottom: 8,
    paddingHorizontal: 4,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  modeContent: { paddingTop: 10, paddingBottom: 40 },
  modeMeta: { paddingHorizontal: 4, paddingVertical: 10, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  juzRow: { minHeight: 72, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
  juzNumber: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  juzNumberText: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  juzCopy: { flex: 1, marginStart: 13 },
  juzTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  juzMeta: { marginTop: 2, fontSize: 11, lineHeight: 16 },
  juzBack: { minHeight: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 12 },
  juzBackTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  juzBackMeta: { fontSize: 11, lineHeight: 15 },
  pageJump: { marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, padding: 20 },
  pageJumpTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  pageJumpBody: { marginTop: 5, fontSize: 13, lineHeight: 19 },
  pageJumpControls: { marginTop: 18, flexDirection: 'row', gap: 10 },
  pageInput: { width: 92, height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingHorizontal: 14, fontSize: 17, fontVariant: ['tabular-nums'] },
  playPageButton: { flex: 1, height: 48, borderRadius: 13, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  playPageText: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  separator: { height: StyleSheet.hairlineWidth, marginStart: 56, marginEnd: 10 },
  empty: { paddingVertical: 78, alignItems: 'center' },
  emptyTitle: { marginTop: 14, fontSize: 17, fontWeight: '600' },
  emptyBody: { marginTop: 5, fontSize: 13 },
});