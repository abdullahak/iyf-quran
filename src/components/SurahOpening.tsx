import { Image, StyleSheet, View } from 'react-native';

import {
  SURAH_OPENING_ASPECT_RATIOS,
  SURAH_OPENING_ASSETS,
} from './surahOpeningAssets';
import { useAppPalette } from '@/theme/useAppPalette';

type SurahOpeningProps = {
  chapterNumber: number;
  arabicName: string;
  accessibilityLabel?: string;
  accessibilityLanguage?: 'ar' | 'en';
  maxHeight?: number;
};

export function SurahOpening({
  accessibilityLabel,
  accessibilityLanguage,
  chapterNumber,
  arabicName,
  maxHeight,
}: SurahOpeningProps) {
  const colors = useAppPalette();
  const source = SURAH_OPENING_ASSETS[chapterNumber];
  const aspectRatio = SURAH_OPENING_ASPECT_RATIOS[chapterNumber];
  if (!source || !aspectRatio) return null;

  return (
    <View
      style={[styles.container, maxHeight ? styles.boundedContainer : undefined]}
      testID="surah-opening-container"
    >
      <View
        style={[
          styles.frame,
          { aspectRatio },
          maxHeight ? { maxHeight, maxWidth: maxHeight * aspectRatio } : undefined,
        ]}
        testID="surah-opening-frame"
      >
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={accessibilityLabel ?? `Opening of ${arabicName}`}
          accessibilityLanguage={accessibilityLanguage}
          resizeMode="contain"
          source={source}
          style={styles.artwork}
          testID="surah-opening-artwork"
          tintColor={colors.text}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
  },
  frame: {
    width: '100%',
    maxWidth: 640,
  },
  boundedContainer: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  artwork: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
});
