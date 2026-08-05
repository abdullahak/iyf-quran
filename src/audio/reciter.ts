import type { Chapter } from '@/data/chapters';

import {
  MUHAMMAD_AL_FAQIH_TRACKS,
  type RecitationTrackIdentity,
} from './muhammadAlFaqihTracks';

export type ReciterId = 'muhammad-al-faqih' | 'mishary-alafasi';

export type QuranReciter = {
  id: ReciterId;
  name: string;
  arabicName: string;
  narration: 'Hafs';
  country: string;
  catalogUrl: string;
  artworkUrl?: string;
  audioBaseUrl: string;
  supportsOffline: boolean;
  supportsTimings: boolean;
};

export const MUHAMMAD_AL_FAQIH = {
  id: 'muhammad-al-faqih',
  name: 'Muhammad Al-Faqih',
  arabicName: 'مُحَمَّد ٱلْفَقِيه',
  narration: 'Hafs',
  country: 'Yemen',
  catalogUrl: 'https://mp3quran.net/eng/mhmd-lfkyh',
  artworkUrl: 'https://artwork.qurancentral.com/muhammad-al-faqih-300x300.jpg',
  audioBaseUrl:
    'https://server16.mp3quran.net/M_Alfaqih/Rewayat-Hafs-A-n-Assem',
  supportsOffline: true,
  supportsTimings: true,
} as const satisfies QuranReciter;

export const MISHARY_ALAFASI = {
  id: 'mishary-alafasi',
  name: 'Mishary Alafasi',
  arabicName: 'مِشَارِي رَاشِد ٱلْعَفَاسِي',
  narration: 'Hafs',
  country: 'Kuwait',
  catalogUrl: 'https://mp3quran.net/eng/afs',
  audioBaseUrl: 'https://server8.mp3quran.net/afs',
  supportsOffline: false,
  supportsTimings: false,
} as const satisfies QuranReciter;

export const RECITERS = [MUHAMMAD_AL_FAQIH, MISHARY_ALAFASI] as const;
export const DEFAULT_RECITER_ID: ReciterId = MUHAMMAD_AL_FAQIH.id;

export function reciterById(id: string): QuranReciter | undefined {
  return RECITERS.find((reciter) => reciter.id === id);
}

export function isRecitationSelectionActive(
  activeSurah: number | undefined,
  activeReciterId: ReciterId | undefined,
  selectedSurah: number,
  selectedReciterId: ReciterId,
): boolean {
  return activeSurah === selectedSurah && activeReciterId === selectedReciterId;
}

export type RecitationTrack = RecitationTrackIdentity & { sourceUrl: string };

export function recitationTrack(chapter: Pick<Chapter, 'number'>): RecitationTrack {
  const track = MUHAMMAD_AL_FAQIH_TRACKS[chapter.number - 1];
  if (!track || track.surah !== chapter.number) {
    throw new RangeError(`No Muhammad Al-Faqih recording for Surah ${chapter.number}`);
  }
  return {
    ...track,
    sourceUrl: `${MUHAMMAD_AL_FAQIH.audioBaseUrl}/${String(chapter.number).padStart(3, '0')}.mp3`,
  };
}

export function recitationUrl(
  chapter: Pick<Chapter, 'number'>,
  reciterId: ReciterId = DEFAULT_RECITER_ID,
): string {
  if (!Number.isInteger(chapter.number) || chapter.number < 1 || chapter.number > 114) {
    throw new RangeError(`No canonical recording for Surah ${chapter.number}`);
  }
  const reciter = reciterById(reciterId);
  if (!reciter) throw new RangeError(`Unknown reciter ${reciterId}`);
  return `${reciter.audioBaseUrl}/${String(chapter.number).padStart(3, '0')}.mp3`;
}
