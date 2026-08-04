import { CHAPTERS } from '@/data/chapters';

import { MUHAMMAD_AL_FAQIH_TRACKS } from './muhammadAlFaqihTracks';
import { recitationTrack, recitationUrl } from './reciter';

describe('Muhammad Al-Faqih recitation URLs', () => {
  it('uses MP3Quran three-digit surah filenames', () => {
    expect(recitationUrl({ number: 1 })).toBe(
      'https://server16.mp3quran.net/M_Alfaqih/Rewayat-Hafs-A-n-Assem/001.mp3',
    );
    expect(recitationUrl({ number: 114 })).toBe(
      'https://server16.mp3quran.net/M_Alfaqih/Rewayat-Hafs-A-n-Assem/114.mp3',
    );
  });

  it('locks all 114 tracks to the verified corpus identity', () => {
    expect(MUHAMMAD_AL_FAQIH_TRACKS).toHaveLength(CHAPTERS.length);
    MUHAMMAD_AL_FAQIH_TRACKS.forEach((track, index) => {
      expect(track.surah).toBe(index + 1);
      expect(track.ayahCount).toBe(CHAPTERS[index]?.ayahCount);
      expect(track.durationMs).toBeGreaterThan(0);
      expect(track.bytes).toBeGreaterThan(0);
      expect(track.sha256).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  it('returns timing-compatible metadata for a track', () => {
    expect(recitationTrack({ number: 1 })).toMatchObject({
      surah: 1,
      ayahCount: 7,
      durationMs: 37016,
      sha256: '2051e2bdcc7d37ed01db0fba4326be49ca470d62b67c655b1a0b2334db5453fe',
    });
  });

  it('rejects non-canonical chapter numbers', () => {
    expect(() => recitationTrack({ number: 0 })).toThrow(RangeError);
    expect(() => recitationTrack({ number: 115 })).toThrow(RangeError);
  });
});
