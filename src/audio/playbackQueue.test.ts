import {
  adjacentSurah,
  finishTransition,
  formatPlaybackTime,
  nextQueueIndex,
  queueEntryStartTime,
} from './playbackQueue';

describe('recitation playback queue', () => {
  it('moves between adjacent Surahs without wrapping the Quran', () => {
    expect(adjacentSurah(1, -1)).toBeUndefined();
    expect(adjacentSurah(1, 1)).toBe(2);
    expect(adjacentSurah(57, -1)).toBe(56);
    expect(adjacentSurah(114, 1)).toBeUndefined();
  });

  it('formats long-form playback positions', () => {
    expect(formatPlaybackTime(0)).toBe('0:00');
    expect(formatPlaybackTime(65)).toBe('1:05');
    expect(formatPlaybackTime(3661)).toBe('1:01:01');
    expect(formatPlaybackTime(Number.NaN)).toBe('0:00');
  });

  it('advances once while didJustFinish remains sticky, then rearms after it clears', () => {
    expect(finishTransition(false, true)).toEqual({ advance: true, handled: true });
    expect(finishTransition(true, true)).toEqual({ advance: false, handled: true });
    expect(finishTransition(true, false)).toEqual({ advance: false, handled: false });
    expect(finishTransition(false, true)).toEqual({ advance: true, handled: true });
  });

  it('moves inside an explicit queue without wrapping', () => {
    expect(nextQueueIndex(3, 0, 1)).toBe(1);
    expect(nextQueueIndex(3, 1, 1)).toBe(2);
    expect(nextQueueIndex(3, 2, 1)).toBeUndefined();
    expect(nextQueueIndex(3, 0, -1)).toBeUndefined();
    expect(nextQueueIndex(3, 2, -1)).toBe(1);
    expect(nextQueueIndex(0, 0, 1)).toBeUndefined();
  });

  it('establishes a queue entry start even when the source is already loaded', () => {
    expect(queueEntryStartTime({ startAyah: 1, endAyah: 7 }, 7)).toBe(0);
    expect(queueEntryStartTime({ startAyah: 1, endAyah: 2 }, 7, 3.25)).toBe(3.25);
    expect(queueEntryStartTime({ startAyah: 2, endAyah: 2 }, 7, 8.5)).toBe(8.5);
    expect(queueEntryStartTime({ startAyah: 2, endAyah: 2 }, 7)).toBeUndefined();
  });
});
