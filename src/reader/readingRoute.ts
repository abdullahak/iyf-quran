import { medinaPageForAyah } from '@/data/pages';
import type { ReaderMode } from '@/settings/appSettings';

export type ReadingRoute =
  | {
      pathname: '/surah/[id]';
      params: { id: string; ayah: string };
    }
  | {
      pathname: '/mushaf/[page]';
      params: { page: string; focus: string; until?: string; initial?: string };
    };

export type ReadingFocus = { surah: number; ayah: number };

export function parseQuranPosition(value: unknown): ReadingFocus | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(value);
  if (!match) return undefined;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (!medinaPageForAyah(surah, ayah)) return undefined;
  return { surah, ayah };
}

export function parseReadingFocus(value: unknown, pageNumber: number): ReadingFocus | undefined {
  const position = parseQuranPosition(value);
  if (!position || medinaPageForAyah(position.surah, position.ayah)?.page !== pageNumber) {
    return undefined;
  }
  return position;
}

export function readingRouteForPosition(
  readerMode: ReaderMode,
  surah: number,
  ayah: number,
): ReadingRoute | undefined {
  const page = medinaPageForAyah(surah, ayah);
  if (!page) return undefined;
  if (readerMode === 'ayah') {
    return {
      pathname: '/surah/[id]',
      params: { id: String(surah), ayah: String(ayah) },
    };
  }
  return {
    pathname: '/mushaf/[page]',
    params: { page: String(page.page), focus: `${surah}:${ayah}` },
  };
}

export function readingRouteForResponsiveWindow(
  start: ReadingFocus,
  endExclusive?: ReadingFocus,
  initial?: ReadingFocus,
): ReadingRoute | undefined {
  const page = medinaPageForAyah(start.surah, start.ayah);
  const endPage = endExclusive
    ? medinaPageForAyah(endExclusive.surah, endExclusive.ayah)
    : undefined;
  const initialPage = initial ? medinaPageForAyah(initial.surah, initial.ayah) : undefined;
  const initialBeforeStart = initial && (
    initial.surah < start.surah ||
    (initial.surah === start.surah && initial.ayah < start.ayah)
  );
  const initialAtOrAfterEnd = initial && endExclusive && (
    initial.surah > endExclusive.surah ||
    (initial.surah === endExclusive.surah && initial.ayah >= endExclusive.ayah)
  );
  if (
    !page ||
    (initial && (!initialPage || initialBeforeStart || initialAtOrAfterEnd)) ||
    (endExclusive && (
      !endPage ||
      endExclusive.surah < start.surah ||
      (endExclusive.surah === start.surah && endExclusive.ayah <= start.ayah)
    ))
  ) return undefined;
  return {
    pathname: '/mushaf/[page]',
    params: {
      page: String(page.page),
      focus: `${start.surah}:${start.ayah}`,
      ...(endExclusive ? { until: `${endExclusive.surah}:${endExclusive.ayah}` } : {}),
      ...(initial ? { initial: `${initial.surah}:${initial.ayah}` } : {}),
    },
  };
}

export function readingRouteForPlaybackTransition(
  readerMode: ReaderMode,
  openSurah: number,
  previousPlaybackSurah: number | undefined,
  currentPlaybackSurah: number | undefined,
  currentPlaybackAyah: number | undefined,
): ReadingRoute | undefined {
  if (
    previousPlaybackSurah !== openSurah ||
    currentPlaybackSurah === undefined ||
    currentPlaybackSurah === openSurah
  ) return undefined;
  return readingRouteForPosition(
    readerMode,
    currentPlaybackSurah,
    currentPlaybackAyah ?? 1,
  );
}

export function readingRouteForMushafPlaybackTransition(
  readerMode: ReaderMode,
  openPage: number,
  previousPlayback: ReadingFocus | undefined,
  currentPlayback: ReadingFocus | undefined,
): ReadingRoute | undefined {
  const previousPage = previousPlayback
    ? medinaPageForAyah(previousPlayback.surah, previousPlayback.ayah)?.page
    : undefined;
  const currentPage = currentPlayback
    ? medinaPageForAyah(currentPlayback.surah, currentPlayback.ayah)?.page
    : undefined;
  if (
    !previousPlayback ||
    !currentPlayback ||
    previousPage !== openPage ||
    currentPage === openPage ||
    (readerMode === 'mushaf' && previousPlayback.surah === currentPlayback.surah)
  ) return undefined;
  return readingRouteForPosition(
    readerMode,
    currentPlayback.surah,
    currentPlayback.ayah,
  );
}
