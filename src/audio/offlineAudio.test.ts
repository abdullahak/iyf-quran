import { recitationTrack } from './reciter';
import {
  OFFLINE_AUDIO_STORAGE_KEY,
  canStartOfflineDownload,
  claimOfflineDownloads,
  consumeCancelledDownloads,
  formatOfflineAudioBytes,
  markOfflineCancellation,
  offlineAudioAction,
  offlineDownloadsAvailable,
  offlineAudioUrl,
  parseOfflineAudioRecords,
  releaseOfflineDownloads,
  shouldDeletePromotedDownload,
  summarizeOfflineAudio,
  type OfflineAudioRecord,
} from './offlineAudio';

describe('offline recitation metadata', () => {
  it('exposes cancel while a Surah download is active', () => {
    expect(offlineAudioAction(false, undefined)).toBe('select');
    expect(offlineAudioAction(false, 0.4)).toBe('cancel');
    expect(offlineAudioAction(true, 1)).toBe('remove');
  });

  it('exposes offline actions only for a capable reciter on native platforms', () => {
    expect(offlineDownloadsAvailable('ios', true)).toBe(true);
    expect(offlineDownloadsAvailable('android', true)).toBe(true);
    expect(offlineDownloadsAvailable('web', true)).toBe(false);
    expect(offlineDownloadsAvailable('ios', false)).toBe(false);
  });

  it('prevents duplicate batch submissions while a selection is active', () => {
    expect(canStartOfflineDownload(1, false)).toBe(true);
    expect(canStartOfflineDownload(0, false)).toBe(false);
    expect(canStartOfflineDownload(1, true)).toBe(false);
  });

  it('claims queued Surahs once until the owning operation releases them', () => {
    const queued = new Set<number>();

    expect(claimOfflineDownloads(queued, [3, 1, 3])).toEqual([1, 3]);
    expect(claimOfflineDownloads(queued, [1, 2])).toEqual([2]);
    expect(queued).toEqual(new Set([1, 2, 3]));

    releaseOfflineDownloads(queued, [1, 3]);
    expect(claimOfflineDownloads(queued, [3, 1, 2])).toEqual([1, 3]);
  });

  it('consumes queued cancellation markers exactly once', () => {
    const cancelled = new Set([1, 4]);

    expect(consumeCancelledDownloads(cancelled, [1, 2, 3])).toEqual([1]);
    expect(cancelled).toEqual(new Set([4]));
    expect(consumeCancelledDownloads(cancelled, [1, 4])).toEqual([4]);
    expect(cancelled).toEqual(new Set());
  });

  it('marks cancellation only while a queued claim owns the Surah', () => {
    const queued = new Set([1]);
    const cancelled = new Set([2]);

    expect(markOfflineCancellation(queued, cancelled, 1)).toBe(true);
    expect(cancelled).toEqual(new Set([1, 2]));
    expect(markOfflineCancellation(queued, cancelled, 2)).toBe(false);
    expect(cancelled).toEqual(new Set([1]));
  });

  it('keeps a promoted file when its persisted receipt could not be removed', () => {
    expect(shouldDeletePromotedDownload(false, false)).toBe(false);
    expect(shouldDeletePromotedDownload(true, false)).toBe(true);
    expect(shouldDeletePromotedDownload(true, true)).toBe(false);
  });

  it('uses the cache-backed metadata revision', () => {
    expect(OFFLINE_AUDIO_STORAGE_KEY).toBe('quran:offline-audio:v3');
  });

  it('summarizes downloaded Surahs in canonical order with their total storage', () => {
    const first = recitationTrack({ number: 1 });
    const second = recitationTrack({ number: 2 });
    const firstRecord: OfflineAudioRecord = {
      surah: 1,
      uri: 'file:///cache/001.mp3',
      bytes: first.bytes,
      sha256: first.sha256,
      downloadedAt: '2026-08-04T00:00:00.000Z',
      verifiedAt: '2026-08-04T00:00:01.000Z',
    };
    const secondRecord: OfflineAudioRecord = {
      surah: 2,
      uri: 'file:///cache/002.mp3',
      bytes: second.bytes,
      sha256: second.sha256,
      downloadedAt: '2026-08-04T00:00:02.000Z',
      verifiedAt: '2026-08-04T00:00:03.000Z',
    };

    expect(summarizeOfflineAudio({ 2: secondRecord, 1: firstRecord })).toEqual({
      count: 2,
      surahs: [1, 2],
      totalBytes: first.bytes + second.bytes,
    });
  });

  it('formats storage totals without implying false byte precision', () => {
    expect(formatOfflineAudioBytes(0)).toBe('0 MB');
    expect(formatOfflineAudioBytes(3 * 1024 * 1024)).toBe('3 MB');
    expect(formatOfflineAudioBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
  });

  const track = recitationTrack({ number: 1 });
  const record: OfflineAudioRecord = {
    surah: 1,
    uri: 'file:///documents/quran-audio/001.mp3',
    bytes: track.bytes,
    sha256: track.sha256,
    downloadedAt: '2026-08-04T00:00:00.000Z',
    verifiedAt: '2026-08-04T00:00:01.000Z',
  };

  it('fails new offline downloads closed until redistribution rights are confirmed', () => {
    expect(() => offlineAudioUrl(1)).toThrow('Offline downloads are unavailable');
    expect(() => offlineAudioUrl(114)).toThrow('Offline downloads are unavailable');
  });

  it('restores only records matching the exact typed track identity', () => {
    expect(parseOfflineAudioRecords(JSON.stringify([record]))).toEqual({ 1: record });
    expect(
      parseOfflineAudioRecords(JSON.stringify([{ ...record, bytes: record.bytes - 1 }])),
    ).toEqual({});
    expect(
      parseOfflineAudioRecords(JSON.stringify([{ ...record, sha256: 'wrong' }])),
    ).toEqual({});
  });

  it('fails malformed persisted data closed', () => {
    expect(parseOfflineAudioRecords('not-json')).toEqual({});
    expect(parseOfflineAudioRecords(JSON.stringify([{ ...record, surah: 115 }]))).toEqual({});
    expect(
      parseOfflineAudioRecords(JSON.stringify([{ ...record, verifiedAt: 'not-a-date' }])),
    ).toEqual({});
  });
});
