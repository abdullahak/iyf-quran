import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SurahOpening } from '@/components/SurahOpening';
import { chapterByNumber } from '@/data/chapters';
import { classicMedinaMetrics } from './classicMedinaLayout';
import {
  fetchQcfV2Page,
  qcfV2FontFamily,
  qcfV2FontUrl,
  type QcfV2Page,
} from './qcfV2Page';

type ClassicMedinaPageProps = {
  active?: { surah: number; ayah: number };
  availableHeight?: number;
  pageNumber: number;
  color?: ColorValue;
  errorBody?: string;
  errorTitle?: string;
  focused?: { surah: number; ayah: number };
  onSelectAyah?: (surah: number, ayah: number) => void;
  style?: StyleProp<ViewStyle>;
};

type PageState =
  | { pageNumber: number; status: 'loading' }
  | { pageNumber: number; status: 'ready'; page: QcfV2Page }
  | { pageNumber: number; status: 'error' };


/**
 * A live, reusable 15-row Classic Medina page. Each row keeps API glyph order,
 * while nested word nodes retain their canonical verse identity.
 */
export function ClassicMedinaPage({
  active,
  availableHeight,
  color = '#17130d',
  pageNumber,
  errorBody,
  errorTitle = `Unable to load Classic Medina page ${pageNumber}.`,
  focused,
  onSelectAyah,
  style,
}: ClassicMedinaPageProps) {
  const { height, width } = useWindowDimensions();

  const [state, setState] = useState<PageState>({ pageNumber, status: 'loading' });
  const metrics = classicMedinaMetrics(
    Math.min(680, width),
    availableHeight ?? Math.max(180, height - 120),
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const fontFamily = qcfV2FontFamily(pageNumber);
        const [page] = await Promise.all([
          fetchQcfV2Page(pageNumber),
          Font.loadAsync({ [fontFamily]: qcfV2FontUrl(pageNumber) }),
        ]);
        if (active) setState({ pageNumber, status: 'ready', page });
      } catch {
        if (active) setState({ pageNumber, status: 'error' });
      }
    })();

    return () => {
      active = false;
    };
  }, [pageNumber]);

  if (state.pageNumber !== pageNumber || state.status === 'loading') {
    return (
      <View style={[styles.status, { minHeight: metrics.pageHeight }, style]} testID="classic-medina-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={[styles.status, { minHeight: metrics.pageHeight }, style]} testID="classic-medina-error">
        <Text>{errorTitle}</Text>
        {errorBody ? <Text>{errorBody}</Text> : null}
      </View>
    );
  }

  const { page } = state;
  const fontFamily = qcfV2FontFamily(pageNumber);

  return (
    <View style={[styles.page, { height: metrics.pageHeight }, style]} testID="classic-medina-page">
      {page.openings.map((opening) => {
        const chapter = chapterByNumber(opening.chapterNumber);
        if (!chapter) return null;
        return (
          <View
            key={`${opening.chapterNumber}:${opening.lineNumbers[0]}`}
            pointerEvents="none"
            style={[
              styles.opening,
              {
                top: `${(((opening.lineNumbers[0] ?? 1) - 1) / 15) * 100}%`,
                height: `${(opening.lineNumbers.length / 15) * 100}%`,
              },
            ]}
            testID={`classic-medina-opening-${opening.chapterNumber}`}
          >
            <SurahOpening
              accessibilityLanguage="ar"
              arabicName={chapter.arabicName}
              chapterNumber={chapter.number}
              maxHeight={opening.lineNumbers.length * metrics.lineHeight}
            />
          </View>
        );
      })}
      {page.lines.map((line) => (
        <View
          key={line.lineNumber}
          style={[styles.line, { height: metrics.lineHeight }]}
          testID={`classic-medina-line-${line.lineNumber}`}
        >
          <Text
            accessibilityLanguage="ar"
            style={[
              styles.glyphLine,
              { color, fontFamily, fontSize: metrics.fontSize, lineHeight: metrics.lineHeight },
            ]}
          >
            {line.words.map((word) => {
              const [surah, ayah] = word.verseKey.split(':').map(Number);
              const playing = active?.surah === surah && active.ayah === ayah;
              const selected = !active && focused?.surah === surah && focused.ayah === ayah;
              return (
                <Text
                key={word.sourceIndex}
                nativeID={`qcf-${word.verseKey.replace(':', '-')}-${word.sourceIndex}`}
                testID={`classic-medina-word-${word.sourceIndex}`}
                accessibilityRole={onSelectAyah ? 'button' : undefined}
                onPress={onSelectAyah ? () => onSelectAyah(surah, ayah) : undefined}
                style={playing ? styles.activeWord : selected ? styles.selectedWord : undefined}
              >
                {word.codeV2}
              </Text>
              );
            })}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: 680,
  },
  line: {
    justifyContent: 'center',
  },
  glyphLine: {
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  opening: {
    position: 'absolute',
    right: 0,
    left: 0,
    zIndex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  selectedWord: { backgroundColor: 'rgba(164, 125, 66, 0.22)' },
  activeWord: { backgroundColor: 'rgba(19, 113, 78, 0.28)' },
});
