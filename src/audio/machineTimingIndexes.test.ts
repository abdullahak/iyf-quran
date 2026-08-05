import { recitationTrack } from './reciter';
import { MACHINE_TIMING_INDEXES } from './machineTimingIndexes';
import { compileMachineAlignedTimingIndex, MACHINE_ALIGNED_TIMINGS } from './timings';

const BLOCKED_SURAHS = [37, 43, 53, 54];

describe('machine-aligned beta timing registry', () => {
  it('ships complete exact-track timing indexes while excluding blocked Surahs', () => {
    expect(Object.keys(MACHINE_TIMING_INDEXES)).toHaveLength(110);
    BLOCKED_SURAHS.forEach((surah) => expect(MACHINE_TIMING_INDEXES[surah]).toBeUndefined());

    Object.entries(MACHINE_TIMING_INDEXES).forEach(([surahKey, index]) => {
      const surah = Number(surahKey);
      const track = recitationTrack({ number: surah });
      expect(index?.surah).toBe(surah);
      expect(
        index && compileMachineAlignedTimingIndex(index, {
          audioSha256: track.sha256,
          ayahCount: track.ayahCount,
          durationMs: track.durationMs,
        }),
      ).toHaveLength(track.ayahCount);
    });
    expect(Object.keys(MACHINE_ALIGNED_TIMINGS)).toHaveLength(110);
  });
});
