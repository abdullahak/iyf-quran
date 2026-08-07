import {
  MUHAMMAD_AL_FAQIH_OFFLINE_RIGHTS_CONFIRMED,
  recitationTrack,
} from './reciter';

export const OFFLINE_AUDIO_STORAGE_KEY = 'quran:offline-audio:v3';

export type OfflineAudioRecord = {
  surah: number;
  uri: string;
  bytes: number;
  sha256: string;
  downloadedAt: string;
  verifiedAt: string;
};

export type OfflineAudioAction = 'cancel' | 'remove' | 'select';

export type OfflineAudioSummary = {
  count: number;
  surahs: number[];
  totalBytes: number;
};

export function summarizeOfflineAudio(
  records: Readonly<Partial<Record<number, OfflineAudioRecord>>>,
): OfflineAudioSummary {
  const available = Object.values(records)
    .filter((record): record is OfflineAudioRecord => Boolean(record))
    .sort((left, right) => left.surah - right.surah);
  return {
    count: available.length,
    surahs: available.map((record) => record.surah),
    totalBytes: available.reduce((total, record) => total + record.bytes, 0),
  };
}

export function formatOfflineAudioBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const gigabyte = 1024 * 1024 * 1024;
  const megabyte = 1024 * 1024;
  const unit = bytes >= gigabyte ? 'GB' : 'MB';
  const value = bytes / (unit === 'GB' ? gigabyte : megabyte);
  const rounded = value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, '');
  return `${rounded} ${unit}`;
}

export function canStartOfflineDownload(selectedCount: number, batchActive: boolean): boolean {
  return selectedCount > 0 && !batchActive;
}

export function offlineDownloadsAvailable(platform: string, supportsOffline: boolean): boolean {
  return platform !== 'web' && supportsOffline;
}

export function claimOfflineDownloads(
  queued: Set<number>,
  surahs: readonly number[],
): number[] {
  return Array.from(new Set(surahs))
    .sort((a, b) => a - b)
    .filter((surah) => {
      if (queued.has(surah)) return false;
      queued.add(surah);
      return true;
    });
}

export function releaseOfflineDownloads(queued: Set<number>, surahs: readonly number[]): void {
  surahs.forEach((surah) => queued.delete(surah));
}

export function consumeCancelledDownloads(
  cancelled: Set<number>,
  surahs: readonly number[],
): number[] {
  return surahs.filter((surah) => cancelled.delete(surah));
}

export function markOfflineCancellation(
  queued: ReadonlySet<number>,
  cancelled: Set<number>,
  surah: number,
): boolean {
  if (!queued.has(surah)) {
    cancelled.delete(surah);
    return false;
  }
  cancelled.add(surah);
  return true;
}

export function shouldDeletePromotedDownload(promoted: boolean, published: boolean): boolean {
  return promoted && !published;
}

export function offlineAudioAction(
  downloaded: boolean,
  progress: number | undefined,
): OfflineAudioAction {
  if (downloaded) return 'remove';
  if (progress !== undefined) return 'cancel';
  return 'select';
}

export function offlineAudioUrl(surah: number): string {
  const track = recitationTrack({ number: surah });
  if (!MUHAMMAD_AL_FAQIH_OFFLINE_RIGHTS_CONFIRMED) {
    throw new Error('Offline downloads are unavailable until redistribution rights are confirmed.');
  }
  return track.sourceUrl;
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
