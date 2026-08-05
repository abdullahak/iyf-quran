import * as Haptics from 'expo-haptics';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RECITERS, type ReciterId } from '@/audio/reciter';
import { AppSymbol, type AppSymbolName } from '@/components/AppSymbol';
import { READER_FONT_SCALES } from '@/reader/readerSettings';
import { useReaderSettings } from '@/reader/ReaderSettingsProvider';
import { useAppSettings } from '@/settings/AppSettingsProvider';
import type { AppearanceMode, ReaderMode } from '@/settings/appSettings';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius } from '@/theme/tokens';

const APPEARANCE_OPTIONS: readonly { value: AppearanceMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const READER_OPTIONS: readonly {
  value: ReaderMode;
  label: string;
  detail: string;
}[] = [
  { value: 'ayah', label: 'Ayah view', detail: 'Continuous reading with individual Ayah actions' },
  { value: 'mushaf', label: 'Classic Medina', detail: 'Hafs · canonical 604-page Mushaf layout' },
];

export default function SettingsScreen() {
  const colors = useAppPalette();
  const { settings, setAppearance, setReaderMode, setReciterId } = useAppSettings();
  const { fontScale, setFontScale } = useReaderSettings();

  const select = (action: () => void) => {
    void Haptics.selectionAsync();
    action();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Settings</Text>

          <SettingsSection title="Appearance">
            <View
              accessibilityRole="radiogroup"
              style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]}
            >
              {APPEARANCE_OPTIONS.map((option) => {
                const selected = settings.appearance === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    aria-checked={selected}
                    accessibilityLabel={`${option.label} appearance`}
                    onPress={() => select(() => setAppearance(option.value))}
                    style={[
                      styles.segment,
                      selected && { backgroundColor: colors.surface },
                    ]}
                  >
                    <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SettingsSection>

          <SettingsSection title="Reciter">
            <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {RECITERS.map((reciter, index) => (
                <View key={reciter.id}>
                  <ChoiceRow
                    icon="headphones"
                    label={reciter.name}
                    detail={reciter.supportsOffline
                      ? 'Hafs · synchronized Ayahs · offline available'
                      : 'Hafs · continuous streaming'}
                    selected={settings.reciterId === reciter.id}
                    onPress={() => select(() => setReciterId(reciter.id as ReciterId))}
                  />
                  {index < RECITERS.length - 1 ? (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  ) : null}
                </View>
              ))}
            </View>
          </SettingsSection>

          <SettingsSection title="Quran text size">
            <View style={[styles.fontGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text accessibilityLanguage="ar" style={[styles.fontPreview, { color: colors.text, fontSize: 32 * fontScale, lineHeight: 52 * fontScale }]}>
                بِسْمِ ٱللَّهِ
              </Text>
              <View accessibilityRole="radiogroup" style={styles.fontOptions}>
                {READER_FONT_SCALES.map((scale, index) => {
                  const selected = fontScale === scale;
                  return (
                    <Pressable
                      key={scale}
                      accessibilityRole="radio"
                      accessibilityLabel={`Quran text size ${index + 1} of ${READER_FONT_SCALES.length}`}
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      onPress={() => select(() => setFontScale(scale))}
                      style={[
                        styles.fontOption,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primarySoft : 'transparent',
                        },
                      ]}
                    >
                      <Text style={[styles.fontOptionText, { color: selected ? colors.primary : colors.textMuted, fontSize: 12 + index * 2 }]}>A</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </SettingsSection>

          <SettingsSection title="Reading view">
            <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {READER_OPTIONS.map((option, index) => (
                <View key={option.value}>
                  <ChoiceRow
                    icon="book"
                    label={option.label}
                    detail={option.detail}
                    selected={settings.readerMode === option.value}
                    onPress={() => select(() => setReaderMode(option.value))}
                  />
                  {index < READER_OPTIONS.length - 1 ? (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  ) : null}
                </View>
              ))}
            </View>
          </SettingsSection>

          <Text style={[styles.footnote, { color: colors.textFaint }]}>Quran text remains canonical Uthmani Hafs in either reading view.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsSection({ children, title }: { children: React.ReactNode; title: string }) {
  const colors = useAppPalette();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function ChoiceRow({
  detail,
  icon,
  label,
  onPress,
  selected,
}: {
  detail: string;
  icon: AppSymbolName;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const colors = useAppPalette();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={`${label}, ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.choiceRow, { opacity: pressed ? 0.62 : 1 }]}
    >
      <View style={[styles.choiceIcon, { backgroundColor: colors.primarySoft }]}>
        <AppSymbol name={icon} size={17} tintColor={colors.primary} />
      </View>
      <View style={styles.choiceCopy}>
        <Text style={[styles.choiceLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.choiceDetail, { color: colors.textMuted }]}>{detail}</Text>
      </View>
      <View style={styles.checkSlot}>
        {selected ? <AppSymbol name="check" size={17} tintColor={colors.primary} weight="bold" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 156 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20 },
  title: { paddingTop: 16, fontSize: 34, lineHeight: 41, fontWeight: '600', letterSpacing: -1.1 },
  section: { marginTop: 30 },
  sectionTitle: { marginBottom: 9, marginStart: 4, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  segmented: { height: 48, borderRadius: radius.control, padding: 4, flexDirection: 'row' },
  segment: { flex: 1, borderRadius: radius.control - 4, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, overflow: 'hidden' },
  choiceRow: { minHeight: 70, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  choiceIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1, marginStart: 12, paddingVertical: 10 },
  choiceLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  choiceDetail: { marginTop: 2, fontSize: 12, lineHeight: 17 },
  checkSlot: { width: 30, alignItems: 'flex-end' },
  divider: { height: StyleSheet.hairlineWidth, marginStart: 60 },
  fontGroup: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, padding: 18 },
  fontPreview: { minHeight: 64, fontFamily: 'AmiriQuran_400Regular', textAlign: 'center', writingDirection: 'rtl' },
  fontOptions: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  fontOption: { flex: 1, height: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fontOptionText: { fontWeight: '700' },
  footnote: { marginTop: 18, paddingHorizontal: 4, fontSize: 11, lineHeight: 16 },
});
