import {
  activeAyahAt,
  compileVerifiedTimingIndex,
  compileVerifiedTimingRegistry,
  VERIFIED_TIMINGS,
  validateTimings,
  type AyahTiming,
  type SurahTimingIndex,
} from './timings';

const timings: AyahTiming[] = [
  { ayah: 1, start: 0.5, end: 3.2, confidence: 0.98, verified: true },
  { ayah: 2, start: 3.2, end: 7.9, confidence: 0.96, verified: true },
];

const timingIndex: SurahTimingIndex = {
  schemaVersion: 1,
  surah: 1,
  audioSha256: 'exact-audio-hash',
  durationMs: 7900,
  source: { method: 'forced-alignment-plus-review', generatedAt: '2026-08-04T00:00:00Z' },
  reviewStatus: 'verified',
  ayahs: [
    { key: '1:1', ayah: 1, startMs: 500, confidence: 0.98, reviewStatus: 'verified' },
    { key: '1:2', ayah: 2, startMs: 3200, confidence: 0.96, reviewStatus: 'verified' },
  ],
};

describe('ayah timing helpers', () => {
  it('selects an ayah at inclusive start and exclusive end boundaries', () => {
    expect(activeAyahAt(timings, 0.49)).toBeUndefined();
    expect(activeAyahAt(timings, 0.5)).toBe(1);
    expect(activeAyahAt(timings, 3.199)).toBe(1);
    expect(activeAyahAt(timings, 3.2)).toBe(2);
    expect(activeAyahAt(timings, 7.9)).toBeUndefined();
  });

  it('rejects invalid, overlapping, or out-of-order timing maps', () => {
    expect(validateTimings(timings)).toBe(true);
    expect(
      validateTimings([
        timings[0],
        { ayah: 3, start: 3, end: 4, confidence: 1.1, verified: false },
      ]),
    ).toBe(false);
  });

  it('compiles only a complete, reviewed index locked to the expected MP3 hash', () => {
    expect(
      compileVerifiedTimingIndex(timingIndex, {
        audioSha256: 'exact-audio-hash',
        ayahCount: 2,
      }),
    ).toEqual(timings);
    expect(
      compileVerifiedTimingIndex(timingIndex, {
        audioSha256: 'different-encoding',
        ayahCount: 2,
      }),
    ).toBeUndefined();
    expect(
      compileVerifiedTimingIndex(
        { ...timingIndex, reviewStatus: 'candidate' },
        { audioSha256: 'exact-audio-hash', ayahCount: 2 },
      ),
    ).toBeUndefined();
  });

  it('keeps the production registry empty until a verified corpus-locked index is published', () => {
    expect(VERIFIED_TIMINGS).toEqual({});
    const verifiedFatiha: SurahTimingIndex = {
      ...timingIndex,
      audioSha256: '2051e2bdcc7d37ed01db0fba4326be49ca470d62b67c655b1a0b2334db5453fe',
      durationMs: 37016,
      ayahs: [609, 5630, 8700, 10400, 14510, 17600, 22486].map((startMs, index) => ({
        key: `1:${index + 1}` as `${number}:${number}`,
        ayah: index + 1,
        startMs,
        confidence: 1,
        reviewStatus: 'verified' as const,
      })),
    };
    expect(compileVerifiedTimingRegistry({ 1: verifiedFatiha })[1]).toHaveLength(7);
    expect(
      compileVerifiedTimingRegistry({
        1: { ...verifiedFatiha, audioSha256: 'wrong-track' },
      }),
    ).toEqual({});
  });
});
