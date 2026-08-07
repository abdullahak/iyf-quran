import {
  parseQuranPosition,
  parseReadingFocus,
  readingRouteForMushafPlaybackTransition,
  readingRouteForPlaybackTransition,
  readingRouteForPosition,
  readingRouteForResponsiveWindow,
} from './readingRoute';

describe('reading position routes', () => {
  it('opens Ayah view at the exact Ayah', () => {
    expect(readingRouteForPosition('ayah', 2, 142)).toEqual({
      pathname: '/surah/[id]',
      params: { id: '2', ayah: '142' },
    });
  });

  it.each(['classic', 'mushaf'] as const)('opens %s view on the canonical page with exact focus', (mode) => {
    expect(readingRouteForPosition(mode, 2, 142)).toEqual({
      pathname: '/mushaf/[page]',
      params: { page: '22', focus: '2:142' },
    });
  });

  it('rejects invalid Quran positions', () => {
    expect(readingRouteForPosition('ayah', 114, 7)).toBeUndefined();
  });

  it('accepts focus only when the canonical Ayah belongs to the open page', () => {
    expect(parseReadingFocus('2:142', 22)).toEqual({ surah: 2, ayah: 142 });
    expect(parseReadingFocus('2:142', 21)).toBeUndefined();
    expect(parseReadingFocus('not-an-ayah', 22)).toBeUndefined();
  });

  it('routes a preceding responsive window with an exact exclusive rejoin boundary', () => {
    const ordinaryRoute = readingRouteForPosition('mushaf', 2, 167);
    const precedingRoute = readingRouteForResponsiveWindow(
      { surah: 2, ayah: 167 },
      { surah: 3, ayah: 1 },
      { surah: 2, ayah: 286 },
    );

    expect(precedingRoute).toEqual({
      pathname: '/mushaf/[page]',
      params: {
        page: ordinaryRoute?.pathname === '/mushaf/[page]' ? ordinaryRoute.params.page : '',
        focus: '2:167',
        until: '3:1',
        initial: '2:286',
      },
    });
    expect(parseQuranPosition('3:1')).toEqual({ surah: 3, ayah: 1 });
    expect(parseQuranPosition('3:201')).toBeUndefined();
  });

  it('follows playback only when it leaves the Surah currently open in the reader', () => {
    expect(readingRouteForPlaybackTransition('ayah', 2, 2, 3, 1)).toEqual({
      pathname: '/surah/[id]',
      params: { id: '3', ayah: '1' },
    });
    expect(readingRouteForPlaybackTransition('ayah', 2, 1, 3, 1)).toBeUndefined();
    expect(readingRouteForPlaybackTransition('ayah', 2, 2, 2, 2)).toBeUndefined();
  });

  it('follows Mushaf playback only when the previous Ayah was on the open page', () => {
    expect(readingRouteForMushafPlaybackTransition(
      'classic',
      49,
      { surah: 2, ayah: 286 },
      { surah: 3, ayah: 1 },
    )).toEqual({
      pathname: '/mushaf/[page]',
      params: { page: '50', focus: '3:1' },
    });
    expect(readingRouteForMushafPlaybackTransition(
      'mushaf',
      22,
      { surah: 2, ayah: 286 },
      { surah: 3, ayah: 1 },
    )).toBeUndefined();
  });

  it('follows Classic Medina playback across pages within the same Surah', () => {
    expect(readingRouteForMushafPlaybackTransition(
      'classic',
      22,
      { surah: 2, ayah: 145 },
      { surah: 2, ayah: 146 },
    )).toEqual({
      pathname: '/mushaf/[page]',
      params: { page: '23', focus: '2:146' },
    });
  });
});
