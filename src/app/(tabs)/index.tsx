import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import { useBookmarks } from '@/bookmarks/BookmarksProvider';
import { Atmosphere } from '@/components/Atmosphere';
import { AppSymbol } from '@/components/AppSymbol';
import { IconButton } from '@/components/IconButton';
import { chapterByNumber } from '@/data/chapters';
import { useReadingHistory } from '@/reader/ReadingHistoryProvider';
import { useAppSettings } from '@/settings/AppSettingsProvider';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius, shadow } from '@/theme/tokens';

export default function HomeScreen() {
  const colors = useAppPalette();
  const router = useRouter();
  const { bookmarks } = useBookmarks();
  const { playlists } = usePlaybackLibrary();
  const { recentPages } = useReadingHistory();
  const { settings } = useAppSettings();

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
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Quran</Text>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Recent pages</Text>
            {recentPages.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentRail}
              >
                {recentPages.map((recent) => {
                  const chapter = chapterByNumber(recent.surah)!;
                  return (
                    <Pressable
                      key={recent.page}
                      accessibilityRole="button"
                      accessibilityLabel={`Open page ${recent.page}, Surah ${chapter.englishName}, Ayah ${recent.ayah}`}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        if (settings.readerMode === 'mushaf') {
                          router.push({ pathname: '/mushaf/[page]', params: { page: String(recent.page) } });
                        } else {
                          router.push({
                            pathname: '/surah/[id]',
                            params: { id: String(recent.surah), ayah: String(recent.ayah) },
                          });
                        }
                      }}
                      style={({ pressed }) => [
                        styles.recentPage,
                        shadow.subtle,
                        {
                          backgroundColor: pressed ? colors.primarySoft : colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.pageNumber, { color: colors.textMuted }]}>PAGE {recent.page}</Text>
                      <Text accessibilityLanguage="ar" style={[styles.pageArabic, { color: colors.text }]}>
                        {chapter.arabicName.replace(/^سُورَةُ\s*/, '')}
                      </Text>
                      <Text style={[styles.pageTitle, { color: colors.text }]} numberOfLines={1}>{chapter.englishName}</Text>
                      <Text style={[styles.pageMeta, { color: colors.textMuted }]}>Ayah {recent.ayah}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Browse Quran to begin reading"
                onPress={openLibrary}
                style={({ pressed }) => [styles.emptyStateRow, { opacity: pressed ? 0.58 : 1 }]}
              >
                <AppSymbol name="book" size={20} tintColor={colors.primary} />
                <View style={styles.libraryCopy}>
                  <Text style={[styles.libraryTitle, { color: colors.text }]}>No recent pages yet</Text>
                  <Text style={[styles.libraryMeta, { color: colors.textMuted }]}>Pages you read will return here.</Text>
                </View>
                <AppSymbol name="forward" size={15} tintColor={colors.textFaint} />
              </Pressable>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Playlists</Text>
              <IconButton name="add" label="Create or manage playlists" onPress={() => router.push('/playlists')} />
            </View>
            {playlists.length > 0 ? playlists.map((playlist, index) => (
              <View key={playlist.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open playlist ${playlist.name}, ${playlist.items.length} items`}
                  onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })}
                  style={({ pressed }) => [styles.libraryRow, { backgroundColor: pressed ? colors.primarySoft : 'transparent' }]}
                >
                  <AppSymbol name="queue" size={19} tintColor={colors.primary} />
                  <View style={styles.libraryCopy}>
                    <Text style={[styles.libraryTitle, { color: colors.text }]}>{playlist.name}</Text>
                    <Text style={[styles.libraryMeta, { color: colors.textMuted }]}>
                      {playlist.items.length === 1 ? '1 item' : `${playlist.items.length} items`}
                    </Text>
                  </View>
                </Pressable>
                {index < playlists.length - 1 ? <View style={[styles.libraryDivider, { backgroundColor: colors.border }]} /> : null}
              </View>
            )) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create a Quran playlist"
                onPress={() => router.push('/playlists')}
                style={({ pressed }) => [styles.emptyStateRow, { opacity: pressed ? 0.58 : 1 }]}
              >
                <AppSymbol name="queue" size={20} tintColor={colors.primary} />
                <View style={styles.libraryCopy}>
                  <Text style={[styles.libraryTitle, { color: colors.text }]}>Create your first playlist</Text>
                  <Text style={[styles.libraryMeta, { color: colors.textMuted }]}>Group Surahs and Ayahs in your own order.</Text>
                </View>
                <AppSymbol name="add" size={15} tintColor={colors.textFaint} />
              </Pressable>
            )}
          </View>

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
  section: { marginTop: 30 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.3 },
  recentRail: { paddingTop: 12, paddingBottom: 4, paddingEnd: 4, gap: 12 },
  recentPage: { width: 156, minHeight: 188, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, padding: 15 },
  pageNumber: { fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 1 },
  pageArabic: { marginTop: 22, fontFamily: 'AmiriQuran_400Regular', fontSize: 30, lineHeight: 46, textAlign: 'right', writingDirection: 'rtl' },
  pageTitle: { marginTop: 'auto', fontSize: 14, lineHeight: 19, fontWeight: '600' },
  pageMeta: { marginTop: 3, fontSize: 11, lineHeight: 15 },
  emptyStateRow: { minHeight: 78, marginTop: 8, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
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