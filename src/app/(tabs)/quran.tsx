import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { Atmosphere } from '@/components/Atmosphere';
import { AppSymbol } from '@/components/AppSymbol';
import { ChapterRow } from '@/components/ChapterRow';
import { IconButton } from '@/components/IconButton';
import { CHAPTERS, type Chapter } from '@/data/chapters';
import { JUZ_SECTIONS, type JuzSection, type JuzSurahSegment } from '@/data/juz';
import { medinaPage, medinaPageForAyah } from '@/data/pages';
import { useAppSettings } from '@/settings/AppSettingsProvider';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius } from '@/theme/tokens';
import { normalizeQuranSearch } from '@/utils/quranSearch';

type BrowseMode = 'surah' | 'juz' | 'page';

export default function QuranScreen() {
  const colors = useAppPalette();
  const router = useRouter();
  const audio = useQuranAudio();
  const { settings } = useAppSettings();
  const [query, setQuery] = useState('');
  const [browseMode, setBrowseMode] = useState<BrowseMode>('surah');
  const [selectedJuz, setSelectedJuz] = useState<number>();
  const [pageInput, setPageInput] = useState('1');
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

  const openPosition = (surah: number, ayah: number) => {
    if (settings.readerMode === 'mushaf') {
      const page = medinaPageForAyah(surah, ayah);
      if (page) router.push({ pathname: '/mushaf/[page]', params: { page: String(page.page) } });
      return;
    }
    router.push({
      pathname: '/surah/[id]',
      params: { id: String(surah), ...(ayah > 1 ? { ayah: String(ayah) } : {}) },
    });
  };

  const selectMode = (mode: BrowseMode) => {
    setBrowseMode(mode);
    setSelectedJuz(undefined);
    setQuery('');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <Atmosphere />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Read</Text>
          <IconButton name="bookmark" label="Open bookmarks" onPress={() => router.push('/bookmarks')} />
        </View>
        <View style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
          {(['surah', 'juz', 'page'] as const).map((mode) => {
            const selected = browseMode === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => selectMode(mode)}
                style={[styles.segment, selected && { backgroundColor: colors.surface }]}
              >
                <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}>
                  {mode === 'surah' ? 'Surah' : mode === 'juz' ? 'Juz' : 'Page'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {browseMode === 'surah' ? (
          <View style={[styles.searchSurface, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppSymbol name="search" size={17} tintColor={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search Surah name or number"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Search Surahs"
              clearButtonMode="while-editing"
              returnKeyType="search"
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
        ) : null}
      </View>

      {browseMode === 'surah' ? (
        <FlatList<Chapter>
          data={chapters}
          keyExtractor={(chapter) => String(chapter.number)}
          renderItem={({ item }) => (
            <ChapterRow
              chapter={item}
              onPress={() => openPosition(item.number, 1)}
              trailing={(
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Play Surah ${item.englishName}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    void audio.playChapter(item);
                  }}
                  style={styles.rowPlay}
                >
                  <AppSymbol name="play" size={15} tintColor={colors.primary} />
                </Pressable>
              )}
            />
          )}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<Text style={[styles.listMeta, { color: colors.textMuted }]}>{query.trim() ? `${chapters.length} results` : '114 Surahs'}</Text>}
          ListEmptyComponent={
            <View style={styles.empty}>
              <AppSymbol name="search" size={28} tintColor={colors.textFaint} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Surah found</Text>
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Try another name or chapter number.</Text>
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
          ListHeaderComponent={<Text style={[styles.listMeta, { color: colors.textMuted }]}>30 canonical Juz</Text>}
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
                ? `${item.chapter.ayahCount} ayahs`
                : `Ayahs ${item.startAyah}–${item.endAyah}`}
            />
          )}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Pressable accessibilityRole="button" onPress={() => setSelectedJuz(undefined)} style={styles.juzBack}>
              <AppSymbol name="back" size={14} tintColor={colors.primary} />
              <View>
                <Text style={[styles.juzBackTitle, { color: colors.text }]}>Juz {selectedJuzSection.juz}</Text>
                <Text style={[styles.juzBackMeta, { color: colors.textMuted }]}>All Juz · tap to return</Text>
              </View>
            </Pressable>
          }
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageJumpContent}>
          <View style={[styles.pageJump, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.pageJumpTitle, { color: colors.text }]}>Open a Medina page</Text>
            <Text style={[styles.pageJumpBody, { color: colors.textMuted }]}>Enter any page from the canonical 604-page Hafs layout.</Text>
            <View style={styles.pageJumpControls}>
              <TextInput
                value={pageInput}
                onChangeText={setPageInput}
                keyboardType="number-pad"
                returnKeyType="go"
                accessibilityLabel="Mushaf page number"
                onSubmitEditing={() => {
                  if (pageValid) router.push({ pathname: '/mushaf/[page]', params: { page: String(requestedPage) } });
                }}
                style={[styles.pageInput, { color: colors.text, borderColor: pageValid ? colors.border : colors.danger }]}
              />
              <Pressable
                disabled={!pageValid}
                accessibilityRole="button"
                accessibilityState={{ disabled: !pageValid }}
                onPress={() => router.push({ pathname: '/mushaf/[page]', params: { page: String(requestedPage) } })}
                style={[styles.openPageButton, { backgroundColor: colors.primary, opacity: pageValid ? 1 : 0.35 }]}
              >
                <Text style={[styles.openPageText, { color: colors.onPrimary }]}>Open page</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function JuzRow({ section, onPress }: { section: JuzSection; onPress: () => void }) {
  const colors = useAppPalette();
  const uniqueSurahs = new Set(section.segments.map((segment) => segment.chapter.number)).size;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open Juz ${section.juz}, ${uniqueSurahs} Surahs`}
      onPress={onPress}
      style={({ pressed }) => [styles.juzRow, { backgroundColor: pressed ? colors.primarySoft : 'transparent' }]}
    >
      <View style={[styles.juzNumber, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.juzNumberText, { color: colors.primary }]}>{section.juz}</Text>
      </View>
      <View style={styles.juzCopy}>
        <Text style={[styles.juzTitle, { color: colors.text }]}>Juz {section.juz}</Text>
        <Text style={[styles.juzMeta, { color: colors.textMuted }]}>{uniqueSurahs} Surahs · {section.first[0]}:{section.first[1]}–{section.last[0]}:{section.last[1]}</Text>
      </View>
      <AppSymbol name="forward" size={15} tintColor={colors.textFaint} />
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
  segmented: { height: 46, marginTop: 18, borderRadius: radius.control, padding: 4, flexDirection: 'row' },
  segment: { flex: 1, borderRadius: radius.control - 4, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  searchSurface: {
    height: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.control,
    marginTop: 20,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, height: '100%', fontSize: 15, paddingVertical: 0 },
  listContent: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 154 },
  listMeta: { paddingHorizontal: 4, paddingVertical: 10, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  separator: { height: StyleSheet.hairlineWidth, marginStart: 56, marginEnd: 10 },
  rowPlay: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
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
  pageJumpControls: { marginTop: 18, flexDirection: 'row', gap: 10 },
  pageInput: { width: 92, height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingHorizontal: 14, fontSize: 17, fontVariant: ['tabular-nums'] },
  openPageButton: { flex: 1, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  openPageText: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  empty: { paddingVertical: 78, alignItems: 'center' },
  emptyTitle: { marginTop: 14, fontSize: 17, fontWeight: '600' },
  emptyBody: { marginTop: 5, fontSize: 13 },
});