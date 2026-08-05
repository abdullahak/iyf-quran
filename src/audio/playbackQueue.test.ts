import { adjacentSurah, finishTransition, formatPlaybackTime } from './playbackQueue';

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
});
