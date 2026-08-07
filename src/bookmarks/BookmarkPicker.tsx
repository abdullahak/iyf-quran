import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  makeAyahTarget,
  makeSurahTarget,
  type BookmarkTarget,
} from '@/bookmarks/bookmarks';
import { useBookmarks } from '@/bookmarks/BookmarksProvider';
import { AppSymbol } from '@/components/AppSymbol';
import { Atmosphere } from '@/components/Atmosphere';
import { IconButton } from '@/components/IconButton';
import { CHAPTERS, type Chapter } from '@/data/chapters';
import { useI18n } from '@/i18n/useI18n';
import { radius } from '@/theme/tokens';
import { useAppPalette } from '@/theme/useAppPalette';
import { normalizeQuranSearch } from '@/utils/quranSearch';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function toArabicIndic(value: number) {
  return String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

export function BookmarkPicker({ visible, onClose }: Props) {
  const colors = useAppPalette();
  const { isRTL, language, number: localizedNumber, t } = useI18n();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [query, setQuery] = useState('');
  const [chapter, setChapter] = useState<Chapter>();

  const dismiss = () => {
    setQuery('');
    setChapter(undefined);
    onClose();
  };

  const chapters = useMemo(() => {
    const normalized = normalizeQuranSearch(query);
    if (!normalized) return CHAPTERS;
    return CHAPTERS.filter((candidate) =>
      normalizeQuranSearch(
        `${candidate.number} ${candidate.englishName} ${candidate.arabicName}`,
      ).includes(normalized),
    );
  }, [query]);

  const save = (target: BookmarkTarget) => {
    if (isBookmarked(target.key)) return;
    toggleBookmark(target);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dismiss();
  };

  const ayahs = useMemo(
    () => (chapter ? Array.from({ length: chapter.ayahCount }, (_, index) => index + 1) : []),
    [chapter],
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={dismiss}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      visible={visible}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Atmosphere />
        <View style={styles.navigation}>
          <IconButton
            name={chapter ? (isRTL ? 'forward' : 'back') : 'close'}
            label={chapter ? t('bookmarkPicker.otherSurah') : t('bookmarkPicker.close')}
            onPress={() => (chapter ? setChapter(undefined) : dismiss())}
          />
          <View style={styles.navigationTitle}>
            <Text style={[styles.navTitle, { color: colors.text }]}>{t('bookmarkPicker.title')}</Text>
            <Text style={[styles.navMeta, { color: colors.textMuted }]}>{t('bookmarkPicker.subtitle')}</Text>
          </View>
          <View style={styles.navigationSpacer} />
        </View>

        {chapter ? (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={ayahs}
            keyExtractor={(ayah) => String(ayah)}
            ListHeaderComponent={
              <View>
                <View style={styles.selectedChapter}>
                  <Text
                    accessibilityLanguage="ar"
                    style={[styles.selectedArabic, { color: colors.text }]}
                  >
                    {chapter.arabicName.replace(/^سُورَةُ\s*/, '')}
                  </Text>
                  <Text style={[styles.selectedEnglish, { color: colors.text }]}>
                    {chapter.englishName}
                  </Text>
                  <Text style={[styles.selectedMeta, { color: colors.textMuted }]}>
                    {t('bookmarkPicker.meta', { number: localizedNumber(chapter.number), count: localizedNumber(chapter.ayahCount) })}
                  </Text>
                </View>
                <BookmarkChoice
                  label={t('bookmarkPicker.whole')}
                  meta={t('bookmarkPicker.returnStart', { surah: language === 'ar' ? chapter.arabicName.replace(/^سُورَةُ\s*/, '') : chapter.englishName })}
                  saved={isBookmarked(makeSurahTarget(chapter.number).key)}
                  onPress={() => save(makeSurahTarget(chapter.number))}
                />
                <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{t('bookmarkPicker.ayahs')}</Text>
              </View>
            }
            renderItem={({ item: ayah }) => {
              const target = makeAyahTarget(chapter.number, ayah);
              return (
                <BookmarkChoice
                  arabicLabel={`آية ${toArabicIndic(ayah)}`}
                  label={t('common.ayah', { number: localizedNumber(ayah) })}
                  meta={language === 'ar' ? chapter.arabicName.replace(/^سُورَةُ\s*/, '') : chapter.englishName}
                  saved={isBookmarked(target.key)}
                  onPress={() => save(target)}
                />
              );
            }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={chapters}
            keyExtractor={(item) => String(item.number)}
            ListHeaderComponent={
              <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <AppSymbol name="search" size={18} tintColor={colors.textMuted} />
                <TextInput
                  accessibilityLabel={t('bookmarkPicker.searchLabel')}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  onChangeText={setQuery}
                  placeholder={t('bookmarkPicker.searchPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  returnKeyType="search"
                  style={[styles.searchInput, { color: colors.text }]}
                  value={query}
                />
              </View>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('bookmarkPicker.none')}</Text>
                <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{t('bookmarkPicker.noneBody')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('bookmarkPicker.choose', { surah: language === 'ar' ? item.arabicName.replace(/^سُورَةُ\s*/, '') : item.englishName })}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setChapter(item);
                }}
                style={({ pressed }) => [
                  styles.chapterRow,
                  { backgroundColor: pressed ? colors.primarySoft : 'transparent' },
                ]}
              >
                <Text style={[styles.chapterNumber, { color: colors.textFaint }]}>
                  {localizedNumber(item.number)}
                </Text>
                <View style={styles.chapterCopy}>
                  <Text style={[styles.chapterEnglish, { color: colors.text }]}>{item.englishName}</Text>
                  <Text style={[styles.chapterMeta, { color: colors.textMuted }]}>
                    {t('bookmarkPicker.meta', { number: localizedNumber(item.number), count: localizedNumber(item.ayahCount) })}
                  </Text>
                </View>
                <Text
                  accessibilityLanguage="ar"
                  style={[styles.chapterArabic, { color: colors.text }]}
                >
                  {item.arabicName.replace(/^سُورَةُ\s*/, '')}
                </Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

type ChoiceProps = {
  label: string;
  arabicLabel?: string;
  meta: string;
  saved: boolean;
  onPress: () => void;
};

function BookmarkChoice({ label, arabicLabel, meta, saved, onPress }: ChoiceProps) {
  const colors = useAppPalette();
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? t('bookmarkPicker.savedLabel', { label }) : t('bookmarkPicker.saveLabel', { label })}
      accessibilityState={{ disabled: saved, selected: saved }}
      disabled={saved}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: pressed ? colors.primarySoft : 'transparent' },
      ]}
    >
      <View style={styles.choiceCopy}>
        <View style={styles.choiceTitleRow}>
          <Text style={[styles.choiceTitle, { color: colors.text }]}>{label}</Text>
          {arabicLabel ? (
            <Text accessibilityLanguage="ar" style={[styles.choiceArabic, { color: colors.textMuted }]}>
              {arabicLabel}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.choiceMeta, { color: colors.textMuted }]}>{saved ? t('common.saved') : meta}</Text>
      </View>
      <View style={[styles.choiceIcon, saved && { backgroundColor: colors.primarySoft }]}>
        <AppSymbol
          name={saved ? 'bookmarkFilled' : 'bookmark'}
          size={18}
          tintColor={saved ? colors.primary : colors.textFaint}
        />
      </View>
    </Pressable>
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
  navigationSpacer: { width: 44, height: 44 },
  navTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  navMeta: { marginTop: 2, fontSize: 10, lineHeight: 14 },
  listContent: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 40 },
  search: {
    minHeight: 46,
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, minHeight: 44, fontSize: 16 },
  chapterRow: {
    minHeight: 78,
    paddingHorizontal: 8,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterNumber: { width: 34, fontSize: 11, fontWeight: '500', fontVariant: ['tabular-nums'] },
  chapterCopy: { flex: 1, marginStart: 10, marginEnd: 12 },
  chapterEnglish: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  chapterMeta: { marginTop: 2, fontSize: 12, lineHeight: 17 },
  chapterArabic: {
    maxWidth: 138,
    flexShrink: 1,
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 25,
    lineHeight: 38,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  separator: { height: StyleSheet.hairlineWidth, marginStart: 52 },
  empty: { paddingVertical: 90, alignItems: 'center' },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  emptyBody: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  selectedChapter: { alignItems: 'center', paddingTop: 18, paddingBottom: 24 },
  selectedArabic: {
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 38,
    lineHeight: 56,
    writingDirection: 'rtl',
  },
  selectedEnglish: { fontSize: 18, lineHeight: 23, fontWeight: '600' },
  selectedMeta: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  sectionTitle: { marginTop: 28, marginBottom: 8, paddingHorizontal: 8, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  choice: {
    minHeight: 70,
    paddingHorizontal: 8,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
  },
  choiceCopy: { flex: 1, paddingVertical: 10 },
  choiceTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  choiceTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  choiceArabic: { fontSize: 15, lineHeight: 22, writingDirection: 'rtl' },
  choiceMeta: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  choiceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
