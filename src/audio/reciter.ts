import type { Chapter } from '@/data/chapters';

import {
  MUHAMMAD_AL_FAQIH_TRACKS,
  type RecitationTrackIdentity,
} from './muhammadAlFaqihTracks';

export const MUHAMMAD_AL_FAQIH = {
  id: 'muhammad-al-faqih',
  name: 'Muhammad Al-Faqih',
  narration: 'Hafs',
  country: 'Yemen',
  catalogUrl: 'https://mp3quran.net/eng/mhmd-lfkyh',
  artworkUrl: 'https://artwork.qurancentral.com/muhammad-al-faqih-300x300.jpg',
  audioBaseUrl:
    'https://server16.mp3quran.net/M_Alfaqih/Rewayat-Hafs-A-n-Assem',
} as const;

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

export function recitationUrl(chapter: Pick<Chapter, 'number'>): string {
  return recitationTrack(chapter).sourceUrl;
}
