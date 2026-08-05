import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { useOfflineAudio } from '@/audio/OfflineAudioProvider';
import { MUHAMMAD_AL_FAQIH, recitationTrack } from '@/audio/reciter';
import { Atmosphere } from '@/components/Atmosphere';
import { AppSymbol } from '@/components/AppSymbol';
import { ChapterRow } from '@/components/ChapterRow';
import { CHAPTERS } from '@/data/chapters';
import { useAppPalette } from '@/theme/useAppPalette';

export default function ListenScreen() {
  const colors = useAppPalette();
  const { chapter: activeChapter, status, playChapter, toggle } = useQuranAudio();
  const { downloadSurahs, errors, progress, records, removeDownload } = useOfflineAudio();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const downloadsAvailable = Platform.OS !== 'web';
  const alFatihaPlaying = activeChapter?.number === 1 && status.playing;
  const selectedNumbers = Array.from(selected).sort((a, b) => a - b);
  const selectedBytes = selectedNumbers.reduce(
    (total, surah) => total + recitationTrack({ number: surah }).bytes,
    0,
  );

  const toggleAlFatiha = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeChapter?.number === 1) toggle();
    else playChapter(CHAPTERS[0]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <Atmosphere />
      <FlatList
        data={CHAPTERS}
        keyExtractor={(chapter) => String(chapter.number)}
        renderItem={({ item }) => {
          const playing = activeChapter?.number === item.number && status.playing;
          const downloaded = records[item.number];
          const downloadProgress = progress[item.number];
          const downloading = !downloaded && downloadProgress !== undefined;
          const isSelected = selected.has(item.number);
          return (
            <ChapterRow
              chapter={item}
              action="play"
              playing={playing}
              subtitle={downloadsAvailable && errors[item.number]
                ? errors[item.number]
                : downloadsAvailable && downloaded
                  ? `Downloaded · ${item.ayahCount} ayahs`
                  : downloadsAvailable && downloading
                    ? `Downloading ${Math.round((downloadProgress ?? 0) * 100)}%`
                    : `Surah ${item.number} · ${item.ayahCount} ayahs`}
              onPress={() => {
                if (activeChapter?.number === item.number) toggle();
                else playChapter(item);
              }}
              trailing={downloadsAvailable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={downloaded
                    ? `Remove downloaded Surah ${item.englishName}`
                    : isSelected
                      ? `Remove Surah ${item.englishName} from download selection`
                      : `Select Surah ${item.englishName} to download`}
                  accessibilityState={{ selected: isSelected || Boolean(downloaded), disabled: downloading }}
                  disabled={downloading}
                  hitSlop={6}
                  onPress={(event) => {
                    event.stopPropagation();
                    void Haptics.selectionAsync();
                    if (downloaded) {
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
                  style={({ pressed }) => [styles.downloadAction, { opacity: downloading ? 0.45 : pressed ? 0.55 : 1 }]}
                >
                  <AppSymbol
                    name={downloaded ? 'trash' : isSelected ? 'downloaded' : 'download'}
                    size={19}
                    tintColor={downloaded ? colors.danger : isSelected ? colors.primary : colors.textMuted}
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Listen</Text>

            <View style={[styles.reciterIdentity, { borderBottomColor: colors.border }]}>
              <View style={styles.reciterCopy}>
                <Text
                  accessibilityLanguage="ar"
                  style={[styles.reciterArabic, { color: colors.text }]}
                >
                  مُحَمَّد ٱلْفَقِيه
                </Text>
                <Text style={[styles.reciterName, { color: colors.text }]}>{MUHAMMAD_AL_FAQIH.name}</Text>
                <Text style={[styles.reciterMeta, { color: colors.textMuted }]}>Hafs ‘an ‘Asim · 114 surahs</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={alFatihaPlaying ? 'Pause Al-Faatiha' : 'Play Al-Faatiha'}
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

            {downloadsAvailable ? (
              <View style={[styles.downloadPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.downloadCopy}>
                  <Text style={[styles.downloadTitle, { color: colors.text }]}>Offline listening</Text>
                  <Text style={[styles.downloadMeta, { color: colors.textMuted }]}>Select individual Surahs. Each download is verified for offline use; iOS may remove it when storage is low.</Text>
                </View>
                <Pressable
                  disabled={selectedNumbers.length === 0}
                  onPress={() => {
                    const queued = selectedNumbers;
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    void downloadSurahs(queued).then(() => setSelected(new Set()));
                  }}
                  style={({ pressed }) => [
                    styles.downloadSelected,
                    {
                      backgroundColor: selectedNumbers.length ? colors.primary : colors.surfaceMuted,
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <AppSymbol name="download" size={16} tintColor={selectedNumbers.length ? colors.onPrimary : colors.textFaint} />
                  <Text style={[styles.downloadSelectedText, { color: selectedNumbers.length ? colors.onPrimary : colors.textFaint }]}>
                    {selectedNumbers.length
                      ? `Download ${selectedNumbers.length} · ${(selectedBytes / 1_000_000).toFixed(0)} MB`
                      : 'Select Surahs'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Text accessibilityRole="header" style={[styles.listTitle, { color: colors.text }]}>Surahs</Text>
          </View>
        }
      />
    </SafeAreaView>
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
  separator: { height: StyleSheet.hairlineWidth, marginStart: 56, marginEnd: 10 },
});