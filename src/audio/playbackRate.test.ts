import {
  DEFAULT_PLAYBACK_RATE,
  nextPlaybackRate,
  parsePlaybackRate,
  PLAYBACK_RATES,
  PLAYBACK_RATE_STORAGE_KEY,
} from './playbackRate';

describe('playback rate', () => {
  it('offers deliberate increments from 0.5x through 2x', () => {
    expect(PLAYBACK_RATES).toEqual([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
    expect(DEFAULT_PLAYBACK_RATE).toBe(1);
    expect(PLAYBACK_RATE_STORAGE_KEY).toBe('quran:playback-rate:v1');
  });

  it('moves to the next supported rate and clamps at either boundary', () => {
    expect(nextPlaybackRate(1, 1)).toBe(1.25);
    expect(nextPlaybackRate(1, -1)).toBe(0.75);
    expect(nextPlaybackRate(0.5, -1)).toBe(0.5);
    expect(nextPlaybackRate(2, 1)).toBe(2);
  });

  it('snaps an unexpected current rate before moving', () => {
    expect(nextPlaybackRate(1.1, 1)).toBe(1.25);
    expect(nextPlaybackRate(1.1, -1)).toBe(0.75);
  });

  it('restores only explicitly supported persisted rates', () => {
    expect(parsePlaybackRate('1.5')).toBe(1.5);
    expect(parsePlaybackRate('1.1')).toBe(DEFAULT_PLAYBACK_RATE);
    expect(parsePlaybackRate(null)).toBe(DEFAULT_PLAYBACK_RATE);
    expect(parsePlaybackRate('{broken')).toBe(DEFAULT_PLAYBACK_RATE);
  });
});
