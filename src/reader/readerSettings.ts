export const READER_FONT_SCALES = [0.85, 1, 1.15, 1.3, 1.45] as const;
export const DEFAULT_READER_FONT_SCALE = 1;
export const READER_FONT_SCALE_STORAGE_KEY = 'quran:reader-font-scale:v1';

export function parseReaderFontScale(raw: string | null): number {
  if (raw === null) return DEFAULT_READER_FONT_SCALE;
  try {
    const value = JSON.parse(raw) as unknown;
    return typeof value === 'number' && READER_FONT_SCALES.some((scale) => scale === value)
      ? value
      : DEFAULT_READER_FONT_SCALE;
  } catch {
    return DEFAULT_READER_FONT_SCALE;
  }
}

export function nextReaderFontScale(current: number, direction: -1 | 1): number {
  const nearestIndex = READER_FONT_SCALES.reduce((bestIndex, scale, index) =>
    Math.abs(scale - current) < Math.abs(READER_FONT_SCALES[bestIndex] - current)
      ? index
      : bestIndex,
  0);
  const nextIndex = Math.max(0, Math.min(READER_FONT_SCALES.length - 1, nearestIndex + direction));
  return READER_FONT_SCALES[nextIndex];
}
