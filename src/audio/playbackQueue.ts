export function adjacentSurah(current: number, direction: -1 | 1): number | undefined {
  const candidate = current + direction;
  return candidate >= 1 && candidate <= 114 ? candidate : undefined;
}

export function finishTransition(handled: boolean, didJustFinish: boolean) {
  if (!didJustFinish) return { advance: false, handled: false };
  if (handled) return { advance: false, handled: true };
  return { advance: true, handled: true };
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
