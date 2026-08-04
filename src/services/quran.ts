import AsyncStorage from '@react-native-async-storage/async-storage';

import { AL_FATIHA_FALLBACK, type Ayah, type QuranChapter } from '@/data/alFatiha';

const API_BASE = 'https://api.alquran.cloud/v1';
const CACHE_VERSION = 1;

type ApiAyah = {
  text: string;
  numberInSurah: number;
  page: number;
  juz: number;
};

type ApiEdition = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: 'Meccan' | 'Medinan';
  ayahs: ApiAyah[];
  edition: {
    identifier: string;
    englishName: string;
  };
};

type ApiResponse = {
  code: number;
  data: ApiEdition[];
};

export function parseChapterResponse(payload: ApiResponse): QuranChapter {
  if (payload.code !== 200 || !Array.isArray(payload.data)) {
    throw new Error('The Quran service returned an invalid response.');
  }

  const arabic = payload.data.find((edition) => edition.edition.identifier === 'quran-uthmani');
  const english = payload.data.find((edition) => edition.edition.identifier === 'en.sahih');
  if (!arabic || !english || arabic.number !== english.number) {
    throw new Error('The Quran service did not return both requested editions.');
  }
  if (arabic.ayahs.length !== english.ayahs.length) {
    throw new Error('Arabic and English ayah counts do not match.');
  }

  const ayahs: Ayah[] = arabic.ayahs.map((ayah, index) => {
    const translation = english.ayahs[index];
    if (!translation || translation.numberInSurah !== ayah.numberInSurah) {
      throw new Error('Arabic and English ayah numbers do not match.');
    }
    return {
      number: ayah.numberInSurah,
      arabic: ayah.text.replace(/^\uFEFF/, ''),
      translation: translation.text,
      page: ayah.page,
      juz: ayah.juz,
    };
  });

  return {
    number: arabic.number,
    arabicName: arabic.name,
    englishName: arabic.englishName,
    meaning: arabic.englishNameTranslation,
    revelationType: arabic.revelationType,
    ayahs,
    translationName: english.edition.englishName,
  };
}

export async function loadChapter(number: number): Promise<QuranChapter> {
  if (!Number.isInteger(number) || number < 1 || number > 114) {
    throw new Error('Surah number must be between 1 and 114.');
  }

  const cacheKey = `quran:chapter:v${CACHE_VERSION}:${number}`;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as QuranChapter;
    } catch {
      await AsyncStorage.removeItem(cacheKey);
    }
  }

  try {
    const response = await fetch(
      `${API_BASE}/surah/${number}/editions/quran-uthmani,en.sahih`,
    );
    if (!response.ok) throw new Error(`Quran service failed with HTTP ${response.status}.`);
    const chapter = parseChapterResponse((await response.json()) as ApiResponse);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(chapter));
    return chapter;
  } catch (error) {
    if (number === 1) return AL_FATIHA_FALLBACK;
    throw error;
  }
}
