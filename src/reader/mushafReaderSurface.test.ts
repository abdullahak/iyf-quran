import {
  fittedMushafContentHeight,
  mushafReaderSurface,
} from './mushafReaderSurface';

describe('Mushaf reader surfaces', () => {
  it('keeps the three reading modes behaviorally distinct', () => {
    expect(mushafReaderSurface('ayah')).toEqual({
      kind: 'ayah-scroll',
      allowsVerticalScroll: true,
      ownsCanonicalSwipe: true,
    });
    expect(mushafReaderSurface('classic')).toEqual({
      kind: 'classic-medina',
      allowsVerticalScroll: false,
      ownsCanonicalSwipe: true,
    });
    expect(mushafReaderSurface('mushaf')).toEqual({
      kind: 'responsive-mushaf',
      allowsVerticalScroll: false,
      ownsCanonicalSwipe: false,
    });
  });

  it('reserves the global player and selection toolbar from no-scroll content', () => {
    const base = fittedMushafContentHeight({
      viewportHeight: 844,
      safeAreaTop: 47,
      safeAreaBottom: 34,
      playerVisible: false,
      selectionVisible: false,
    });
    const withPlayer = fittedMushafContentHeight({
      viewportHeight: 844,
      safeAreaTop: 47,
      safeAreaBottom: 34,
      playerVisible: true,
      selectionVisible: false,
    });
    const withPlayerAndSelection = fittedMushafContentHeight({
      viewportHeight: 844,
      safeAreaTop: 47,
      safeAreaBottom: 34,
      playerVisible: true,
      selectionVisible: true,
    });

    expect(withPlayer).toBeLessThan(base);
    expect(withPlayerAndSelection).toBeLessThan(withPlayer);
    expect(withPlayer - withPlayerAndSelection).toBe(72);
  });
});
