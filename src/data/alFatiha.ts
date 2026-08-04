export type Ayah = {
  number: number;
  arabic: string;
  translation: string;
  page: number;
  juz: number;
};

export type QuranChapter = {
  number: number;
  arabicName: string;
  englishName: string;
  meaning: string;
  revelationType: 'Meccan' | 'Medinan';
  ayahs: Ayah[];
  translationName: string;
};

export const AL_FATIHA_FALLBACK: QuranChapter = {
  number: 1,
  arabicName: 'سُورَةُ ٱلْفَاتِحَةِ',
  englishName: 'Al-Faatiha',
  meaning: 'The Opening',
  revelationType: 'Meccan',
  translationName: 'Saheeh International',
  ayahs: [
    {
      number: 1,
      arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
      page: 1,
      juz: 1,
    },
    {
      number: 2,
      arabic: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
      translation: '[All] praise is [due] to Allah, Lord of the worlds—',
      page: 1,
      juz: 1,
    },
    {
      number: 3,
      arabic: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      translation: 'The Entirely Merciful, the Especially Merciful,',
      page: 1,
      juz: 1,
    },
    {
      number: 4,
      arabic: 'مَٰلِكِ يَوْمِ ٱلدِّينِ',
      translation: 'Sovereign of the Day of Recompense.',
      page: 1,
      juz: 1,
    },
    {
      number: 5,
      arabic: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
      translation: 'It is You we worship and You we ask for help.',
      page: 1,
      juz: 1,
    },
    {
      number: 6,
      arabic: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
      translation: 'Guide us to the straight path—',
      page: 1,
      juz: 1,
    },
    {
      number: 7,
      arabic:
        'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
      translation:
        'The path of those upon whom You have bestowed favor, not of those who have evoked anger or of those who are astray.',
      page: 1,
      juz: 1,
    },
  ],
};
