import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBookmarks } from '@/bookmarks/BookmarksProvider';
import { Atmosphere } from '@/components/Atmosphere';
import { AppSymbol } from '@/components/AppSymbol';
import { AL_FATIHA_FALLBACK } from '@/data/alFatiha';
import { CHAPTERS } from '@/data/chapters';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius, shadow } from '@/theme/tokens';

export default function HomeScreen() {
  const colors = useAppPalette();
  const router = useRouter();
  const { bookmarks } = useBookmarks();
  const alFatiha = CHAPTERS[0];

  const openReader = () => {
    void Haptics.selectionAsync();
    router.push({ pathname: '/surah/[id]', params: { id: '1' } });
  };

  const openLibrary = () => {
    void Haptics.selectionAsync();
    router.push('/(tabs)/quran');
  };

  const openBookmarks = () => {
    void Haptics.selectionAsync();
    router.push('/bookmarks');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <Atmosphere />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>IYF Quran</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Begin reading Surah Al-Faatiha"
            onPress={openReader}
            style={({ pressed }) => [
              styles.continuePanel,
              shadow.subtle,
              {
                backgroundColor: pressed ? colors.primarySoft : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.continueLabel, { color: colors.textMuted }]}>Begin reading</Text>
            <Text
              accessibilityLanguage="ar"
              style={[styles.continueArabic, { color: colors.text }]}
            >
              {alFatiha.arabicName.replace(/^سُورَةُ\s*/, '')}
            </Text>
            <Text
              accessibilityLanguage="ar"
              numberOfLines={2}
              style={[styles.verse, { color: colors.primary }]}
            >
              {AL_FATIHA_FALLBACK.ayahs[0].arabic}
            </Text>
            <View style={styles.continueFooter}>
              <Text style={[styles.continueMeta, { color: colors.textMuted }]}>Al-Faatiha · The Opening · 7 ayahs</Text>
              <AppSymbol name="book" size={18} tintColor={colors.gold} />
            </View>
          </Pressable>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Quran Library</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse all 114 surahs"
              onPress={openLibrary}
              style={({ pressed }) => [
                styles.libraryRow,
                { backgroundColor: pressed ? colors.primarySoft : 'transparent' },
              ]}
            >
              <AppSymbol name="book" size={19} tintColor={colors.primary} />
              <View style={styles.libraryCopy}>
                <Text style={[styles.libraryTitle, { color: colors.text }]}>Browse all surahs</Text>
                <Text style={[styles.libraryMeta, { color: colors.textMuted }]}>114 chapters in canonical order</Text>
              </View>
            </Pressable>
            <View style={[styles.libraryDivider, { backgroundColor: colors.border }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Quran bookmarks"
              onPress={openBookmarks}
              style={({ pressed }) => [
                styles.libraryRow,
                { backgroundColor: pressed ? colors.primarySoft : 'transparent' },
              ]}
            >
              <AppSymbol name="bookmark" size={19} tintColor={colors.primary} />
              <View style={styles.libraryCopy}>
                <Text style={[styles.libraryTitle, { color: colors.text }]}>Bookmarks</Text>
                <Text style={[styles.libraryMeta, { color: colors.textMuted }]}>
                  {bookmarks.length === 0
                    ? 'Save a surah or ayah for later'
                    : bookmarks.length === 1
                      ? '1 saved place'
                      : `${bookmarks.length} saved places`}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 158 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20 },
  title: {
    paddingTop: 16,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '600',
    letterSpacing: -1.1,
  },
  continuePanel: {
    minHeight: 300,
    marginTop: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.panel,
    paddingHorizontal: 24,
    paddingVertical: 22,
  },
  continueLabel: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  continueArabic: {
    marginTop: 20,
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 42,
    lineHeight: 60,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  verse: {
    marginTop: 8,
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 27,
    lineHeight: 48,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  continueFooter: {
    marginTop: 'auto',
    paddingTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  continueMeta: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  section: { marginTop: 34 },
  sectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.3 },
  libraryRow: {
    minHeight: 72,
    marginTop: 10,
    borderRadius: radius.control,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  libraryCopy: { flex: 1, marginStart: 14 },
  libraryTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  libraryMeta: { marginTop: 3, fontSize: 13, lineHeight: 18 },
  libraryDivider: { height: StyleSheet.hairlineWidth, marginStart: 40 },
});