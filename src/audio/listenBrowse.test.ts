import { JUZ_SECTIONS } from '@/data/juz';

import { listenEntryForJuzSegment, listenEntriesForPage } from './listenBrowse';

describe('Listen browse queue targets', () => {
  it('creates an exact canonical queue entry for a page contained in one Surah', () => {
    expect(listenEntriesForPage(2)).toEqual([
      { id: 'listen:page:2:2:1-5', surah: 2, startAyah: 1, endAyah: 5 },
    ]);
  });

  it('preserves every Surah segment when a Medina page crosses a Surah boundary', () => {
    expect(listenEntriesForPage(106)).toEqual([
      { id: 'listen:page:106:4:176-176', surah: 4, startAyah: 176, endAyah: 176 },
      { id: 'listen:page:106:5:1-2', surah: 5, startAyah: 1, endAyah: 2 },
    ]);
  });

  it('creates an exact target for a selected Juz Surah segment', () => {
    const segment = JUZ_SECTIONS[0]!.segments[1]!;
    expect(listenEntryForJuzSegment(1, segment)).toEqual({
      id: `listen:juz:1:${segment.chapter.number}:${segment.startAyah}-${segment.endAyah}`,
      surah: segment.chapter.number,
      startAyah: segment.startAyah,
      endAyah: segment.endAyah,
    });
  });

  it('rejects pages outside the canonical 1–604 range', () => {
    expect(listenEntriesForPage(0)).toEqual([]);
    expect(listenEntriesForPage(605)).toEqual([]);
  });
});
