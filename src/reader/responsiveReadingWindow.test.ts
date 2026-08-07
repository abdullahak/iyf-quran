import {
  immediatelyPreviousResponsiveReadingPosition,
  nextResponsiveReadingPosition,
  previousResponsiveReadingPosition,
  responsiveReadingWindow,
} from './responsiveReadingWindow';

describe('responsive reading window', () => {
  it('continues page 1 beyond Al-Fatiha instead of leaving the viewport sparse', () => {
    const window = responsiveReadingWindow({ surah: 1, ayah: 1 });

    expect(window).toEqual([
      { surah: 1, startAyah: 1, endAyah: 7 },
      { surah: 2, startAyah: 1, endAyah: 286 },
    ]);
    expect(nextResponsiveReadingPosition(window)).toEqual({ surah: 3, ayah: 1 });
  });

  it('starts at the exact requested Ayah and buffers following Surahs without duplication', () => {
    const window = responsiveReadingWindow({ surah: 2, ayah: 250 });

    expect(window[0]).toEqual({ surah: 2, startAyah: 250, endAyah: 286 });
    expect(window[1]).toEqual({ surah: 3, startAyah: 1, endAyah: 200 });
    expect(nextResponsiveReadingPosition(window)).toEqual({ surah: 4, ayah: 1 });
  });

  it('stops cleanly at the end of the Quran', () => {
    const window = responsiveReadingWindow({ surah: 114, ayah: 5 });

    expect(window).toEqual([{ surah: 114, startAyah: 5, endAyah: 6 }]);
    expect(nextResponsiveReadingPosition(window)).toBeUndefined();
  });

  it('builds a preceding window that rejoins the current first Ayah exactly', () => {
    const current = { surah: 3, ayah: 1 };
    const previous = previousResponsiveReadingPosition(current);

    expect(previous).toEqual({ surah: 2, ayah: 167 });
    const previousWindow = responsiveReadingWindow(previous!, 120, current);
    expect(previousWindow).toEqual([{ surah: 2, startAyah: 167, endAyah: 286 }]);
    expect(nextResponsiveReadingPosition(previousWindow)).toEqual(current);
    expect(immediatelyPreviousResponsiveReadingPosition(current)).toEqual({ surah: 2, ayah: 286 });
  });

  it('has no preceding responsive window before the first Ayah', () => {
    expect(previousResponsiveReadingPosition({ surah: 1, ayah: 1 })).toBeUndefined();
  });
});
