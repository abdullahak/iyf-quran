import { medinaPageForAyah } from '@/data/pages';

export const RECENT_PAGES_STORAGE_KEY = 'quran:recent-pages:v1';
export const MAX_RECENT_PAGES = 6;

export type RecentPage = {
  page: number;
  surah: number;
  ayah: number;
  viewedAt: number;
};

export function createRecentPage(
  surah: number,
  ayah: number,
  viewedAt = Date.now(),
): RecentPage {
  const page = medinaPageForAyah(surah, ayah);
  if (!page || !Number.isFinite(viewedAt)) throw new RangeError('Unknown Quran reading position.');
  return { page: page.page, surah, ayah, viewedAt };
}

export function addRecentPage(
  current: readonly RecentPage[],
  next: RecentPage,
  limit = MAX_RECENT_PAGES,
): RecentPage[] {
  return [next, ...current.filter((entry) => entry.page !== next.page)]
    .sort((left, right) => right.viewedAt - left.viewedAt)
    .slice(0, Math.max(0, limit));
}

export function parseRecentPages(raw: string | null): RecentPage[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    const seen = new Set<number>();
    return value
      .filter(isRecentPage)
      .sort((left, right) => right.viewedAt - left.viewedAt)
      .filter((entry) => {
        if (seen.has(entry.page)) return false;
        seen.add(entry.page);
        return true;
      })
      .slice(0, MAX_RECENT_PAGES);
  } catch {
    return [];
  }
}

function isRecentPage(value: unknown): value is RecentPage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RecentPage>;
  if (
    !Number.isInteger(candidate.page) ||
    !Number.isInteger(candidate.surah) ||
    !Number.isInteger(candidate.ayah) ||
    !Number.isFinite(candidate.viewedAt)
  ) return false;
  return medinaPageForAyah(candidate.surah!, candidate.ayah!)?.page === candidate.page;
}
