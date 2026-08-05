import { recitationTrack } from './reciter';

export const OFFLINE_AUDIO_BASE_URL =
  'https://abdlh.com/quran/audio/muhammad-al-faqih';
export const OFFLINE_AUDIO_STORAGE_KEY = 'quran:offline-audio:v3';

export type OfflineAudioRecord = {
  surah: number;
  uri: string;
  bytes: number;
  sha256: string;
  downloadedAt: string;
  verifiedAt: string;
};

export function offlineAudioUrl(surah: number): string {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new RangeError('Surah number must be between 1 and 114.');
  }
  return `${OFFLINE_AUDIO_BASE_URL}/${String(surah).padStart(3, '0')}.mp3`;
}

export function parseOfflineAudioRecords(
  raw: string | null,
): Readonly<Partial<Record<number, OfflineAudioRecord>>> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return {};
    const records: Partial<Record<number, OfflineAudioRecord>> = {};
    value.forEach((candidate) => {
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Partial<OfflineAudioRecord>;
      if (
        !Number.isInteger(record.surah) ||
        typeof record.surah !== 'number' ||
        typeof record.uri !== 'string' ||
        !record.uri.startsWith('file://') ||
        typeof record.bytes !== 'number' ||
        typeof record.sha256 !== 'string' ||
        typeof record.downloadedAt !== 'string' ||
        !Number.isFinite(Date.parse(record.downloadedAt)) ||
        typeof record.verifiedAt !== 'string' ||
        !Number.isFinite(Date.parse(record.verifiedAt))
      ) {
        return;
      }
      try {
        const track = recitationTrack({ number: record.surah });
        if (record.bytes !== track.bytes || record.sha256 !== track.sha256) return;
        records[record.surah] = record as OfflineAudioRecord;
      } catch {
        // Unknown Surahs and invalid typed identities are ignored.
      }
    });
    return records;
  } catch {
    return {};
  }
}
