export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export const DEFAULT_PLAYBACK_RATE = 1;
export const PLAYBACK_RATE_STORAGE_KEY = 'quran:playback-rate:v1';

export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export function parsePlaybackRate(raw: string | null): PlaybackRate {
  if (raw === null) return DEFAULT_PLAYBACK_RATE;
  try {
    const value = JSON.parse(raw) as unknown;
    return typeof value === 'number' && PLAYBACK_RATES.some((rate) => rate === value)
      ? value as PlaybackRate
      : DEFAULT_PLAYBACK_RATE;
  } catch {
    return DEFAULT_PLAYBACK_RATE;
  }
}

export function nextPlaybackRate(current: number, direction: -1 | 1): PlaybackRate {
  const nearestIndex = PLAYBACK_RATES.reduce((bestIndex, rate, index) =>
    Math.abs(rate - current) < Math.abs(PLAYBACK_RATES[bestIndex] - current)
      ? index
      : bestIndex,
  0);
  const nextIndex = Math.max(0, Math.min(PLAYBACK_RATES.length - 1, nearestIndex + direction));
  return PLAYBACK_RATES[nextIndex];
}
