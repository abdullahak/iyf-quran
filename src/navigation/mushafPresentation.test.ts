import { MUSHAF_PRESENTATION_OPTIONS } from './mushafPresentation';

describe('Mushaf presentation', () => {
  it('reserves horizontal gestures for Quran page turns', () => {
    expect(MUSHAF_PRESENTATION_OPTIONS).toMatchObject({
      animation: 'none',
      gestureEnabled: false,
      fullScreenGestureEnabled: false,
    });
  });
});
