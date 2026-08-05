import { parseChapterResponse } from './quran';

describe('Quran chapter response parsing', () => {
  it('parses the authoritative Arabic edition without translation data', () => {
    const chapter = parseChapterResponse({
      code: 200,
      data: {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Faatiha',
        englishNameTranslation: 'The Opening',
        revelationType: 'Meccan',
        ayahs: [{ text: '\uFEFFبِسْمِ اللَّهِ', numberInSurah: 1, page: 1, juz: 1 }],
        edition: { identifier: 'quran-uthmani', englishName: 'Uthmani' },
      },
    });

    expect(chapter.ayahs).toEqual([
      {
        number: 1,
        arabic: 'بِسْمِ اللَّهِ',
        page: 1,
        juz: 1,
      },
    ]);
    expect(chapter).not.toHaveProperty('translationName');
  });

  it('rejects responses that are not the expected Uthmani edition', () => {
    expect(() => parseChapterResponse({
      code: 200,
      data: {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Faatiha',
        englishNameTranslation: 'The Opening',
        revelationType: 'Meccan',
        ayahs: [],
        edition: { identifier: 'other', englishName: 'Other' },
      },
    })).toThrow(
      'Uthmani Arabic edition',
    );
  });

  it('separates a provider-prefixed Basmala from the first Ayah outside Al-Faatiha', () => {
    const result = parseChapterResponse({
      code: 200,
      data: {
        number: 2,
        name: 'سُورَةُ البَقَرَةِ',
        englishName: 'Al-Baqara',
        englishNameTranslation: 'The Cow',
        revelationType: 'Medinan',
        edition: { identifier: 'quran-uthmani', englishName: 'Uthmani' },
        ayahs: [
          {
            numberInSurah: 1,
            text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ',
            page: 2,
            juz: 1,
          },
        ],
      },
    });

    expect(result.ayahs[0].arabic).toBe('الٓمٓ');
  });

  it.each([
    [95, 'بِّسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ وَٱلتِّينِ', 'وَٱلتِّينِ'],
    [97, 'بِّسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ إِنَّآ أَنزَلْنَٰهُ', 'إِنَّآ أَنزَلْنَٰهُ'],
  ])('normalizes the provider Basmala spelling used by Surah %i', (number, text, expected) => {
    const result = parseChapterResponse({
      code: 200,
      data: {
        number,
        name: 'سُورَةٌ',
        englishName: 'Surah',
        englishNameTranslation: 'Meaning',
        revelationType: 'Meccan',
        edition: { identifier: 'quran-uthmani', englishName: 'Uthmani' },
        ayahs: [{ numberInSurah: 1, text, page: 1, juz: 30 }],
      },
    });

    expect(result.ayahs[0].arabic).toBe(expected);
  });
});
