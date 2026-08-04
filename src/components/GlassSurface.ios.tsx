import { BlurView } from 'expo-blur';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';

import type { GlassSurfaceProps } from './GlassSurface';
import { useAppPalette } from '@/theme/useAppPalette';
import { useReduceTransparency } from '@/theme/useReduceTransparency';

export function GlassSurface({
  children,
  interactive = false,
  strength = 'regular',
  style,
  ...props
}: GlassSurfaceProps) {
  const colors = useAppPalette();
  const reduceTransparency = useReduceTransparency();
  const canUseLiquidGlass =
    !reduceTransparency && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

  if (canUseLiquidGlass) {
    return (
      <GlassView
        {...props}
        glassEffectStyle={strength === 'thin' ? 'clear' : 'regular'}
        isInteractive={interactive}
        tintColor={strength === 'thin' ? undefined : colors.glass}
        style={style}
      >
        {children}
      </GlassView>
    );
  }

  if (!reduceTransparency) {
    return (
      <BlurView
        {...props}
        intensity={strength === 'thin' ? 38 : 62}
        tint="systemMaterial"
        style={[
          styles.fallback,
          { backgroundColor: colors.glass, borderColor: colors.glassBorder },
          style,
        ]}
      >
        {children}
      </BlurView>
    );
  }

  return (
    <View
      {...props}
      style={[
        styles.fallback,
        { backgroundColor: colors.backgroundElevated, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});