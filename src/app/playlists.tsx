import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import { AppSymbol } from '@/components/AppSymbol';
import { IconButton } from '@/components/IconButton';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius } from '@/theme/tokens';

export default function PlaylistsScreen() {
  const colors = useAppPalette();
  const router = useRouter();
  const { createPlaylist, deletePlaylist, playlists } = usePlaybackLibrary();
  const [name, setName] = useState('');
  const normalizedName = name.trim();
  const close = () => (router.canDismiss() ? router.dismiss() : router.canGoBack() ? router.back() : router.replace('/'));

  const submit = () => {
    if (!normalizedName) return;
    const playlist = createPlaylist(normalizedName);
    setName('');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.navigation}>
        <IconButton name="close" label="Close playlists" onPress={close} />
        <Text accessibilityRole="header" style={[styles.navTitle, { color: colors.text }]}>Playlists</Text>
        <View style={styles.navigationEnd} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: colors.text }]}>Create a playlist</Text>
        <Text style={[styles.intro, { color: colors.textMuted }]}>Arrange Surahs and Ayahs into a listening sequence. Add items from Read or the Mushaf.</Text>
        <View style={styles.createRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            accessibilityLabel="Playlist name"
            placeholder="Playlist name"
            placeholderTextColor={colors.textFaint}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          />
          <Pressable
            disabled={!normalizedName}
            accessibilityRole="button"
            accessibilityLabel="Create playlist"
            accessibilityState={{ disabled: !normalizedName }}
            onPress={submit}
            style={[styles.createButton, { backgroundColor: colors.primary, opacity: normalizedName ? 1 : 0.35 }]}
          >
            <AppSymbol name="add" size={18} tintColor={colors.onPrimary} weight="bold" />
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your playlists</Text>
        {playlists.length > 0 ? playlists.map((playlist, index) => (
          <View key={playlist.id}>
            <View style={styles.playlistRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open playlist ${playlist.name}`}
                onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })}
                style={({ pressed }) => [styles.playlistMain, { backgroundColor: pressed ? colors.primarySoft : 'transparent' }]}
              >
                <View style={[styles.playlistIcon, { backgroundColor: colors.primarySoft }]}>
                  <AppSymbol name="queue" size={18} tintColor={colors.primary} />
                </View>
                <View style={styles.playlistCopy}>
                  <Text style={[styles.playlistName, { color: colors.text }]}>{playlist.name}</Text>
                  <Text style={[styles.playlistMeta, { color: colors.textMuted }]}>
                    {playlist.items.length === 1 ? '1 item' : `${playlist.items.length} items`}
                  </Text>
                </View>
                <AppSymbol name="forward" size={15} tintColor={colors.textFaint} />
              </Pressable>
              <IconButton
                name="trash"
                label={`Delete playlist ${playlist.name}`}
                onPress={() => deletePlaylist(playlist.id)}
              />
            </View>
            {index < playlists.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
          </View>
        )) : (
          <View style={styles.empty}>
            <AppSymbol name="queue" size={26} tintColor={colors.textFaint} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No playlists yet</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Create one here, then add Quran ranges while reading.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navigation: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 21, fontWeight: '600' },
  navigationEnd: { width: 44 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 60 },
  heading: { marginTop: 20, fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.4 },
  intro: { marginTop: 5, maxWidth: 470, fontSize: 13, lineHeight: 19 },
  createRow: { marginTop: 18, flexDirection: 'row', gap: 10 },
  input: { flex: 1, height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, paddingHorizontal: 14, fontSize: 15 },
  createButton: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { marginTop: 32, marginBottom: 8, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  playlistRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  playlistMain: { flex: 1, minHeight: 72, borderRadius: 12, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
  playlistIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  playlistCopy: { flex: 1, marginStart: 12 },
  playlistName: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  playlistMeta: { marginTop: 2, fontSize: 12, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginStart: 58 },
  empty: { paddingVertical: 70, alignItems: 'center' },
  emptyTitle: { marginTop: 12, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  emptyBody: { marginTop: 4, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
