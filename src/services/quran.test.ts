import { parseChapterResponse } from './quran';

describe('Quran chapter response parsing', () => {
  it('pairs Arabic and English editions by ayah number', () => {
    const chapter = parseChapterResponse({
      code: 200,
      data: [
        {
          number: 1,
          name: 'الفاتحة',
          englishName: 'Al-Faatiha',
          englishNameTranslation: 'The Opening',
          revelationType: 'Meccan',
          ayahs: [{ text: '\uFEFFبِسْمِ اللَّهِ', numberInSurah: 1, page: 1, juz: 1 }],
          edition: { identifier: 'quran-uthmani', englishName: 'Uthmani' },
        },
        {
          number: 1,
          name: 'Al-Faatiha',
          englishName: 'Al-Faatiha',
          englishNameTranslation: 'The Opening',
          revelationType: 'Meccan',
          ayahs: [{ text: 'In the name of Allah.', numberInSurah: 1, page: 1, juz: 1 }],
          edition: { identifier: 'en.sahih', englishName: 'Saheeh International' },
        },
      ],
    });

    expect(chapter.ayahs).toEqual([
      {
        number: 1,
        arabic: 'بِسْمِ اللَّهِ',
        translation: 'In the name of Allah.',
        page: 1,
        juz: 1,
      },
    ]);
    expect(chapter.translationName).toBe('Saheeh International');
  });

  it('rejects edition arrays that cannot be paired safely', () => {
    expect(() => parseChapterResponse({ code: 200, data: [] })).toThrow(
      'both requested editions',
    );
  });
});
