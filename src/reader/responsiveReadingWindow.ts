import { chapterByNumber } from '@/data/chapters';

export type ResponsiveReadingPosition = { surah: number; ayah: number };

export type ResponsiveReadingRange = {
  surah: number;
  startAyah: number;
  endAyah: number;
};

const DEFAULT_MINIMUM_AYAHS = 120;

export function responsiveReadingWindow(
  start: ResponsiveReadingPosition,
  minimumAyahs = DEFAULT_MINIMUM_AYAHS,
  endExclusive?: ResponsiveReadingPosition,
): ResponsiveReadingRange[] {
  const startChapter = validResponsiveReadingPosition(start);
  if (
    !startChapter ||
    !Number.isInteger(minimumAyahs) ||
    minimumAyahs < 1 ||
    (endExclusive && (
      !validResponsiveReadingPosition(endExclusive) ||
      compareResponsiveReadingPositions(start, endExclusive) >= 0
    ))
  ) throw new RangeError('Unknown responsive Quran reading position.');

  const ranges: ResponsiveReadingRange[] = [];
  let bufferedAyahs = 0;
  let surah = start.surah;
  while (surah <= 114 && (endExclusive || bufferedAyahs < minimumAyahs)) {
    const chapter = chapterByNumber(surah);
    if (!chapter) break;
    const startAyah = surah === start.surah ? start.ayah : 1;
    const endAyah = endExclusive?.surah === surah
      ? endExclusive.ayah - 1
      : chapter.ayahCount;
    if (endAyah >= startAyah) {
      ranges.push({ surah, startAyah, endAyah });
      bufferedAyahs += endAyah - startAyah + 1;
    }
    if (endExclusive?.surah === surah) break;
    surah += 1;
  }
  return ranges;
}

export function previousResponsiveReadingPosition(
  current: ResponsiveReadingPosition,
  minimumAyahs = DEFAULT_MINIMUM_AYAHS,
): ResponsiveReadingPosition | undefined {
  if (
    !validResponsiveReadingPosition(current) ||
    !Number.isInteger(minimumAyahs) ||
    minimumAyahs < 1
  ) throw new RangeError('Unknown responsive Quran reading position.');
  if (current.surah === 1 && current.ayah === 1) return undefined;

  let remaining = minimumAyahs;
  let surah = current.surah;
  let ayahsBefore = current.ayah - 1;
  while (surah >= 1) {
    if (ayahsBefore >= remaining) {
      return { surah, ayah: ayahsBefore - remaining + 1 };
    }
    remaining -= ayahsBefore;
    if (surah === 1) return { surah: 1, ayah: 1 };
    surah -= 1;
    ayahsBefore = chapterByNumber(surah)!.ayahCount;
  }
  return undefined;
}

export function immediatelyPreviousResponsiveReadingPosition(
  current: ResponsiveReadingPosition,
): ResponsiveReadingPosition | undefined {
  if (!validResponsiveReadingPosition(current)) {
    throw new RangeError('Unknown responsive Quran reading position.');
  }
  if (current.ayah > 1) return { surah: current.surah, ayah: current.ayah - 1 };
  if (current.surah === 1) return undefined;
  const previousChapter = chapterByNumber(current.surah - 1)!;
  return { surah: previousChapter.number, ayah: previousChapter.ayahCount };
}

export function nextResponsiveReadingPosition(
  ranges: readonly ResponsiveReadingRange[],
): ResponsiveReadingPosition | undefined {
  const last = ranges.at(-1);
  if (!last) return undefined;
  const chapter = chapterByNumber(last.surah);
  if (!chapter) return undefined;
  if (last.endAyah < chapter.ayahCount) {
    return { surah: last.surah, ayah: last.endAyah + 1 };
  }
  return last.surah < 114 ? { surah: last.surah + 1, ayah: 1 } : undefined;
}

function validResponsiveReadingPosition(
  position: ResponsiveReadingPosition,
) {
  const chapter = chapterByNumber(position.surah);
  return chapter &&
    Number.isInteger(position.ayah) &&
    position.ayah >= 1 &&
    position.ayah <= chapter.ayahCount
    ? chapter
    : undefined;
}

function compareResponsiveReadingPositions(
  left: ResponsiveReadingPosition,
  right: ResponsiveReadingPosition,
): number {
  return left.surah === right.surah
    ? left.ayah - right.ayah
    : left.surah - right.surah;
}
