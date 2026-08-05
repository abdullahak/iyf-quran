export function adjacentSurah(current: number, direction: -1 | 1): number | undefined {
  const candidate = current + direction;
  return candidate >= 1 && candidate <= 114 ? candidate : undefined;
}

export function finishTransition(handled: boolean, didJustFinish: boolean) {
  if (!didJustFinish) return { advance: false, handled: false };
  if (handled) return { advance: false, handled: true };
  return { advance: true, handled: true };
}

export function nextQueueIndex(
  length: number,
  currentIndex: number,
  direction: -1 | 1,
): number | undefined {
  if (!Number.isInteger(length) || !Number.isInteger(currentIndex) || length <= 0) return undefined;
  const candidate = currentIndex + direction;
  return candidate >= 0 && candidate < length ? candidate : undefined;
}

export function queueEntryStartTime(
  entry: { startAyah: number; endAyah: number },
  ayahCount: number,
  timingStart?: number,
): number | undefined {
  if (entry.startAyah === 1 && entry.endAyah === ayahCount) return 0;
  return Number.isFinite(timingStart) ? timingStart : undefined;
}

export function formatPlaybackTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
