import { CHAPTERS, chapterByNumber } from './chapters';

describe('chapter catalog', () => {
  it('contains the complete Hafs chapter sequence', () => {
    expect(CHAPTERS).toHaveLength(114);
    expect(CHAPTERS.map((chapter) => chapter.number)).toEqual(
      Array.from({ length: 114 }, (_, index) => index + 1),
    );
  });

  it('has the canonical 6,236 ayah total', () => {
    expect(CHAPTERS.reduce((total, chapter) => total + chapter.ayahCount, 0)).toBe(6236);
  });

  it('looks up chapters without guessing invalid values', () => {
    expect(chapterByNumber(1)?.englishName).toBe('Al-Faatiha');
    expect(chapterByNumber(115)).toBeUndefined();
  });
});
