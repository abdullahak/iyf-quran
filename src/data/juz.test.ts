import { JUZ_SECTIONS } from './juz';

describe('Juz sections', () => {
  it('covers all 30 Juz and every Hafs ayah exactly once', () => {
    expect(JUZ_SECTIONS).toHaveLength(30);
    expect(JUZ_SECTIONS.map((section) => section.juz)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
    expect(
      JUZ_SECTIONS.flatMap((section) => section.segments).reduce(
        (total, segment) => total + segment.endAyah - segment.startAyah + 1,
        0,
      ),
    ).toBe(6236);
  });

  it('represents Surahs spanning Juz boundaries as exact Ayah ranges', () => {
    expect(JUZ_SECTIONS[0].segments.map(({ chapter, startAyah, endAyah }) => ({
      surah: chapter.number,
      startAyah,
      endAyah,
    }))).toEqual([
      { surah: 1, startAyah: 1, endAyah: 7 },
      { surah: 2, startAyah: 1, endAyah: 141 },
    ]);
    expect(JUZ_SECTIONS[1].segments.map(({ chapter, startAyah, endAyah }) => ({
      surah: chapter.number,
      startAyah,
      endAyah,
    }))).toEqual([{ surah: 2, startAyah: 142, endAyah: 252 }]);
    expect(JUZ_SECTIONS[2].segments.map(({ chapter, startAyah, endAyah }) => ({
      surah: chapter.number,
      startAyah,
      endAyah,
    }))).toEqual([
      { surah: 2, startAyah: 253, endAyah: 286 },
      { surah: 3, startAyah: 1, endAyah: 92 },
    ]);
  });

  it('ends Juz 30 at the final Ayah of An-Naas', () => {
    const finalSegment = JUZ_SECTIONS[29].segments.at(-1);
    expect(finalSegment && {
      surah: finalSegment.chapter.number,
      startAyah: finalSegment.startAyah,
      endAyah: finalSegment.endAyah,
    }).toEqual({ surah: 114, startAyah: 1, endAyah: 6 });
  });
});
