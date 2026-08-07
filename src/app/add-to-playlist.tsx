import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import { createQueueEntry } from '@/audio/playbackLibrary';
import { AppSymbol } from '@/components/AppSymbol';
import { IconButton } from '@/components/IconButton';
import { chapterByNumber } from '@/data/chapters';
import { useI18n } from '@/i18n/useI18n';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius } from '@/theme/tokens';

type SelectionParams = {
  surah: string | string[];
  start?: string | string[];
  end?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function canonicalPositiveInteger(
  value: string | string[] | undefined,
  fallback?: number,
) {
  const raw = firstParam(value);
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) return undefined;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function validSelection(params: SelectionParams) {
  const surah = canonicalPositiveInteger(params.surah);
  if (surah === undefined) return undefined;
  const chapter = chapterByNumber(surah);
  if (!chapter) return undefined;
  const startAyah = canonicalPositiveInteger(params.start, 1);
  const endAyah = canonicalPositiveInteger(params.end, chapter.ayahCount);
  if (startAyah === undefined || endAyah === undefined) return undefined;
  try {
    const entry = createQueueEntry(surah, startAyah, endAyah, 'add-to-playlist-route');
    return { chapter, ...entry };
  } catch {
    return undefined;
  }
}

export default function AddToPlaylistScreen() {
  const params = useLocalSearchParams<SelectionParams>();
  const selection = validSelection(params);
  const colors = useAppPalette();
  const { language, number: localizedNumber, t } = useI18n();
  const router = useRouter();
  const { addRangeToPlaylist, createPlaylistWithRange, playlists } = usePlaybackLibrary();
  const [name, setName] = useState('');
  const close = () => (router.canDismiss() ? router.dismiss() : router.canGoBack() ? router.back() : router.replace('/'));

  if (!selection) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.navigation}>
          <IconButton name="close" label={t('common.close')} onPress={close} />
          <Text accessibilityRole="header" style={[styles.navTitle, { color: colors.text }]}>{t('playlist.addTitle')}</Text>
          <View style={styles.navigationEnd} />
        </View>
        <View style={styles.invalidSelection}>
          <AppSymbol name="wifiError" size={24} tintColor={colors.gold} />
          <Text style={[styles.invalidSelectionText, { color: colors.text }]}>{t('playlist.invalidSelection')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const add = (playlistId: string) => {
    addRangeToPlaylist(
      playlistId,
      selection.surah,
      selection.startAyah,
      selection.endAyah,
    );
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  const createAndAdd = () => {
    if (!name.trim()) return;
    createPlaylistWithRange(
      name,
      selection.surah,
      selection.startAyah,
      selection.endAyah,
    );
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.navigation}>
        <IconButton name="close" label={t('common.close')} onPress={close} />
        <Text accessibilityRole="header" style={[styles.navTitle, { color: colors.text }]}>{t('playlist.addTitle')}</Text>
        <View style={styles.navigationEnd} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.selection}>
          <Text style={[styles.selectionTitle, { color: colors.text }]}>{language === 'ar' ? selection.chapter.arabicName.replace(/^سُورَةُ\s*/, '') : selection.chapter.englishName}</Text>
          <Text style={[styles.selectionMeta, { color: colors.textMuted }]}>
            {selection.startAyah === 1 && selection.endAyah === selection.chapter.ayahCount ? t('common.surahNumber', { number: localizedNumber(selection.surah) }) : selection.startAyah === selection.endAyah ? t('common.ayah', { number: localizedNumber(selection.startAyah) }) : t('common.ayahRange', { start: localizedNumber(selection.startAyah), end: localizedNumber(selection.endAyah) })}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('playlist.choose')}</Text>
        {playlists.map((playlist, index) => (
          <View key={playlist.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('playlist.addTo', { name: playlist.name })}
              onPress={() => add(playlist.id)}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.primarySoft : 'transparent' }]}
            >
              <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                <AppSymbol name="queue" size={17} tintColor={colors.primary} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{playlist.name}</Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{playlist.items.length === 1 ? t('common.oneItem') : t('common.items', { count: localizedNumber(playlist.items.length) })}</Text>
              </View>
              <AppSymbol name="add" size={17} tintColor={colors.primary} />
            </Pressable>
            {index < playlists.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('playlist.new')}</Text>
        <View style={styles.createRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            accessibilityLabel={t('playlist.newName')}
            placeholder={t('playlists.name')}
            placeholderTextColor={colors.textFaint}
            returnKeyType="done"
            onSubmitEditing={createAndAdd}
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          />
          <Pressable
            disabled={!name.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('playlist.createAdd')}
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
  invalidSelection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  invalidSelectionText: { maxWidth: 300, fontSize: 15, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
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
