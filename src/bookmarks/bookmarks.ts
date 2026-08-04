import { chapterByNumber } from '@/data/chapters';

export type AyahKey = `${number}:${number}`;
export type SurahBookmarkKey = `surah:${number}`;

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

export type BookmarkTarget = SurahBookmarkTarget | AyahBookmarkTarget;

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

export function createBookmark(target: BookmarkTarget, createdAt = Date.now()): QuranBookmark {
  return { target, createdAt };
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

  return (
    target.kind === 'ayah' &&
    Number.isInteger(target.ayah) &&
    target.ayah >= 1 &&
    target.ayah <= chapter.ayahCount &&
    target.key === `${target.surah}:${target.ayah}`
  );
}
