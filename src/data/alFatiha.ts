export type Ayah = {
  number: number;
  arabic: string;
  page: number;
  juz: number;
};

export type QuranChapter = {
  number: number;
  arabicName: string;
  englishName: string;
  revelationType: 'Meccan' | 'Medinan';
  ayahs: Ayah[];
};

export const AL_FATIHA_FALLBACK: QuranChapter = {
  number: 1,
  arabicName: 'سُورَةُ ٱلْفَاتِحَةِ',
  englishName: 'Al-Faatiha',
  revelationType: 'Meccan',
  ayahs: [
    {
      number: 1,
      arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      page: 1,
      juz: 1,
    },
    {
      number: 2,
      arabic: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
      page: 1,
      juz: 1,
    },
    {
      number: 3,
      arabic: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      page: 1,
      juz: 1,
    },
    {
      number: 4,
      arabic: 'مَٰلِكِ يَوْمِ ٱلدِّينِ',
      page: 1,
      juz: 1,
    },
    {
      number: 5,
      arabic: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
      page: 1,
      juz: 1,
    },
    {
      number: 6,
      arabic: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
      page: 1,
      juz: 1,
    },
    {
      number: 7,
      arabic:
        'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
      page: 1,
      juz: 1,
    },
  ],
};
