import {
  createPlaybackEndRule,
  createSleepTimerRule,
  isSleepTimerExpired,
  isSleepTimerSelected,
  shouldAdvanceAfterSurah,
  shouldStopAtAyahEnd,
} from './playbackEndRule';

describe('playback end rules', () => {
  it('creates internal continuous, user-facing Quran-end, and Surah-local rules', () => {
    expect(createPlaybackEndRule('continuous', 2, 6)).toEqual({ kind: 'continuous' });
    expect(createPlaybackEndRule('quran', 2, 6)).toEqual({ kind: 'quran' });
    expect(createPlaybackEndRule('surah', 2, 6)).toEqual({ kind: 'surah' });
  });

  it('resolves the current canonical Medina page end', () => {
    expect(createPlaybackEndRule('page', 2, 6)).toEqual({
      kind: 'page',
      page: 3,
      end: { surah: 2, ayah: 16 },
    });
    expect(shouldStopAtAyahEnd(createPlaybackEndRule('page', 2, 6), 2, 16)).toBe(true);
    expect(shouldStopAtAyahEnd(createPlaybackEndRule('page', 2, 6), 2, 15)).toBe(false);
  });

  it('resolves the current Juz end even when it crosses Surahs', () => {
    const rule = createPlaybackEndRule('juz', 2, 142);
    expect(rule).toEqual({ kind: 'juz', juz: 2, end: { surah: 2, ayah: 252 } });
    expect(shouldAdvanceAfterSurah(rule, 1)).toBe(true);
    expect(shouldAdvanceAfterSurah(rule, 2)).toBe(false);
  });

  it('does not advance past a stop-at-Surah rule but Quran-end playback does', () => {
    expect(shouldAdvanceAfterSurah({ kind: 'surah' }, 20)).toBe(false);
    expect(shouldAdvanceAfterSurah({ kind: 'quran' }, 20)).toBe(true);
    expect(shouldAdvanceAfterSurah({ kind: 'continuous' }, 20)).toBe(true);
  });

  it('creates an absolute sleep timer with bounded duration', () => {
    expect(createSleepTimerRule(30, 1_000)).toEqual({
      kind: 'timer',
      durationMinutes: 30,
      endsAt: 1_801_000,
    });
    expect(isSleepTimerExpired(createSleepTimerRule(30, 1_000), 1_800_999)).toBe(false);
    expect(isSleepTimerExpired(createSleepTimerRule(30, 1_000), 1_801_000)).toBe(true);
    expect(() => createSleepTimerRule(0, 1_000)).toThrow(RangeError);
    expect(() => createSleepTimerRule(181, 1_000)).toThrow(RangeError);
  });

  it('selects Off or the exact active sleep-timer duration', () => {
    expect(isSleepTimerSelected({ kind: 'continuous' }, undefined)).toBe(true);
    expect(isSleepTimerSelected({ kind: 'continuous' }, 15)).toBe(false);
    const timer = createSleepTimerRule(30, 1_000);
    expect(isSleepTimerSelected(timer, undefined)).toBe(false);
    expect(isSleepTimerSelected(timer, 15)).toBe(false);
    expect(isSleepTimerSelected(timer, 30)).toBe(true);
  });

  it('rejects invalid current Quran positions', () => {
    expect(() => createPlaybackEndRule('page', 114, 7)).toThrow(RangeError);
    expect(() => createPlaybackEndRule('juz', 0, 1)).toThrow(RangeError);
  });
});
