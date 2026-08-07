import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppPalette } from '@/theme/useAppPalette';
import { useI18n } from '@/i18n/useI18n';
import { radius } from '@/theme/tokens';

export type QuranBrowseMode = 'surah' | 'juz' | 'page';

type QuranBrowseModeControlProps = {
  mode: QuranBrowseMode;
  onChange: (mode: QuranBrowseMode) => void;
  labels?: Readonly<Record<QuranBrowseMode, string>>;
};

const DEFAULT_LABELS: Readonly<Record<QuranBrowseMode, string>> = {
  surah: 'Surah',
  juz: 'Juz',
  page: 'Page',
};

export function QuranBrowseModeControl({
  mode,
  onChange,
  labels,
}: QuranBrowseModeControlProps) {
  const colors = useAppPalette();
  const { t } = useI18n();
  const localizedLabels = labels ?? {
    surah: t('browse.surah'),
    juz: t('browse.juz'),
    page: t('browse.page'),
  };
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]}
    >
      {(Object.keys(DEFAULT_LABELS) as QuranBrowseMode[]).map((item) => {
        const selected = mode === item;
        return (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(item)}
            style={[styles.segment, selected && { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}>
              {localizedLabels[item]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    height: 46,
    marginTop: 18,
    borderRadius: radius.control,
    padding: 4,
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    borderRadius: radius.control - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
