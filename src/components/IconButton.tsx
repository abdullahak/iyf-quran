import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppSymbol, type AppSymbolName } from '@/components/AppSymbol';
import { GlassSurface } from '@/components/GlassSurface';
import { useAppPalette } from '@/theme/useAppPalette';

type Props = {
  name: AppSymbolName;
  label: string;
  onPress: () => void;
  filled?: boolean;
  size?: number;
  style?: ViewStyle;
};

export function IconButton({ name, label, onPress, filled = false, size = 44, style }: Props) {
  const colors = useAppPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.pressable,
        { width: size, height: size, borderRadius: size / 2, transform: [{ scale: pressed ? 0.94 : 1 }] },
        style,
      ]}
    >
      {filled ? (
        <View style={[styles.surface, { backgroundColor: colors.primary }]}>
          <AppSymbol name={name} tintColor={colors.onPrimary} size={19} weight="semibold" />
        </View>
      ) : (
        <GlassSurface interactive strength="thin" style={styles.surface}>
          <AppSymbol name={name} tintColor={colors.text} size={19} weight="semibold" />
        </GlassSurface>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { overflow: 'hidden' },
  surface: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});