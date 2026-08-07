import {
  bottomControlOffset,
  floatingPlayerBottomOffset,
} from '@/components/playerBarLayout';
import type { ReaderMode } from '@/settings/appSettings';

const READER_NAVIGATION_HEIGHT = 60;
const SELECTION_TOOLBAR_HEIGHT = 72;
const MIN_FITTED_CONTENT_HEIGHT = 180;

export type MushafReaderSurface = {
  kind: 'ayah-scroll' | 'classic-medina' | 'responsive-mushaf';
  allowsVerticalScroll: boolean;
  ownsCanonicalSwipe: boolean;
};

export function mushafReaderSurface(mode: ReaderMode): MushafReaderSurface {
  if (mode === 'classic') {
    return {
      kind: 'classic-medina',
      allowsVerticalScroll: false,
      ownsCanonicalSwipe: true,
    };
  }
  if (mode === 'mushaf') {
    return {
      kind: 'responsive-mushaf',
      allowsVerticalScroll: false,
      ownsCanonicalSwipe: false,
    };
  }
  return {
    kind: 'ayah-scroll',
    allowsVerticalScroll: true,
    ownsCanonicalSwipe: true,
  };
}

export function fittedMushafContentHeight({
  viewportHeight,
  safeAreaTop,
  safeAreaBottom,
  playerVisible,
  selectionVisible,
}: {
  viewportHeight: number;
  safeAreaTop: number;
  safeAreaBottom: number;
  playerVisible: boolean;
  selectionVisible: boolean;
}): number {
  const bodyHeight = viewportHeight - safeAreaTop - safeAreaBottom - READER_NAVIGATION_HEIGHT;
  const playerBottom = floatingPlayerBottomOffset(safeAreaBottom);
  const controlsBottom = bottomControlOffset(playerVisible, playerBottom);
  const reservedBottom = selectionVisible
    ? controlsBottom + SELECTION_TOOLBAR_HEIGHT - safeAreaBottom
    : playerVisible
      ? controlsBottom - safeAreaBottom
      : 0;
  return Math.max(MIN_FITTED_CONTENT_HEIGHT, Math.floor(bodyHeight - reservedBottom));
}
