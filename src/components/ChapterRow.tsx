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
  startAyah?: number;
  subtitle?: string;
  trailing?: React.ReactNode;
};

export function ChapterRow({
  action = 'open',
  chapter,
  onPress,
  playing = false,
  startAyah,
  subtitle,
  trailing,
}: Props) {
  const colors = useAppPalette();
  const router = useRouter();
  const handlePress =
    onPress ??
    (() => router.push({
      pathname: '/surah/[id]',
      params: {
        id: String(chapter.number),
        ...(startAyah ? { ayah: String(startAyah) } : {}),
      },
    }));

  return (
    <View style={styles.shell}>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          handlePress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${playing ? 'Pause' : action === 'play' ? 'Play' : 'Open'} Surah ${chapter.englishName}, ${chapter.ayahCount} ayahs${subtitle ? `, ${subtitle}` : ''}`}
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
          {subtitle ?? `Surah ${chapter.number} · ${chapter.ayahCount} ayahs`}
        </Text>
      </View>
      <Text
        accessibilityLanguage="ar"
        style={[styles.arabic, { color: colors.text }]}
      >
        {chapter.arabicName.replace(/^سُورَةُ\s*/, '')}
      </Text>
      {action === 'play' ? (
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
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flexDirection: 'row', alignItems: 'center' },
  row: {
    flex: 1,
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
