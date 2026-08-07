import { render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ResponsiveMushafPage } from './ResponsiveMushafPage';
import type { QuranChapter } from '@/data/alFatiha';

jest.mock('@/components/SurahOpening', () => {
  const { View } = jest.requireActual('react-native');
  return { SurahOpening: () => <View testID="mock-surah-opening" /> };
});

jest.mock('@/i18n/useI18n', () => ({
  useI18n: () => ({
    language: 'en',
    number: (value: number) => String(value),
    t: (key: string) => key,
  }),
}));

jest.mock('@/theme/useAppPalette', () => ({
  useAppPalette: () => ({
    primary: '#064',
    primarySoft: '#def',
    text: '#111',
    textMuted: '#555',
  }),
}));

const chapter: QuranChapter = {
  number: 2,
  arabicName: 'سُورَةُ الْبَقَرَةِ',
  englishName: 'Al-Baqarah',
  revelationType: 'Medinan',
  ayahs: [{
    number: 1,
    arabic: 'ا'.repeat(320),
    page: 2,
    juz: 1,
  }],
};

describe('ResponsiveMushafPage viewport fitting', () => {
  it('bounds and font-fits an oversized intact Ayah including its marker below the opening', async () => {
    const screen = await render(
      <ResponsiveMushafPage
        availableHeight={220}
        segments={[{ chapter, ayahs: chapter.ayahs }]}
        fontScale={1}
        onNextPage={jest.fn()}
        onPositionChange={jest.fn()}
        onPreviousPage={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    const quranText = screen.getByTestId('reading-mushaf-text-2:1');
    expect(screen.getByTestId('reading-mushaf-section-2-1-1')).toBeTruthy();
    expect(quranText.props.adjustsFontSizeToFit).toBe(true);
    expect(quranText.props.minimumFontScale).toBeLessThanOrEqual(0.2);
    expect(quranText.props.numberOfLines).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('mushaf.selectAyah').props.children.join('')).toContain('﴿1﴾');
  });

  it('opens a bounded preceding window on the page containing its initial visible Ayah', async () => {
    const onPositionChange = jest.fn();
    await render(
      <ResponsiveMushafPage
        availableHeight={160}
        fontScale={1}
        initialPosition={{ surah: 2, ayah: 3 }}
        onNextPage={jest.fn()}
        onPositionChange={onPositionChange}
        onPreviousPage={jest.fn()}
        onSelect={jest.fn()}
        segments={[{
          chapter,
          ayahs: [
            { number: 2, arabic: 'ب'.repeat(240), page: 2, juz: 1 },
            { number: 3, arabic: 'ت'.repeat(240), page: 2, juz: 1 },
          ],
        }]}
      />,
    );

    await waitFor(() => expect(onPositionChange).toHaveBeenCalledWith(2, 3));
  });

  it('follows and highlights playback instead of leaving the selected Ayah highlighted', async () => {
    const onPositionChange = jest.fn();
    const screen = await render(
      <ResponsiveMushafPage
        active={{ surah: 2, ayah: 2 }}
        availableHeight={160}
        focused={{ surah: 2, ayah: 1 }}
        fontScale={1}
        onNextPage={jest.fn()}
        onPositionChange={onPositionChange}
        onPreviousPage={jest.fn()}
        onSelect={jest.fn()}
        segments={[{
          chapter,
          ayahs: [
            { number: 1, arabic: 'ا'.repeat(240), page: 2, juz: 1 },
            { number: 2, arabic: 'ب'.repeat(240), page: 2, juz: 1 },
          ],
        }]}
      />,
    );

    await waitFor(() => expect(onPositionChange).toHaveBeenCalledWith(2, 2));
    const ayahs = screen.getAllByLabelText('mushaf.selectAyah');
    expect(ayahs).toHaveLength(1);
    expect(ayahs[0].props.children.join('')).toContain('﴿2﴾');
    expect(StyleSheet.flatten(ayahs[0].props.style)).toMatchObject({
      backgroundColor: '#def',
      color: '#064',
    });
  });
});
