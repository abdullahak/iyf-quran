import {
  bookmarkReadingPosition,
  createBookmark,
  makeAyahTarget,
  makeRangeTarget,
  makeSurahTarget,
  parseBookmarks,
} from './bookmarks';

describe('Quran bookmarks', () => {
  it('uses stable canonical keys for surahs and ayahs', () => {
    expect(makeSurahTarget(18)).toEqual({ kind: 'surah', surah: 18, key: 'surah:18' });
    expect(makeAyahTarget(18, 10)).toEqual({ kind: 'ayah', surah: 18, ayah: 10, key: '18:10' });
    expect(makeRangeTarget(18, 10, 16)).toEqual({
      kind: 'range',
      surah: 18,
      startAyah: 10,
      endAyah: 16,
      key: 'range:18:10-16',
    });
  });

  it('rejects targets outside canonical Quran metadata', () => {
    expect(() => makeSurahTarget(115)).toThrow('Unknown surah.');
    expect(() => makeAyahTarget(1, 8)).toThrow('Unknown ayah.');
    expect(() => makeRangeTarget(1, 4, 4)).toThrow('A bookmark range needs at least two Ayahs.');
    expect(() => makeRangeTarget(1, 7, 8)).toThrow('Unknown Ayah range.');
  });

  it('opens each bookmark type at its canonical reading position', () => {
    expect(bookmarkReadingPosition(makeSurahTarget(18))).toEqual({ surah: 18, ayah: 1 });
    expect(bookmarkReadingPosition(makeAyahTarget(18, 10))).toEqual({ surah: 18, ayah: 10 });
    expect(bookmarkReadingPosition(makeRangeTarget(18, 10, 16))).toEqual({ surah: 18, ayah: 10 });
  });

  it('parses, sorts, validates, and deduplicates persisted bookmarks', () => {
    const older = createBookmark(makeAyahTarget(1, 1), 10);
    const newer = createBookmark(makeSurahTarget(2), 30);
    const duplicate = createBookmark(makeAyahTarget(1, 1), 20);
    const range = createBookmark(makeRangeTarget(2, 2, 4), 25);
    const invalid = {
      target: { kind: 'ayah', surah: 1, ayah: 8, key: '1:8' },
      createdAt: 40,
    };

    expect(parseBookmarks(JSON.stringify([older, newer, range, duplicate, invalid]))).toEqual([
      newer,
      range,
      duplicate,
    ]);
  });

  it('recovers safely from malformed storage', () => {
    expect(parseBookmarks('{not-json')).toEqual([]);
    expect(parseBookmarks(null)).toEqual([]);
  });
});
