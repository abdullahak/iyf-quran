import { createQueueEntry, type PlaybackQueueEntry } from './playbackLibrary';
import type { JuzSurahSegment } from '@/data/juz';
import { medinaPageSegments } from '@/data/pages';

export function listenEntriesForPage(page: number): PlaybackQueueEntry[] {
  if (!Number.isInteger(page) || page < 1 || page > 604) return [];
  return medinaPageSegments(page).map((segment) => createQueueEntry(
    segment.surah,
    segment.startAyah,
    segment.endAyah,
    `listen:page:${page}:${segment.surah}:${segment.startAyah}-${segment.endAyah}`,
  ));
}

export function listenEntryForJuzSegment(
  juz: number,
  segment: JuzSurahSegment,
): PlaybackQueueEntry {
  return createQueueEntry(
    segment.chapter.number,
    segment.startAyah,
    segment.endAyah,
    `listen:juz:${juz}:${segment.chapter.number}:${segment.startAyah}-${segment.endAyah}`,
  );
}
