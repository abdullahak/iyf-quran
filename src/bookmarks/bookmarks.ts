import { chapterByNumber } from '@/data/chapters';

export type AyahKey = `${number}:${number}`;
export type SurahBookmarkKey = `surah:${number}`;
export type RangeBookmarkKey = `range:${number}:${number}-${number}`;

export type SurahBookmarkTarget = {
  kind: 'surah';
  surah: number;
  key: SurahBookmarkKey;
};

export type AyahBookmarkTarget = {
  kind: 'ayah';
  surah: number;
  ayah: number;
  key: AyahKey;
};

export type RangeBookmarkTarget = {
  kind: 'range';
  surah: number;
  startAyah: number;
  endAyah: number;
  key: RangeBookmarkKey;
};

export type BookmarkTarget = SurahBookmarkTarget | AyahBookmarkTarget | RangeBookmarkTarget;

export type QuranBookmark = {
  target: BookmarkTarget;
  createdAt: number;
};

export const BOOKMARK_STORAGE_KEY = 'iyf:quran-bookmarks:v1';

export function makeSurahTarget(surah: number): SurahBookmarkTarget {
  if (!chapterByNumber(surah)) throw new Error('Unknown surah.');
  return { kind: 'surah', surah, key: `surah:${surah}` };
}

export function makeAyahTarget(surah: number, ayah: number): AyahBookmarkTarget {
  const chapter = chapterByNumber(surah);
  if (!chapter || !Number.isInteger(ayah) || ayah < 1 || ayah > chapter.ayahCount) {
    throw new Error('Unknown ayah.');
  }
  return { kind: 'ayah', surah, ayah, key: `${surah}:${ayah}` };
}

export function makeRangeTarget(
  surah: number,
  startAyah: number,
  endAyah: number,
): RangeBookmarkTarget {
  if (startAyah === endAyah) throw new Error('A bookmark range needs at least two Ayahs.');
  const chapter = chapterByNumber(surah);
  if (
    !chapter ||
    !Number.isInteger(startAyah) ||
    !Number.isInteger(endAyah) ||
    startAyah < 1 ||
    endAyah > chapter.ayahCount ||
    startAyah > endAyah
  ) throw new Error('Unknown Ayah range.');
  return {
    kind: 'range',
    surah,
    startAyah,
    endAyah,
    key: `range:${surah}:${startAyah}-${endAyah}`,
  };
}

export function createBookmark(target: BookmarkTarget, createdAt = Date.now()): QuranBookmark {
  return { target, createdAt };
}

export function bookmarkReadingPosition(target: BookmarkTarget): { surah: number; ayah: number } {
  return {
    surah: target.surah,
    ayah: target.kind === 'surah'
      ? 1
      : target.kind === 'ayah'
        ? target.ayah
        : target.startAyah,
  };
}

export function parseBookmarks(raw: string | null): QuranBookmark[] {
  if (!raw) return [];

  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];

    const seen = new Set<string>();
    return value
      .filter(isQuranBookmark)
      .sort((left, right) => right.createdAt - left.createdAt)
      .filter((bookmark) => {
        if (seen.has(bookmark.target.key)) return false;
        seen.add(bookmark.target.key);
        return true;
      });
  } catch {
    return [];
  }
}

function isQuranBookmark(value: unknown): value is QuranBookmark {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QuranBookmark>;
  if (!Number.isFinite(candidate.createdAt)) return false;
  const target = candidate.target;
  if (!target || typeof target !== 'object') return false;

  const chapter = chapterByNumber(target.surah);
  if (!chapter) return false;

  if (target.kind === 'surah') {
    return target.key === `surah:${target.surah}`;
  }

  if (target.kind === 'range') {
    return (
      Number.isInteger(target.startAyah) &&
      Number.isInteger(target.endAyah) &&
      target.startAyah >= 1 &&
      target.endAyah <= chapter.ayahCount &&
      target.startAyah < target.endAyah &&
      target.key === `range:${target.surah}:${target.startAyah}-${target.endAyah}`
    );
  }

  return (
    target.kind === 'ayah' &&
    Number.isInteger(target.ayah) &&
    target.ayah >= 1 &&
    target.ayah <= chapter.ayahCount &&
    target.key === `${target.surah}:${target.ayah}`
  );
}
