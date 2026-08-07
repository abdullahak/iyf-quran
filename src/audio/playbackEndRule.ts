import { chapterByNumber } from '@/data/chapters';
import { JUZ_SECTIONS } from '@/data/juz';
import { medinaPageForAyah } from '@/data/pages';

export type PlaybackScope = 'continuous' | 'quran' | 'surah' | 'page' | 'juz';
export type QuranEndPosition = { surah: number; ayah: number };

export type PlaybackEndRule =
  | { kind: 'continuous' }
  | { kind: 'quran' }
  | { kind: 'surah' }
  | { kind: 'page'; page: number; end: QuranEndPosition }
  | { kind: 'juz'; juz: number; end: QuranEndPosition }
  | { kind: 'timer'; durationMinutes: number; endsAt: number };

export function createPlaybackEndRule(
  scope: PlaybackScope,
  surah: number,
  ayah: number,
): PlaybackEndRule {
  assertQuranPosition(surah, ayah);
  if (scope === 'continuous' || scope === 'quran' || scope === 'surah') return { kind: scope };
  if (scope === 'page') {
    const page = medinaPageForAyah(surah, ayah);
    if (!page) throw new RangeError('Unknown Medina page position.');
    return { kind: 'page', page: page.page, end: { surah: page.last[0], ayah: page.last[1] } };
  }
  const juz = JUZ_SECTIONS.find((section) =>
    comparePosition([surah, ayah], section.first) >= 0 &&
    comparePosition([surah, ayah], section.last) <= 0,
  );
  if (!juz) throw new RangeError('Unknown Juz position.');
  return { kind: 'juz', juz: juz.juz, end: { surah: juz.last[0], ayah: juz.last[1] } };
}

export function createSleepTimerRule(
  durationMinutes: number,
  now = Date.now(),
): PlaybackEndRule & { kind: 'timer' } {
  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 180 ||
    !Number.isFinite(now)
  ) throw new RangeError('Sleep timer must be between 1 and 180 minutes.');
  return {
    kind: 'timer',
    durationMinutes,
    endsAt: now + durationMinutes * 60_000,
  };
}

export function rebasePlaybackEndRule(
  rule: PlaybackEndRule,
  surah: number,
  ayah: number,
): PlaybackEndRule {
  return rule.kind === 'page' || rule.kind === 'juz'
    ? createPlaybackEndRule(rule.kind, surah, ayah)
    : rule;
}

export function isSleepTimerExpired(rule: PlaybackEndRule, now = Date.now()): boolean {
  return rule.kind === 'timer' && now >= rule.endsAt;
}

export function isSleepTimerSelected(
  rule: PlaybackEndRule,
  durationMinutes: number | undefined,
): boolean {
  return durationMinutes === undefined
    ? rule.kind !== 'timer'
    : rule.kind === 'timer' && rule.durationMinutes === durationMinutes;
}

export function shouldStopAtAyahEnd(
  rule: PlaybackEndRule,
  surah: number,
  ayah: number,
): boolean {
  return (rule.kind === 'page' || rule.kind === 'juz') &&
    rule.end.surah === surah &&
    rule.end.ayah === ayah;
}

export function shouldAdvanceAfterSurah(rule: PlaybackEndRule, finishedSurah: number): boolean {
  if (rule.kind === 'surah') return false;
  if (rule.kind === 'page' || rule.kind === 'juz') return finishedSurah < rule.end.surah;
  return true;
}

function assertQuranPosition(surah: number, ayah: number): void {
  const chapter = chapterByNumber(surah);
  if (!chapter || !Number.isInteger(ayah) || ayah < 1 || ayah > chapter.ayahCount) {
    throw new RangeError('Unknown Quran position.');
  }
}

function comparePosition(
  left: readonly [number, number],
  right: readonly [number, number],
): number {
  return left[0] === right[0] ? left[1] - right[1] : left[0] - right[0];
}
