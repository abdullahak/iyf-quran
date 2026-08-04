import { BlurView } from 'expo-blur';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useAppPalette } from '@/theme/useAppPalette';
import { useReduceTransparency } from '@/theme/useReduceTransparency';

export type GlassSurfaceProps = PropsWithChildren<
  ViewProps & {
    interactive?: boolean;
    strength?: 'thin' | 'regular';
  }
>;

export function GlassSurface({
  children,
  interactive: _interactive,
  strength = 'regular',
  style,
  ...props
}: GlassSurfaceProps) {
  const colors = useAppPalette();
  const reduceTransparency = useReduceTransparency();

  if (reduceTransparency) {
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

  return (
    <BlurView
      {...props}
      intensity={strength === 'thin' ? 34 : 58}
      tint="systemMaterial"
      blurMethod="dimezisBlurViewSdk31Plus"
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

const styles = StyleSheet.create({
  fallback: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});