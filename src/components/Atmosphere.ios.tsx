import { Image, StyleSheet, View } from 'react-native';

import { useAppPalette } from '@/theme/useAppPalette';

const grain = require('../../assets/textures/fine-grain.png');
export function Atmosphere() {
  const colors = useAppPalette();

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.nonInteractive, { backgroundColor: colors.background }]}
    >
      <Image source={grain} resizeMode="repeat" style={styles.grain} />
    </View>
  );
}

const styles = StyleSheet.create({
  nonInteractive: { pointerEvents: 'none' },
  grain: { position: 'absolute', inset: 0, width: undefined, height: undefined, opacity: 0.2 },
});