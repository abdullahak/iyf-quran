import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import { playWithUnavailableFeedback } from '@/audio/playbackFeedback';
import { AppSymbol } from '@/components/AppSymbol';
import { IconButton } from '@/components/IconButton';
import { chapterByNumber } from '@/data/chapters';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius } from '@/theme/tokens';

export default function PlaylistScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const colors = useAppPalette();
  const router = useRouter();
  const audio = useQuranAudio();
  const { playlists, replaceQueue } = usePlaybackLibrary();
  const playlist = playlists.find((candidate) => candidate.id === id);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!playlist) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Playlist not found</Text>
        <Pressable onPress={close}><Text style={[styles.errorAction, { color: colors.primary }]}>Return Home</Text></Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.navigation}>
        <IconButton name="back" label="Close playlist" onPress={close} />
        <Text style={[styles.navTitle, { color: colors.text }]} numberOfLines={1}>{playlist.name}</Text>
        <View style={styles.navigationEnd} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}>
            <AppSymbol name="queue" size={28} tintColor={colors.primary} />
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{playlist.name}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {playlist.items.length === 1 ? '1 Quran range' : `${playlist.items.length} Quran ranges`}
          </Text>
          <Pressable
            disabled={playlist.items.length === 0}
            accessibilityRole="button"
            accessibilityLabel={`Play playlist ${playlist.name}`}
            accessibilityState={{ disabled: playlist.items.length === 0 }}
            onPress={async () => {
              const started = await playWithUnavailableFeedback(
                () => audio.playQueue(playlist.items),
              );
              if (started) router.push('/player');
            }}
            style={[styles.playButton, { backgroundColor: colors.primary, opacity: playlist.items.length > 0 ? 1 : 0.35 }]}
          >
            <AppSymbol name="play" size={18} tintColor={colors.onPrimary} weight="bold" />
            <Text style={[styles.queueButtonText, { color: colors.onPrimary }]}>Play playlist</Text>
          </Pressable>
          <Pressable
            disabled={playlist.items.length === 0}
            accessibilityRole="button"
            accessibilityLabel={`Use ${playlist.name} as the playback queue`}
            accessibilityState={{ disabled: playlist.items.length === 0 }}
            onPress={() => {
              replaceQueue(playlist.items.map((entry, index) => ({ ...entry, id: `queue:${playlist.id}:${index}` })));
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
            style={[styles.queueButton, { borderColor: colors.border }]}
          >
            <AppSymbol name="queue" size={18} tintColor={colors.primary} />
            <Text style={[styles.queueButtonText, { color: colors.text }]}>Use as queue</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Items</Text>
        {playlist.items.length > 0 ? playlist.items.map((item, index) => {
          const chapter = chapterByNumber(item.surah)!;
          const wholeSurah = item.startAyah === 1 && item.endAyah === chapter.ayahCount;
          return (
            <View key={item.id}>
              <View style={styles.itemRow}>
                <Text style={[styles.itemIndex, { color: colors.textFaint }]}>{index + 1}</Text>
                <View style={styles.itemCopy}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{chapter.englishName}</Text>
                  <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                    {wholeSurah ? `Surah ${chapter.number}` : `Ayahs ${item.startAyah}–${item.endAyah}`}
                  </Text>
                </View>
                <Text accessibilityLanguage="ar" style={[styles.itemArabic, { color: colors.text }]}>{chapter.arabicName.replace(/^سُورَةُ\s*/, '')}</Text>
              </View>
              {index < playlist.items.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
            </View>
          );
        }) : (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>This playlist is empty</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Add a Surah or selected Ayah from Read.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  navigation: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 15, lineHeight: 20, fontWeight: '600' },
  navigationEnd: { width: 44 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 80 },
  hero: { alignItems: 'center', paddingTop: 24 },
  heroIcon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 14, fontSize: 25, lineHeight: 31, fontWeight: '600', letterSpacing: -0.4 },
  meta: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  playButton: { minWidth: 170, height: 48, marginTop: 18, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  queueButton: { minWidth: 170, height: 44, marginTop: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  queueButtonText: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  sectionTitle: { marginTop: 34, marginBottom: 7, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  itemRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7 },
  itemIndex: { width: 28, fontSize: 11, fontVariant: ['tabular-nums'] },
  itemCopy: { flex: 1 },
  itemTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  itemMeta: { marginTop: 2, fontSize: 11, lineHeight: 15 },
  itemArabic: { maxWidth: 128, fontFamily: 'AmiriQuran_400Regular', fontSize: 23, lineHeight: 34, writingDirection: 'rtl' },
  divider: { height: StyleSheet.hairlineWidth, marginStart: 35 },
  empty: { paddingVertical: 70, alignItems: 'center' },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  emptyBody: { marginTop: 4, fontSize: 12, lineHeight: 18 },
  errorTitle: { fontSize: 18, fontWeight: '600' },
  errorAction: { marginTop: 12, fontSize: 14, fontWeight: '600' },
});
