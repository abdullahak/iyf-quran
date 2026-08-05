import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere } from '@/components/Atmosphere';
import { AppSymbol } from '@/components/AppSymbol';
import { ChapterRow } from '@/components/ChapterRow';
import { IconButton } from '@/components/IconButton';
import { CHAPTERS } from '@/data/chapters';
import { JUZ_SECTIONS, type JuzSurahSegment } from '@/data/juz';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius } from '@/theme/tokens';
import { normalizeQuranSearch } from '@/utils/quranSearch';

export default function QuranScreen() {
  const colors = useAppPalette();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const sections = useMemo(() => {
    const normalized = normalizeQuranSearch(query);
    if (!normalized) {
      return JUZ_SECTIONS.map((section) => ({
        title: `Juz ${section.juz}`,
        range: `${section.first[0]}:${section.first[1]} – ${section.last[0]}:${section.last[1]}`,
        data: section.segments,
      }));
    }
    const matches = CHAPTERS.filter((chapter) =>
      normalizeQuranSearch(
        `${chapter.number} ${chapter.englishName} ${chapter.arabicName}`,
      ).includes(normalized),
    );
    return [{
      title: 'Search results',
      range: `${matches.length} surahs`,
      data: matches.map((chapter): JuzSurahSegment => ({
        key: `${chapter.number}:1-${chapter.ayahCount}`,
        chapter,
        startAyah: 1,
        endAyah: chapter.ayahCount,
      })),
    }];
  }, [query]);
  const resultCount = sections.reduce((total, section) => total + section.data.length, 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <Atmosphere />
      <SectionList
        sections={sections}
        keyExtractor={(segment) => `${segment.key}`}
        renderItem={({ item }) => (
          <ChapterRow
            chapter={item.chapter}
            startAyah={item.startAyah}
            subtitle={item.startAyah === 1 && item.endAyah === item.chapter.ayahCount
              ? `Surah ${item.chapter.number} · ${item.chapter.ayahCount} ayahs`
              : `Ayahs ${item.startAyah}–${item.endAyah}`}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>{section.title}</Text>
            <Text style={[styles.sectionRange, { color: colors.textFaint }]}>{section.range}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Read</Text>
              <IconButton
                name="bookmark"
                label="Open bookmarks"
                onPress={() => router.push('/bookmarks')}
              />
            </View>
            <View
              style={[
                styles.searchSurface,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <AppSymbol name="search" size={17} tintColor={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by Surah name or number"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Search surahs"
                clearButtonMode="while-editing"
                returnKeyType="search"
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>
            <View style={styles.listMeta}>
              <Text style={[styles.resultCount, { color: colors.textMuted }]}>
                {query.trim() ? `${resultCount} results` : '30 Juz · 114 Surahs'}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppSymbol name="search" size={28} tintColor={colors.textFaint} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No surah found</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Try a Surah name or chapter number.</Text>
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
  header: { paddingTop: 18, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 34, lineHeight: 41, fontWeight: '600', letterSpacing: -1.1 },
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
  listMeta: {
    marginTop: 18,
    marginBottom: 6,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  resultCount: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  sectionHeader: {
    minHeight: 44,
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800', letterSpacing: 0.4 },
  sectionRange: { fontSize: 10, lineHeight: 14, fontVariant: ['tabular-nums'] },
  separator: { height: StyleSheet.hairlineWidth, marginStart: 56, marginEnd: 10 },
  empty: { paddingVertical: 78, alignItems: 'center' },
  emptyTitle: { marginTop: 14, fontSize: 17, fontWeight: '600' },
  emptyBody: { marginTop: 5, fontSize: 13 },
});