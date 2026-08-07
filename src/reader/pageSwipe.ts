const MIN_CAPTURE_DISTANCE = 12;
const HORIZONTAL_DOMINANCE = 1.35;
const PAGE_TURN_DISTANCE = 56;
const PAGE_TURN_VELOCITY = 0.55;
const FIRST_MEDINA_PAGE = 1;
const LAST_MEDINA_PAGE = 604;

export type PageTurn = {
  targetPage: number;
  direction: 'next' | 'previous';
  exitEdge: 'left' | 'right';
  enterEdge: 'left' | 'right';
};

export function shouldCapturePageSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) >= MIN_CAPTURE_DISTANCE
    && Math.abs(dx) > Math.abs(dy) * HORIZONTAL_DOMINANCE;
}

export function pageDeltaAfterSwipe(dx: number, velocityX: number): -1 | 1 | undefined {
  if (Math.abs(dx) < PAGE_TURN_DISTANCE && Math.abs(velocityX) < PAGE_TURN_VELOCITY) {
    return undefined;
  }

  const direction = Math.abs(dx) >= MIN_CAPTURE_DISTANCE
    ? Math.sign(dx)
    : Math.sign(velocityX);
  return direction === 0 ? undefined : direction > 0 ? 1 : -1;
}

export function pageAfterSwipe(
  currentPage: number,
  dx: number,
  velocityX: number,
): number | undefined {
  const delta = pageDeltaAfterSwipe(dx, velocityX);
  if (delta === undefined) return undefined;
  const target = currentPage + delta;
  return target >= FIRST_MEDINA_PAGE && target <= LAST_MEDINA_PAGE
    ? target
    : undefined;
}

export function pageTurnAfterSwipe(
  currentPage: number,
  dx: number,
  velocityX: number,
): PageTurn | undefined {
  const targetPage = pageAfterSwipe(currentPage, dx, velocityX);
  if (targetPage === undefined) return undefined;
  const direction = targetPage > currentPage ? 'next' : 'previous';
  return direction === 'next'
    ? { targetPage, direction, exitEdge: 'right', enterEdge: 'left' }
    : { targetPage, direction, exitEdge: 'left', enterEdge: 'right' };
}

export function pageTurnOffsets(
  direction: PageTurn['direction'],
  viewportWidth: number,
): { exitX: number; enterX: number } {
  return direction === 'next'
    ? { exitX: viewportWidth, enterX: -viewportWidth }
    : { exitX: -viewportWidth, enterX: viewportWidth };
}
