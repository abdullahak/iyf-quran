import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppSymbol } from '@/components/AppSymbol';
import type { Chapter } from '@/data/chapters';
import { useAppPalette } from '@/theme/useAppPalette';

type Props = {
  chapter: Chapter;
  onPress?: () => void;
  playing?: boolean;
  action?: 'open' | 'play';
};

export function ChapterRow({ chapter, onPress, playing = false, action = 'open' }: Props) {
  const colors = useAppPalette();
  const router = useRouter();
  const handlePress =
    onPress ??
    (() => router.push({ pathname: '/surah/[id]', params: { id: String(chapter.number) } }));

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        handlePress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${playing ? 'Pause' : action === 'play' ? 'Play' : 'Open'} Surah ${chapter.englishName}, ${chapter.ayahCount} ayahs`}
      accessibilityState={{ selected: playing }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.primarySoft : 'transparent',
          borderStartColor: playing ? colors.primary : 'transparent',
        },
      ]}
    >
      <Text style={[styles.numberText, { color: colors.textFaint }]}>
        {String(chapter.number).padStart(2, '0')}
      </Text>
      <View style={styles.english}>
        <Text style={[styles.title, { color: colors.text }]}>{chapter.englishName}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {chapter.meaning} · {chapter.ayahCount} ayahs
        </Text>
      </View>
      <Text
        accessibilityLanguage="ar"
        style={[styles.arabic, { color: colors.text }]}
      >
        {chapter.arabicName.replace(/^سُورَةُ\s*/, '')}
      </Text>
      {onPress ? (
        <View style={styles.play}>
          <AppSymbol
            name={playing ? 'pause' : 'play'}
            tintColor={playing ? colors.primary : colors.textMuted}
            size={16}
            weight="semibold"
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    borderStartWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 12,
  },
  numberText: {
    width: 28,
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  english: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '600', letterSpacing: -0.15 },
  meta: { marginTop: 3, fontSize: 12, fontWeight: '400' },
  arabic: {
    maxWidth: 132,
    flexShrink: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 25,
    lineHeight: 38,
  },
  play: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
