import AsyncStorage from '@react-native-async-storage/async-storage';

import { AL_FATIHA_FALLBACK, type Ayah, type QuranChapter } from '@/data/alFatiha';

const API_BASE = 'https://api.alquran.cloud/v1';
const CACHE_VERSION = 4;
const PROVIDER_BASMALA_PREFIXES = [
  'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
  'بِّسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
  'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
] as const;

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
  data: ApiEdition;
};

export function parseChapterResponse(payload: ApiResponse): QuranChapter {
  if (payload.code !== 200 || !payload.data || Array.isArray(payload.data)) {
    throw new Error('The Quran service returned an invalid response.');
  }

  const arabic = payload.data;
  if (arabic.edition.identifier !== 'quran-uthmani') {
    throw new Error('The Quran service did not return the expected Uthmani Arabic edition.');
  }

  const ayahs: Ayah[] = arabic.ayahs.map((ayah) => ({
    number: ayah.numberInSurah,
    arabic: separateProviderBasmala(
      ayah.text.replace(/^\uFEFF/, ''),
      arabic.number,
      ayah.numberInSurah,
    ),
    page: ayah.page,
    juz: ayah.juz,
  }));

  return {
    number: arabic.number,
    arabicName: arabic.name,
    englishName: arabic.englishName,
    revelationType: arabic.revelationType,
    ayahs,
  };
}

function separateProviderBasmala(text: string, surah: number, ayah: number): string {
  if (surah === 1 || surah === 9 || ayah !== 1) return text;
  const prefix = PROVIDER_BASMALA_PREFIXES.find((candidate) => text.startsWith(candidate));
  return prefix ? text.slice(prefix.length).trimStart() : text;
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
      `${API_BASE}/surah/${number}/quran-uthmani`,
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
