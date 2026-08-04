import * as Haptics from 'expo-haptics';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuranAudio } from '@/audio/AudioProvider';
import { MUHAMMAD_AL_FAQIH } from '@/audio/reciter';
import { Atmosphere } from '@/components/Atmosphere';
import { AppSymbol } from '@/components/AppSymbol';
import { ChapterRow } from '@/components/ChapterRow';
import { CHAPTERS } from '@/data/chapters';
import { useAppPalette } from '@/theme/useAppPalette';

export default function ListenScreen() {
  const colors = useAppPalette();
  const { chapter: activeChapter, status, playChapter, toggle } = useQuranAudio();
  const alFatihaPlaying = activeChapter?.number === 1 && status.playing;

  const toggleAlFatiha = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeChapter?.number === 1) toggle();
    else playChapter(CHAPTERS[0]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <Atmosphere />
      <FlatList
        data={CHAPTERS}
        keyExtractor={(chapter) => String(chapter.number)}
        renderItem={({ item }) => {
          const playing = activeChapter?.number === item.number && status.playing;
          return (
            <ChapterRow
              chapter={item}
              action="play"
              playing={playing}
              onPress={() => {
                if (activeChapter?.number === item.number) toggle();
                else playChapter(item);
              }}
            />
          );
        }}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Listen</Text>

            <View style={[styles.reciterIdentity, { borderBottomColor: colors.border }]}>
              <View style={styles.reciterCopy}>
                <Text
                  accessibilityLanguage="ar"
                  style={[styles.reciterArabic, { color: colors.text }]}
                >
                  مُحَمَّد ٱلْفَقِيه
                </Text>
                <Text style={[styles.reciterName, { color: colors.text }]}>{MUHAMMAD_AL_FAQIH.name}</Text>
                <Text style={[styles.reciterMeta, { color: colors.textMuted }]}>Hafs ‘an ‘Asim · 114 surahs</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={alFatihaPlaying ? 'Pause Al-Faatiha' : 'Play Al-Faatiha'}
                accessibilityState={{ selected: alFatihaPlaying }}
                onPress={toggleAlFatiha}
                style={({ pressed }) => [
                  styles.reciterControl,
                  {
                    backgroundColor: colors.primarySoft,
                    opacity: pressed ? 0.62 : 1,
                  },
                ]}
              >
                <AppSymbol
                  name={alFatihaPlaying ? 'pause' : 'play'}
                  size={19}
                  tintColor={colors.primary}
                  weight="semibold"
                />
              </Pressable>
            </View>

            <Text accessibilityRole="header" style={[styles.listTitle, { color: colors.text }]}>Surahs</Text>
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
  header: { paddingTop: 18 },
  title: { fontSize: 34, lineHeight: 41, fontWeight: '600', letterSpacing: -1.1 },
  reciterIdentity: {
    minHeight: 132,
    marginTop: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    paddingBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reciterCopy: { flex: 1, minWidth: 0 },
  reciterArabic: {
    fontSize: 27,
    lineHeight: 39,
    writingDirection: 'rtl',
    alignSelf: 'flex-start',
  },
  reciterName: { marginTop: 5, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  reciterMeta: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  reciterControl: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginStart: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: {
    marginTop: 28,
    marginBottom: 8,
    paddingHorizontal: 4,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  separator: { height: StyleSheet.hairlineWidth, marginStart: 56, marginEnd: 10 },
});