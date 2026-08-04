import {
  createBookmark,
  makeAyahTarget,
  makeSurahTarget,
  parseBookmarks,
} from './bookmarks';

describe('Quran bookmarks', () => {
  it('uses stable canonical keys for surahs and ayahs', () => {
    expect(makeSurahTarget(18)).toEqual({ kind: 'surah', surah: 18, key: 'surah:18' });
    expect(makeAyahTarget(18, 10)).toEqual({ kind: 'ayah', surah: 18, ayah: 10, key: '18:10' });
  });

  it('rejects targets outside canonical Quran metadata', () => {
    expect(() => makeSurahTarget(115)).toThrow('Unknown surah.');
    expect(() => makeAyahTarget(1, 8)).toThrow('Unknown ayah.');
  });

  it('parses, sorts, validates, and deduplicates persisted bookmarks', () => {
    const older = createBookmark(makeAyahTarget(1, 1), 10);
    const newer = createBookmark(makeSurahTarget(2), 30);
    const duplicate = createBookmark(makeAyahTarget(1, 1), 20);
    const invalid = {
      target: { kind: 'ayah', surah: 1, ayah: 8, key: '1:8' },
      createdAt: 40,
    };

    expect(parseBookmarks(JSON.stringify([older, newer, duplicate, invalid]))).toEqual([
      newer,
      duplicate,
    ]);
  });

  it('recovers safely from malformed storage', () => {
    expect(parseBookmarks('{not-json')).toEqual([]);
    expect(parseBookmarks(null)).toEqual([]);
  });
});
