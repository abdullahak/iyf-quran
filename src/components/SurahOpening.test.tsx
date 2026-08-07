import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SurahOpening } from './SurahOpening';
import { SURAH_OPENING_ASPECT_RATIOS, SURAH_OPENING_ASSETS } from './surahOpeningAssets';

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

jest.mock('@/theme/useAppPalette', () => ({
  useAppPalette: () => ({ text: '#f4f0e8' }),
}));

describe('SurahOpening', () => {
  it('has bundled exact artwork for all 114 Surahs', () => {
    expect(Object.keys(SURAH_OPENING_ASSETS)).toHaveLength(114);
    for (let chapter = 1; chapter <= 114; chapter += 1) {
      expect(SURAH_OPENING_ASSETS[chapter]).toBeTruthy();
    }
  });

  it('renders the bundled Medina artwork instead of native borders or live Arabic text', async () => {
    const screen = await render(
      <SurahOpening chapterNumber={107} arabicName="سُورَةُ المَاعُونِ" />,
    );

    const artwork = screen.getByTestId('surah-opening-artwork');
    expect(artwork.props.source).toBe(SURAH_OPENING_ASSETS[107]);
    expect(artwork.props.resizeMode).toBe('contain');
    expect(artwork.props.tintColor).toBe('#f4f0e8');
    const artworkStyle = StyleSheet.flatten(artwork.props.style);
    expect(artworkStyle.tintColor).toBeUndefined();
    expect(artworkStyle.transform).toBeUndefined();
    expect(screen.getByLabelText('Opening of سُورَةُ المَاعُونِ')).toBeTruthy();
    expect(screen.queryByText('سُورَةُ المَاعُونِ')).toBeNull();
    expect(screen.queryByText(BASMALA)).toBeNull();
  });

  it('sizes the layout box from the artwork aspect ratio instead of PNG intrinsic height', async () => {
    const screen = await render(
      <SurahOpening chapterNumber={2} arabicName="سُورَةُ البَقَرَةِ" />,
    );

    const frameStyle = StyleSheet.flatten(screen.getByTestId('surah-opening-frame').props.style);
    const artworkStyle = StyleSheet.flatten(
      screen.getByTestId('surah-opening-artwork').props.style,
    );

    expect(frameStyle).toMatchObject({
      width: '100%',
      maxWidth: 640,
    });
    expect(frameStyle.aspectRatio).toBeCloseTo(1246 / 310, 7);
    expect(artworkStyle).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: '100%',
      height: '100%',
    });
  });

  it('scales the complete raster into a bounded Classic Medina opening gap', async () => {
    const screen = await render(
      <SurahOpening
        chapterNumber={2}
        arabicName="سُورَةُ البَقَرَةِ"
        maxHeight={72}
      />,
    );

    const containerStyle = StyleSheet.flatten(screen.getByTestId('surah-opening-container').props.style);
    const frameStyle = StyleSheet.flatten(screen.getByTestId('surah-opening-frame').props.style);
    expect(containerStyle).toMatchObject({ paddingTop: 0, paddingBottom: 0 });
    expect(frameStyle.maxHeight).toBe(72);
    expect(frameStyle.maxWidth).toBe(72 * SURAH_OPENING_ASPECT_RATIOS[2]);
  });
});
