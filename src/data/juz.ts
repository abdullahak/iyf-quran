import { chapterByNumber, type Chapter } from './chapters';

// Generated from quran-meta/hafs v6.0.17 getJuzMeta(). Keeping the 30
// canonical boundaries local avoids loading the package's ESM-only runtime in Jest.
const JUZ_BOUNDARIES = [
  [[1, 1], [2, 141]], [[2, 142], [2, 252]], [[2, 253], [3, 92]],
  [[3, 93], [4, 23]], [[4, 24], [4, 147]], [[4, 148], [5, 81]],
  [[5, 82], [6, 110]], [[6, 111], [7, 87]], [[7, 88], [8, 40]],
  [[8, 41], [9, 92]], [[9, 93], [11, 5]], [[11, 6], [12, 52]],
  [[12, 53], [14, 52]], [[15, 1], [16, 128]], [[17, 1], [18, 74]],
  [[18, 75], [20, 135]], [[21, 1], [22, 78]], [[23, 1], [25, 20]],
  [[25, 21], [27, 55]], [[27, 56], [29, 45]], [[29, 46], [33, 30]],
  [[33, 31], [36, 27]], [[36, 28], [39, 31]], [[39, 32], [41, 46]],
  [[41, 47], [45, 37]], [[46, 1], [51, 30]], [[51, 31], [57, 29]],
  [[58, 1], [66, 12]], [[67, 1], [77, 50]], [[78, 1], [114, 6]],
] as const;

export type JuzSurahSegment = {
  key: `${number}:${number}-${number}`;
  chapter: Chapter;
  startAyah: number;
  endAyah: number;
};

export type JuzSection = {
  juz: number;
  first: readonly [surah: number, ayah: number];
  last: readonly [surah: number, ayah: number];
  segments: readonly JuzSurahSegment[];
};

function segmentFor(
  surah: number,
  first: readonly [number, number],
  last: readonly [number, number],
): JuzSurahSegment {
  const chapter = chapterByNumber(surah);
  if (!chapter) throw new RangeError(`Unknown Surah ${surah} in Juz metadata.`);
  const startAyah = surah === first[0] ? first[1] : 1;
  const endAyah = surah === last[0] ? last[1] : chapter.ayahCount;
  return {
    key: `${surah}:${startAyah}-${endAyah}`,
    chapter,
    startAyah,
    endAyah,
  };
}

export const JUZ_SECTIONS: readonly JuzSection[] = Array.from(
  { length: 30 },
  (_, index) => {
    const juz = index + 1;
    const boundary = JUZ_BOUNDARIES[index];
    if (!boundary) throw new RangeError(`Missing metadata for Juz ${juz}.`);
    const [first, last] = boundary;
    return {
      juz,
      first,
      last,
      segments: Array.from(
        { length: last[0] - first[0] + 1 },
        (__, surahIndex) => segmentFor(first[0] + surahIndex, first, last),
      ),
    };
  },
);
