import { StyleSheet, TextInput, View } from 'react-native';

import { AppSymbol } from '@/components/AppSymbol';
import { useI18n } from '@/i18n/useI18n';
import { radius } from '@/theme/tokens';
import { useAppPalette } from '@/theme/useAppPalette';

type QuranSearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
};

export function QuranSearchField({ value, onChangeText }: QuranSearchFieldProps) {
  const colors = useAppPalette();
  const { t } = useI18n();

  return (
    <View
      style={[
        styles.surface,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <AppSymbol name="search" size={17} tintColor={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t('read.searchPlaceholder')}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={t('read.searchLabel')}
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={[styles.input, { color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    height: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.control,
    marginTop: 20,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    paddingVertical: 0,
  },
});
