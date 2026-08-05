import {
  RECENT_PAGES_STORAGE_KEY,
  addRecentPage,
  createRecentPage,
  parseRecentPages,
} from './recentPages';

describe('recent Quran pages', () => {
  it('derives the canonical Medina page from a Surah/Ayah position', () => {
    expect(RECENT_PAGES_STORAGE_KEY).toBe('quran:recent-pages:v1');
    expect(createRecentPage(2, 6, 100)).toEqual({
      page: 3,
      surah: 2,
      ayah: 6,
      viewedAt: 100,
    });
    expect(() => createRecentPage(114, 7)).toThrow(RangeError);
  });

  it('keeps the newest position per page and caps the list', () => {
    const pages = [
      createRecentPage(1, 1, 10),
      createRecentPage(2, 1, 20),
      createRecentPage(2, 6, 30),
      createRecentPage(2, 17, 40),
      createRecentPage(2, 25, 50),
      createRecentPage(2, 30, 60),
    ];
    const updated = addRecentPage(pages, createRecentPage(1, 7, 70), 5);
    expect(updated).toHaveLength(5);
    expect(updated[0]).toEqual({ page: 1, surah: 1, ayah: 7, viewedAt: 70 });
    expect(updated.filter((entry) => entry.page === 1)).toHaveLength(1);
    expect(updated.map((entry) => entry.viewedAt)).toEqual([70, 60, 50, 40, 30]);
  });

  it('validates, sorts, and deduplicates persisted history', () => {
    expect(parseRecentPages(JSON.stringify([
      { page: 2, surah: 2, ayah: 1, viewedAt: 10 },
      { page: 2, surah: 2, ayah: 5, viewedAt: 30 },
      { page: 604, surah: 114, ayah: 6, viewedAt: 20 },
      { page: 604, surah: 1, ayah: 1, viewedAt: 99 },
      { page: 0, surah: 1, ayah: 1, viewedAt: 100 },
    ]))).toEqual([
      { page: 2, surah: 2, ayah: 5, viewedAt: 30 },
      { page: 604, surah: 114, ayah: 6, viewedAt: 20 },
    ]);
    expect(parseRecentPages('{broken')).toEqual([]);
  });
});
