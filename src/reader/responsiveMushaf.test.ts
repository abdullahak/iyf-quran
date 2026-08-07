import { AL_FATIHA_FALLBACK } from '@/data/alFatiha';

import {
  paginateResponsiveAyahs,
  RESPONSIVE_MUSHAF_OPENING_LINE_COST,
  responsiveMushafScreenAfterSwipe,
  responsiveMushafTypography,
  responsiveMushafViewport,
} from './responsiveMushaf';

const ayah = (ayah: number, textLength: number, startsSurah = false) => ({
  key: `2:${ayah}`,
  surah: 2,
  ayah,
  arabic: 'ا'.repeat(textLength),
  startsSurah,
});

describe('responsive Mushaf pagination', () => {
  it('reserves the single rendered line used by compact Surah opening artwork', () => {
    expect(RESPONSIVE_MUSHAF_OPENING_LINE_COST).toBe(1);
  });

  it('constrains the horizontal pager to one physical viewport', () => {
    expect(responsiveMushafViewport(390, 720)).toEqual({ height: 720, width: 390 });
  });

  it('uses rightward swipes to advance generated screens and canonical boundaries', () => {
    expect(responsiveMushafScreenAfterSwipe(0, 3, 72, 0.2)).toEqual({ kind: 'screen', index: 1 });
    expect(responsiveMushafScreenAfterSwipe(2, 3, 72, 0.2)).toEqual({ kind: 'canonical', direction: 'next' });
    expect(responsiveMushafScreenAfterSwipe(2, 3, -72, -0.2)).toEqual({ kind: 'screen', index: 1 });
    expect(responsiveMushafScreenAfterSwipe(0, 3, -72, -0.2)).toEqual({ kind: 'canonical', direction: 'previous' });
    expect(responsiveMushafScreenAfterSwipe(1, 3, 20, 0.2)).toBeUndefined();
  });

  it('moves overflow to later screens without dropping canonical Ayahs', () => {
    const pages = paginateResponsiveAyahs(
      [ayah(1, 20, true), ayah(2, 20), ayah(3, 80), ayah(4, 20)],
      { charsPerLine: 20, lineCapacity: 6, openingLineCost: 2 },
    );

    expect(pages.map((page) => page.map((item) => item.key))).toEqual([
      ['2:1', '2:2'],
      ['2:3', '2:4'],
    ]);
  });

  it('keeps an oversized Ayah intact on its own fit-to-screen page', () => {
    const pages = paginateResponsiveAyahs(
      [ayah(1, 200), ayah(2, 20)],
      { charsPerLine: 20, lineCapacity: 6, openingLineCost: 2 },
    );

    expect(pages.map((page) => page.map((item) => item.key))).toEqual([['2:1'], ['2:2']]);
  });

  it('does not count Arabic harakat as independent full-width characters', () => {
    const markedAyah = { ...ayah(1, 0), arabic: 'بِ'.repeat(20) };
    const pages = paginateResponsiveAyahs(
      [markedAyah, ayah(2, 20)],
      { charsPerLine: 20, lineCapacity: 2, openingLineCost: 0 },
    );

    expect(pages.map((page) => page.map((item) => item.key))).toEqual([
      ['2:1', '2:2'],
    ]);
  });

  it('counts the rendered Ayah marker when deciding whether another Ayah fits', () => {
    const pages = paginateResponsiveAyahs(
      [
        { ...ayah(1, 18), marker: ' ﴿١﴾ ' },
        { ...ayah(2, 18), marker: ' ﴿٢﴾ ' },
      ],
      { charsPerLine: 20, lineCapacity: 2, openingLineCost: 0 },
    );

    expect(pages.map((page) => page.map((item) => item.key))).toEqual([
      ['2:1'],
      ['2:2'],
    ]);
  });

  it('flows adjacent Ayahs together instead of rounding each one up to a full line', () => {
    const firstSurah = Array.from({ length: 7 }, (_, index) => ({
      ...ayah(index + 1, 20, index === 0),
      key: `1:${index + 1}`,
      surah: 1,
    }));
    const nextSurah = { ...ayah(1, 20, true), key: '2:1', surah: 2 };

    const pages = paginateResponsiveAyahs(
      [...firstSurah, nextSurah],
      { charsPerLine: 40, lineCapacity: 10, openingLineCost: 2 },
    );

    expect(pages[0].map((item) => item.key)).toEqual([
      '1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7', '2:1',
    ]);
  });

  it('keeps a Surah opening on the current screen when the opening and text fit', () => {
    const pages = paginateResponsiveAyahs(
      [
        ayah(286, 20),
        { ...ayah(1, 20, true), key: '3:1', surah: 3 },
        { ...ayah(2, 20), key: '3:2', surah: 3 },
      ],
      { charsPerLine: 20, lineCapacity: 8, openingLineCost: 2 },
    );

    expect(pages.map((page) => page.map((item) => item.key))).toEqual([
      ['2:286', '3:1', '3:2'],
    ]);
  });

  it('fills a phone viewport past Al-Fatiha instead of presenting it as a sparse slide', () => {
    const typography = responsiveMushafTypography(390, 699, 1);
    const positions = [
      ...AL_FATIHA_FALLBACK.ayahs.map((item, index) => ({
        key: `1:${item.number}`,
        surah: 1,
        ayah: item.number,
        arabic: item.arabic,
        marker: ` ۝${item.number} `,
        startsSurah: index === 0,
      })),
      { key: '2:1', surah: 2, ayah: 1, arabic: 'الٓمٓ', marker: ' ۝١ ', startsSurah: true },
      {
        key: '2:2',
        surah: 2,
        ayah: 2,
        arabic: 'ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ فِيهِ',
        marker: ' ۝٢ ',
        startsSurah: false,
      },
      ...Array.from({ length: 4 }, (_, index) => ({
        key: `2:${index + 3}`,
        surah: 2,
        ayah: index + 3,
        arabic: 'ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ فِيهِ هُدًى لِّلْمُتَّقِينَ',
        marker: ` ۝${index + 3} `,
        startsSurah: false,
      })),
    ];

    const pages = paginateResponsiveAyahs(positions, typography);

    expect(pages[0][pages[0].length - 1]).toMatchObject({ surah: 2 });
    expect(pages[0][pages[0].length - 1].ayah).toBeGreaterThanOrEqual(5);
  });
});
