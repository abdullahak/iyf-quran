import { recitationTrack } from './reciter';
import { VERIFIED_TIMING_INDEXES } from './verifiedTimingIndexes';

export type AyahTiming = {
  ayah: number;
  start: number;
  end: number;
  confidence: number;
  verified: boolean;
};

export type TimingReviewStatus = 'candidate' | 'reviewed' | 'verified';

export type AyahTimingPoint = {
  key: `${number}:${number}`;
  ayah: number;
  startMs: number;
  confidence: number;
  reviewStatus: TimingReviewStatus;
};

export type SurahTimingIndex = {
  schemaVersion: 1;
  surah: number;
  audioSha256: string;
  durationMs: number;
  prelude?: {
    kind: 'basmala' | 'silence' | 'other';
    startMs: number;
    endMs: number;
  };
  source: {
    method: string;
    model?: string;
    generationConfig?: string;
    generatedAt: string;
    lastReviewedAt?: string;
  };
  reviewStatus: TimingReviewStatus;
  ayahs: readonly AyahTimingPoint[];
};

export function validateTimings(timings: readonly AyahTiming[]): boolean {
  return timings.every((timing, index) => {
    const previous = timings[index - 1];
    return (
      timing.ayah === index + 1 &&
      timing.start >= 0 &&
      timing.end > timing.start &&
      timing.confidence >= 0 &&
      timing.confidence <= 1 &&
      (!previous || timing.start >= previous.end)
    );
  });
}

export function activeAyahAt(
  timings: readonly AyahTiming[] | undefined,
  seconds: number,
): number | undefined {
  if (!timings || !Number.isFinite(seconds) || seconds < 0) return undefined;
  return timings.find((timing) => seconds >= timing.start && seconds < timing.end)?.ayah;
}

export function compileVerifiedTimingIndex(
  index: SurahTimingIndex,
  expected: { audioSha256: string; ayahCount: number },
): AyahTiming[] | undefined {
  if (
    index.schemaVersion !== 1 ||
    index.reviewStatus !== 'verified' ||
    index.audioSha256 !== expected.audioSha256 ||
    !Number.isFinite(index.durationMs) ||
    index.durationMs <= 0 ||
    index.ayahs.length !== expected.ayahCount
  ) {
    return undefined;
  }

  const timings = index.ayahs.map((point, indexInSurah) => {
    const next = index.ayahs[indexInSurah + 1];
    if (
      point.ayah !== indexInSurah + 1 ||
      point.key !== `${index.surah}:${point.ayah}` ||
      point.reviewStatus !== 'verified' ||
      !Number.isFinite(point.startMs) ||
      point.startMs < 0 ||
      point.startMs >= index.durationMs
    ) {
      return undefined;
    }
    return {
      ayah: point.ayah,
      start: point.startMs / 1000,
      end: (next?.startMs ?? index.durationMs) / 1000,
      confidence: point.confidence,
      verified: true,
    } satisfies AyahTiming;
  });

  if (timings.some((timing) => !timing)) return undefined;
  const complete = timings as AyahTiming[];
  return validateTimings(complete) ? complete : undefined;
}

export function compileVerifiedTimingRegistry(
  indexes: Readonly<Partial<Record<number, SurahTimingIndex>>>,
): Readonly<Partial<Record<number, readonly AyahTiming[]>>> {
  const compiled: Partial<Record<number, readonly AyahTiming[]>> = {};
  Object.entries(indexes).forEach(([surahKey, index]) => {
    const surah = Number(surahKey);
    if (!index || index.surah !== surah) return;
    try {
      const track = recitationTrack({ number: surah });
      const timings = compileVerifiedTimingIndex(index, {
        audioSha256: track.sha256,
        ayahCount: track.ayahCount,
      });
      if (timings) compiled[surah] = timings;
    } catch {
      // Invalid/non-canonical registry entries remain unavailable at runtime.
    }
  });
  return compiled;
}

// The generated registry remains empty until a complete manifest clears the publish gate.
export const VERIFIED_TIMINGS = compileVerifiedTimingRegistry(VERIFIED_TIMING_INDEXES);
