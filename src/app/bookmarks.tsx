import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookmarkPicker } from '@/bookmarks/BookmarkPicker';
import type { QuranBookmark } from '@/bookmarks/bookmarks';
import { useBookmarks } from '@/bookmarks/BookmarksProvider';
import { AppSymbol } from '@/components/AppSymbol';
import { Atmosphere } from '@/components/Atmosphere';
import { IconButton } from '@/components/IconButton';
import { chapterByNumber } from '@/data/chapters';
import { radius } from '@/theme/tokens';
import { useAppPalette } from '@/theme/useAppPalette';

export default function BookmarksScreen() {
  const colors = useAppPalette();
  const router = useRouter();
  const { bookmarks, ready, removeBookmark } = useBookmarks();
  const [pickerOpen, setPickerOpen] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const openBookmark = (bookmark: QuranBookmark) => {
    const id = String(bookmark.target.surah);
    void Haptics.selectionAsync();
    if (bookmark.target.kind === 'ayah') {
      router.replace({ pathname: '/surah/[id]', params: { id, ayah: String(bookmark.target.ayah) } });
    } else {
      router.replace({ pathname: '/surah/[id]', params: { id } });
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Atmosphere />
      <View style={styles.navigation}>
        <IconButton name="close" label="Close bookmarks" onPress={close} />
        <View style={styles.navigationTitle}>
          <Text style={[styles.navTitle, { color: colors.text }]}>Bookmarks</Text>
          <Text style={[styles.navMeta, { color: colors.textMuted }]}>
            {bookmarks.length === 1 ? '1 saved place' : `${bookmarks.length} saved places`}
          </Text>
        </View>
        <IconButton name="add" label="Add bookmark" onPress={() => setPickerOpen(true)} />
      </View>

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loading, { color: colors.textMuted }]}>Loading bookmarks…</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.listContent, bookmarks.length === 0 && styles.emptyContent]}
          data={bookmarks}
          keyExtractor={(bookmark) => bookmark.target.key}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
                <AppSymbol name="bookmark" size={26} tintColor={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No bookmarks yet</Text>
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Save a whole surah or a specific ayah so you can return to it directly.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPickerOpen(true)}
                style={({ pressed }) => [
                  styles.emptyAction,
                  { backgroundColor: pressed ? colors.primaryStrong : colors.primary },
                ]}
              >
                <AppSymbol name="add" size={18} tintColor={colors.onPrimary} />
                <Text style={[styles.emptyActionText, { color: colors.onPrimary }]}>Add a bookmark</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const chapter = chapterByNumber(item.target.surah);
            if (!chapter) return null;
            const description =
              item.target.kind === 'ayah'
                ? `Ayah ${item.target.ayah} · ${item.target.key}`
                : `Whole surah · ${chapter.ayahCount} ayahs`;
            return (
              <View style={styles.bookmarkRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${chapter.englishName}, ${description}`}
                  onPress={() => openBookmark(item)}
                  style={({ pressed }) => [
                    styles.bookmarkMain,
                    { backgroundColor: pressed ? colors.primarySoft : 'transparent' },
                  ]}
                >
                  <View style={[styles.marker, { borderColor: colors.gold }]}>
                    <Text style={[styles.markerText, { color: colors.gold }]}>
                      {item.target.kind === 'ayah' ? item.target.ayah : chapter.number}
                    </Text>
                  </View>
                  <View style={styles.bookmarkCopy}>
                    <View style={styles.titleLine}>
                      <Text style={[styles.bookmarkTitle, { color: colors.text }]}>{chapter.englishName}</Text>
                      <Text
                        accessibilityLanguage="ar"
                        style={[styles.bookmarkArabic, { color: colors.text }]}
                      >
                        {chapter.arabicName.replace(/^سُورَةُ\s*/, '')}
                      </Text>
                    </View>
                    <Text style={[styles.bookmarkMeta, { color: colors.textMuted }]}>{description}</Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove bookmark for ${chapter.englishName}${item.target.kind === 'ayah' ? ` Ayah ${item.target.ayah}` : ''}`}
                  hitSlop={8}
                  onPress={() => {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    removeBookmark(item.target.key);
                  }}
                  style={({ pressed }) => [
                    styles.removeButton,
                    { backgroundColor: pressed ? colors.primarySoft : 'transparent' },
                  ]}
                >
                  <AppSymbol name="bookmarkFilled" size={18} tintColor={colors.primary} />
                </Pressable>
              </View>
            );
          }}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BookmarkPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navigation: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    minHeight: 66,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navigationTitle: { flex: 1, alignItems: 'center' },
  navTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  navMeta: { marginTop: 2, fontSize: 10, lineHeight: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loading: { fontSize: 13, lineHeight: 18 },
  listContent: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 128 },
  emptyContent: { flexGrow: 1 },
  empty: { flex: 1, minHeight: 420, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 20, fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.3 },
  emptyBody: { maxWidth: 360, marginTop: 8, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  emptyAction: {
    minHeight: 46,
    marginTop: 24,
    paddingHorizontal: 18,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyActionText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  bookmarkRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center' },
  bookmarkMain: {
    flex: 1,
    minHeight: 78,
    paddingHorizontal: 8,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: { fontSize: 11, lineHeight: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  bookmarkCopy: { flex: 1, marginStart: 14 },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  bookmarkTitle: { flexShrink: 1, fontSize: 16, lineHeight: 21, fontWeight: '600' },
  bookmarkArabic: {
    flexShrink: 1,
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 23,
    lineHeight: 34,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  bookmarkMeta: { marginTop: 2, fontSize: 12, lineHeight: 17 },
  removeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth, marginStart: 54 },
});
