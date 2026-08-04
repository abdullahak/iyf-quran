import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere } from '@/components/Atmosphere';
import { AppSymbol } from '@/components/AppSymbol';
import { ChapterRow } from '@/components/ChapterRow';
import { IconButton } from '@/components/IconButton';
import { CHAPTERS } from '@/data/chapters';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius } from '@/theme/tokens';
import { normalizeQuranSearch } from '@/utils/quranSearch';

export default function QuranScreen() {
  const colors = useAppPalette();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const chapters = useMemo(() => {
    const normalized = normalizeQuranSearch(query);
    if (!normalized) return CHAPTERS;
    return CHAPTERS.filter((chapter) =>
      normalizeQuranSearch(
        `${chapter.number} ${chapter.englishName} ${chapter.meaning} ${chapter.arabicName}`,
      ).includes(normalized),
    );
  }, [query]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <Atmosphere />
      <FlatList
        data={chapters}
        keyExtractor={(chapter) => String(chapter.number)}
        renderItem={({ item }) => <ChapterRow chapter={item} />}
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
              <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Quran</Text>
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
                placeholder="Search by surah, meaning, or number"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Search surahs"
                clearButtonMode="while-editing"
                returnKeyType="search"
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>
            <View style={styles.listMeta}>
              <Text style={[styles.resultCount, { color: colors.textMuted }]}>
                {chapters.length === 114 ? '114 surahs' : `${chapters.length} results`}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppSymbol name="search" size={28} tintColor={colors.textFaint} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No surah found</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Try a name, meaning, or chapter number.</Text>
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
  separator: { height: StyleSheet.hairlineWidth, marginStart: 56, marginEnd: 10 },
  empty: { paddingVertical: 78, alignItems: 'center' },
  emptyTitle: { marginTop: 14, fontSize: 17, fontWeight: '600' },
  emptyBody: { marginTop: 5, fontSize: 13 },
});