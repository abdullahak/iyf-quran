import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import { AppSymbol } from '@/components/AppSymbol';
import { IconButton } from '@/components/IconButton';
import { chapterByNumber } from '@/data/chapters';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius } from '@/theme/tokens';

export default function AddToPlaylistScreen() {
  const params = useLocalSearchParams<{
    surah: string | string[];
    start?: string | string[];
    end?: string | string[];
  }>();
  const surah = Number(Array.isArray(params.surah) ? params.surah[0] : params.surah);
  const startAyah = Number(Array.isArray(params.start) ? params.start[0] : params.start) || 1;
  const chapter = chapterByNumber(surah);
  const endAyah = Number(Array.isArray(params.end) ? params.end[0] : params.end) || chapter?.ayahCount || 1;
  const colors = useAppPalette();
  const router = useRouter();
  const { addRangeToPlaylist, createPlaylistWithRange, playlists } = usePlaybackLibrary();
  const [name, setName] = useState('');
  const close = () => (router.canDismiss() ? router.dismiss() : router.canGoBack() ? router.back() : router.replace('/'));

  const add = (playlistId: string) => {
    addRangeToPlaylist(playlistId, surah, startAyah, endAyah);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  const createAndAdd = () => {
    if (!name.trim()) return;
    createPlaylistWithRange(name, surah, startAyah, endAyah);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.navigation}>
        <IconButton name="close" label="Close" onPress={close} />
        <Text accessibilityRole="header" style={[styles.navTitle, { color: colors.text }]}>Add to Playlist</Text>
        <View style={styles.navigationEnd} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {chapter ? (
          <View style={styles.selection}>
            <Text style={[styles.selectionTitle, { color: colors.text }]}>{chapter.englishName}</Text>
            <Text style={[styles.selectionMeta, { color: colors.textMuted }]}>
              {startAyah === 1 && endAyah === chapter.ayahCount ? `Surah ${surah}` : startAyah === endAyah ? `Ayah ${startAyah}` : `Ayahs ${startAyah}–${endAyah}`}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Choose a playlist</Text>
        {playlists.map((playlist, index) => (
          <View key={playlist.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add to ${playlist.name}`}
              onPress={() => add(playlist.id)}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.primarySoft : 'transparent' }]}
            >
              <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                <AppSymbol name="queue" size={17} tintColor={colors.primary} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{playlist.name}</Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{playlist.items.length === 1 ? '1 item' : `${playlist.items.length} items`}</Text>
              </View>
              <AppSymbol name="add" size={17} tintColor={colors.primary} />
            </Pressable>
            {index < playlists.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>New playlist</Text>
        <View style={styles.createRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            accessibilityLabel="New playlist name"
            placeholder="Playlist name"
            placeholderTextColor={colors.textFaint}
            returnKeyType="done"
            onSubmitEditing={createAndAdd}
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          />
          <Pressable
            disabled={!name.trim()}
            accessibilityRole="button"
            accessibilityLabel="Create playlist and add selection"
            accessibilityState={{ disabled: !name.trim() }}
            onPress={createAndAdd}
            style={[styles.createButton, { backgroundColor: colors.primary, opacity: name.trim() ? 1 : 0.35 }]}
          >
            <AppSymbol name="add" size={18} tintColor={colors.onPrimary} weight="bold" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navigation: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 21, fontWeight: '600' },
  navigationEnd: { width: 44 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 70 },
  selection: { paddingTop: 18, paddingBottom: 6 },
  selectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  selectionMeta: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  sectionTitle: { marginTop: 28, marginBottom: 7, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  row: { minHeight: 68, borderRadius: 12, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, marginStart: 12 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowMeta: { marginTop: 2, fontSize: 11, lineHeight: 15 },
  divider: { height: StyleSheet.hairlineWidth, marginStart: 58 },
  createRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, paddingHorizontal: 14, fontSize: 15 },
  createButton: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
