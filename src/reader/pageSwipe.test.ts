import {
  pageAfterSwipe,
  pageDeltaAfterSwipe,
  pageTurnAfterSwipe,
  pageTurnOffsets,
  shouldCapturePageSwipe,
} from './pageSwipe';

describe('Mushaf page swipes', () => {
  it('captures deliberate horizontal movement without stealing vertical scrolling', () => {
    expect(shouldCapturePageSwipe(72, 18)).toBe(true);
    expect(shouldCapturePageSwipe(18, 72)).toBe(false);
    expect(shouldCapturePageSwipe(30, 26)).toBe(false);
  });

  it('moves to the adjacent page for distance or velocity-qualified swipes', () => {
    expect(pageAfterSwipe(200, -72, -0.2)).toBe(199);
    expect(pageAfterSwipe(200, 72, 0.2)).toBe(201);
    expect(pageAfterSwipe(200, -20, -0.7)).toBe(199);
    expect(pageAfterSwipe(200, 20, 0.7)).toBe(201);
  });

  it('exposes the same qualified delta to responsive screen pagination', () => {
    expect(pageDeltaAfterSwipe(-72, -0.2)).toBe(-1);
    expect(pageDeltaAfterSwipe(72, 0.2)).toBe(1);
    expect(pageDeltaAfterSwipe(20, 0.2)).toBeUndefined();
  });

  it('treats a rightward Quran page turn as next and mirrors its physical transition', () => {
    expect(pageTurnAfterSwipe(200, 72, 0.2)).toEqual({
      targetPage: 201,
      direction: 'next',
      exitEdge: 'right',
      enterEdge: 'left',
    });
  });

  it('uses opposite exit and entry offsets for next and previous animations', () => {
    expect(pageTurnOffsets('next', 390)).toEqual({ exitX: 390, enterX: -390 });
    expect(pageTurnOffsets('previous', 390)).toEqual({ exitX: -390, enterX: 390 });
  });

  it('ignores incomplete gestures and never crosses the canonical page bounds', () => {
    expect(pageAfterSwipe(200, -30, -0.2)).toBeUndefined();
    expect(pageAfterSwipe(1, -80, -0.8)).toBeUndefined();
    expect(pageAfterSwipe(604, 80, 0.8)).toBeUndefined();
  });
});
