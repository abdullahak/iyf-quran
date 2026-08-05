import { recitationTrack } from './reciter';
import {
  OFFLINE_AUDIO_STORAGE_KEY,
  offlineAudioUrl,
  parseOfflineAudioRecords,
  type OfflineAudioRecord,
} from './offlineAudio';

describe('offline recitation metadata', () => {
  it('uses the cache-backed metadata revision', () => {
    expect(OFFLINE_AUDIO_STORAGE_KEY).toBe('quran:offline-audio:v3');
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

  it('builds Raspberry Pi audio URLs using canonical padded filenames', () => {
    expect(offlineAudioUrl(1)).toBe(
      'https://abdlh.com/quran/audio/muhammad-al-faqih/001.mp3',
    );
    expect(offlineAudioUrl(114)).toBe(
      'https://abdlh.com/quran/audio/muhammad-al-faqih/114.mp3',
    );
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
