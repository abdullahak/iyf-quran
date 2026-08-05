import { CHAPTERS } from './chapters';
import {
  MEDINA_PAGES,
  medinaPage,
  medinaPageForAyah,
  medinaPageSegments,
} from './pages';

describe('Hafs Medina page metadata', () => {
  it('contains the canonical 604-page boundaries', () => {
    expect(MEDINA_PAGES).toHaveLength(604);
    expect(medinaPage(1)).toEqual({ page: 1, first: [1, 1], last: [1, 7] });
    expect(medinaPage(2)).toEqual({ page: 2, first: [2, 1], last: [2, 5] });
    expect(medinaPage(50)).toEqual({ page: 50, first: [3, 1], last: [3, 9] });
    expect(medinaPage(604)).toEqual({ page: 604, first: [112, 1], last: [114, 6] });
  });

  it('locates canonical ayahs without relying on API-provided page values', () => {
    expect(medinaPageForAyah(1, 1)?.page).toBe(1);
    expect(medinaPageForAyah(2, 5)?.page).toBe(2);
    expect(medinaPageForAyah(2, 6)?.page).toBe(3);
    expect(medinaPageForAyah(114, 6)?.page).toBe(604);
    expect(medinaPageForAyah(114, 7)).toBeUndefined();
  });

  it('expands a page into ordered Surah/Ayah segments', () => {
    expect(medinaPageSegments(604)).toEqual([
      { surah: 112, startAyah: 1, endAyah: 4 },
      { surah: 113, startAyah: 1, endAyah: 5 },
      { surah: 114, startAyah: 1, endAyah: 6 },
    ]);
  });

  it('covers all 6,236 canonical ayahs exactly once', () => {
    const keys = MEDINA_PAGES.flatMap(({ page }) =>
      medinaPageSegments(page).flatMap((segment) =>
        Array.from(
          { length: segment.endAyah - segment.startAyah + 1 },
          (_, index) => `${segment.surah}:${segment.startAyah + index}`,
        ),
      ),
    );
    expect(keys).toHaveLength(CHAPTERS.reduce((total, chapter) => total + chapter.ayahCount, 0));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('rejects non-canonical page numbers', () => {
    expect(medinaPage(0)).toBeUndefined();
    expect(medinaPage(605)).toBeUndefined();
    expect(medinaPageSegments(605)).toEqual([]);
  });
});
