import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  OFFLINE_AUDIO_STORAGE_KEY,
  claimOfflineDownloads,
  consumeCancelledDownloads,
  markOfflineCancellation,
  offlineAudioUrl,
  parseOfflineAudioRecords,
  releaseOfflineDownloads,
  shouldDeletePromotedDownload,
  type OfflineAudioRecord,
} from './offlineAudio';
import { sha256File } from './fileIntegrity';
import { recitationTrack } from './reciter';
import { enqueueSerial } from './serialQueue';

type OfflineAudioContextValue = {
  ready: boolean;
  records: Readonly<Partial<Record<number, OfflineAudioRecord>>>;
  progress: Readonly<Partial<Record<number, number>>>;
  errors: Readonly<Partial<Record<number, string>>>;
  downloadSurahs: (surahs: readonly number[]) => Promise<void>;
  cancelDownload: (surah: number) => Promise<void>;
  removeDownload: (surah: number) => Promise<void>;
  localUri: (surah: number) => string | undefined;
};

const OfflineAudioContext = createContext<OfflineAudioContextValue | null>(null);
// Large, reproducible recitation files belong in the OS-managed cache so iOS
// excludes them from device backups. Restore reconciles files purged under
// storage pressure and lets the user download them again.
const AUDIO_DIRECTORY = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}quran-audio/muhammad-al-faqih/`
  : null;
const DOWNLOAD_RESERVE_BYTES = 256 * 1024 * 1024;

function destinationUri(surah: number): string {
  if (!AUDIO_DIRECTORY) throw new Error('Offline downloads are unavailable on this platform.');
  return `${AUDIO_DIRECTORY}${String(surah).padStart(3, '0')}.mp3`;
}

export function OfflineAudioProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [records, setRecords] = useState<Partial<Record<number, OfflineAudioRecord>>>({});
  const [progress, setProgress] = useState<Partial<Record<number, number>>>({});
  const [errors, setErrors] = useState<Partial<Record<number, string>>>({});
  const recordsRef = useRef(records);
  const operationQueueRef = useRef(Promise.resolve());
  const persistenceQueueRef = useRef(Promise.resolve());
  const restorePromiseRef = useRef(Promise.resolve());
  const activeDownloadsRef = useRef(new Map<
    number,
    ReturnType<typeof FileSystem.createDownloadResumable>
  >());
  const queuedDownloadsRef = useRef(new Set<number>());
  const cancelledDownloadsRef = useRef(new Set<number>());

  const commitRecords = useCallback(async (next: Partial<Record<number, OfflineAudioRecord>>) => {
    const serialized = JSON.stringify(Object.values(next).filter(Boolean));
    const write = persistenceQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(OFFLINE_AUDIO_STORAGE_KEY, serialized));
    persistenceQueueRef.current = write;
    await write;
    recordsRef.current = next;
    setRecords(next);
  }, []);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      const parsed = parseOfflineAudioRecords(await AsyncStorage.getItem(OFFLINE_AUDIO_STORAGE_KEY));
      const valid: Partial<Record<number, OfflineAudioRecord>> = {};
      const directoryEntries = AUDIO_DIRECTORY
        ? await FileSystem.readDirectoryAsync(AUDIO_DIRECTORY).catch(() => [])
        : [];
      if (AUDIO_DIRECTORY) {
        await Promise.all(
          directoryEntries
            .filter((entry) => entry.endsWith('.part'))
            .map((entry) => FileSystem
              .deleteAsync(`${AUDIO_DIRECTORY}${entry}`, { idempotent: true })
              .catch(() => undefined)),
        );
      }
      await Promise.all(Object.values(parsed).filter(Boolean).map(async (record) => {
        if (!record) return;
        if (!AUDIO_DIRECTORY || record.uri !== destinationUri(record.surah)) return;
        const info = await FileSystem.getInfoAsync(record.uri).catch(() => undefined);
        if (!info) return;
        if (info.exists && !info.isDirectory && info.size === record.bytes) valid[record.surah] = record;
      }));
      if (AUDIO_DIRECTORY) {
        const validUris = new Set(Object.values(valid).map((record) => record?.uri));
        await Promise.all(
          directoryEntries
            .filter((entry) => entry.endsWith('.mp3'))
            .map((entry) => `${AUDIO_DIRECTORY}${entry}`)
            .filter((uri) => !validUris.has(uri))
            .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)),
        );
      }
      if (!active) return;
      recordsRef.current = valid;
      setRecords(valid);
      setReady(true);
      if (Object.keys(valid).length !== Object.keys(parsed).length) {
        await AsyncStorage.setItem(OFFLINE_AUDIO_STORAGE_KEY, JSON.stringify(Object.values(valid)));
      }
    };
    const restorePromise = restore().catch(() => {
      if (active) setReady(true);
    });
    restorePromiseRef.current = restorePromise;
    return () => {
      active = false;
    };
  }, []);

  const downloadOne = useCallback(async (surah: number) => {
    const track = recitationTrack({ number: surah });
    if (!AUDIO_DIRECTORY) throw new Error('Offline downloads require the iOS or Android app.');
    await FileSystem.makeDirectoryAsync(AUDIO_DIRECTORY, { intermediates: true });
    const destination = destinationUri(surah);
    const temporary = `${destination}.part`;
    await FileSystem.deleteAsync(temporary, { idempotent: true });
    setErrors((current) => ({ ...current, [surah]: undefined }));
    setProgress((current) => ({ ...current, [surah]: 0 }));
    let promoted = false;
    let published = false;

    try {
      if (cancelledDownloadsRef.current.has(surah)) throw new Error('Download cancelled.');
      const task = FileSystem.createDownloadResumable(
        offlineAudioUrl(surah),
        temporary,
        {},
        ({ totalBytesExpectedToWrite, totalBytesWritten }) => {
          const denominator = totalBytesExpectedToWrite > 0
            ? totalBytesExpectedToWrite
            : track.bytes;
          setProgress((current) => ({
            ...current,
            [surah]: Math.min(1, totalBytesWritten / denominator),
          }));
        },
      );
      activeDownloadsRef.current.set(surah, task);
      const result = await task.downloadAsync();
      if (cancelledDownloadsRef.current.has(surah)) throw new Error('Download cancelled.');
      if (!result || result.status < 200 || result.status >= 300) {
        throw new Error('The audio server did not complete the download.');
      }
      const info = await FileSystem.getInfoAsync(temporary);
      if (!info.exists || info.isDirectory || info.size !== track.bytes) {
        throw new Error('The downloaded file did not match the expected track size.');
      }
      const digest = await sha256File(temporary);
      if (digest !== track.sha256) {
        throw new Error('The downloaded file failed its integrity check.');
      }
      if (cancelledDownloadsRef.current.has(surah)) throw new Error('Download cancelled.');
      await FileSystem.deleteAsync(destination, { idempotent: true });
      await FileSystem.moveAsync({ from: temporary, to: destination });
      promoted = true;
      if (cancelledDownloadsRef.current.has(surah)) throw new Error('Download cancelled.');
      const timestamp = new Date().toISOString();
      const record: OfflineAudioRecord = {
        surah,
        uri: destination,
        bytes: track.bytes,
        sha256: track.sha256,
        downloadedAt: timestamp,
        verifiedAt: timestamp,
      };
      await commitRecords({ ...recordsRef.current, [surah]: record });
      published = true;
      if (cancelledDownloadsRef.current.has(surah)) {
        const next = { ...recordsRef.current };
        delete next[surah];
        try {
          await commitRecords(next);
          published = false;
        } catch (error) {
          cancelledDownloadsRef.current.delete(surah);
          throw error;
        }
        throw new Error('Download cancelled.');
      }
      setProgress((current) => ({ ...current, [surah]: 1 }));
    } catch (error) {
      await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
      if (shouldDeletePromotedDownload(promoted, published)) {
        await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
      }
      throw error;
    } finally {
      activeDownloadsRef.current.delete(surah);
    }
  }, [commitRecords]);

  const downloadSurahs = useCallback((surahs: readonly number[]) => {
    const requested = claimOfflineDownloads(queuedDownloadsRef.current, surahs);
    if (requested.length === 0) return Promise.resolve();
    const clearRequestState = (targets: readonly number[]) => {
      if (targets.length === 0) return;
      setProgress((current) => Object.fromEntries([
        ...Object.entries(current),
        ...targets.map((surah) => [surah, undefined]),
      ]));
      setErrors((current) => Object.fromEntries([
        ...Object.entries(current),
        ...targets.map((surah) => [surah, undefined]),
      ]));
    };
    const consumeRequestCancellations = (targets: readonly number[]) => {
      const cancelled = consumeCancelledDownloads(cancelledDownloadsRef.current, targets);
      clearRequestState(cancelled);
      return new Set(cancelled);
    };
    setProgress((current) => {
      const next = { ...current };
      requested.forEach((surah) => { next[surah] = 0; });
      return next;
    });
    return enqueueSerial(
      operationQueueRef,
      async () => {
        try {
          await restorePromiseRef.current;
          const cancelledBeforePreflight = consumeRequestCancellations(requested);
          const completed = requested.filter(
            (surah) => !cancelledBeforePreflight.has(surah) && recordsRef.current[surah],
          );
          clearRequestState(completed);
          let pending = requested.filter(
            (surah) => !cancelledBeforePreflight.has(surah) && !recordsRef.current[surah],
          );
          if (pending.length === 0) return;
          const freeBytes = await FileSystem.getFreeDiskStorageAsync();
          const cancelledDuringPreflight = consumeRequestCancellations(pending);
          pending = pending.filter((surah) => !cancelledDuringPreflight.has(surah));
          if (pending.length === 0) return;
          const remainingBytes = pending.reduce(
            (total, surah) => total + recitationTrack({ number: surah }).bytes,
            0,
          );
          const reserve = Math.max(DOWNLOAD_RESERVE_BYTES, Math.ceil(remainingBytes * 0.1));
          if (freeBytes < remainingBytes + reserve) {
            const message = 'Not enough free storage for the selected Surahs.';
            setErrors((current) => Object.fromEntries([
              ...Object.entries(current),
              ...pending.map((surah) => [surah, message]),
            ]));
            setProgress((current) => Object.fromEntries([
              ...Object.entries(current),
              ...pending.map((surah) => [surah, undefined]),
            ]));
            return;
          }

          for (const surah of pending) {
            try {
              await downloadOne(surah);
            } catch (error) {
              if (cancelledDownloadsRef.current.delete(surah)) {
                setProgress((current) => ({ ...current, [surah]: undefined }));
                setErrors((current) => ({ ...current, [surah]: undefined }));
                continue;
              }
              const message = error instanceof Error ? error.message : 'Download failed.';
              setErrors((current) => ({ ...current, [surah]: message }));
              setProgress((current) => ({ ...current, [surah]: undefined }));
            }
          }
        } catch (error) {
          const cancelled = consumeRequestCancellations(requested);
          const failed = requested.filter(
            (surah) => !cancelled.has(surah) && !recordsRef.current[surah],
          );
          const message = error instanceof Error ? error.message : 'Download failed.';
          setErrors((current) => Object.fromEntries([
            ...Object.entries(current),
            ...failed.map((surah) => [surah, message]),
          ]));
          setProgress((current) => Object.fromEntries([
            ...Object.entries(current),
            ...requested.map((surah) => [surah, undefined]),
          ]));
        } finally {
          requested.forEach((surah) => cancelledDownloadsRef.current.delete(surah));
          releaseOfflineDownloads(queuedDownloadsRef.current, requested);
        }
      },
    );
  }, [downloadOne]);

  const cancelDownload = useCallback(async (surah: number) => {
    const owned = markOfflineCancellation(
      queuedDownloadsRef.current,
      cancelledDownloadsRef.current,
      surah,
    );
    const activeDownload = owned ? activeDownloadsRef.current.get(surah) : undefined;
    if (activeDownload) await activeDownload.cancelAsync().catch(() => undefined);
    if (AUDIO_DIRECTORY) {
      await FileSystem.deleteAsync(`${destinationUri(surah)}.part`, { idempotent: true })
        .catch(() => undefined);
    }
    setProgress((current) => ({ ...current, [surah]: undefined }));
    setErrors((current) => ({ ...current, [surah]: undefined }));
  }, []);

  const removeDownload = useCallback((surah: number) => {
    return enqueueSerial(
      operationQueueRef,
      async () => {
        await restorePromiseRef.current;
        const record = recordsRef.current[surah];
        if (!record) return;
        const next = { ...recordsRef.current };
        delete next[surah];
        await commitRecords(next);
        await FileSystem.deleteAsync(record.uri, { idempotent: true });
        setProgress((current) => ({ ...current, [surah]: undefined }));
        setErrors((current) => ({ ...current, [surah]: undefined }));
      },
      (error) => {
        setProgress((current) => ({ ...current, [surah]: undefined }));
        setErrors((current) => ({
          ...current,
          [surah]: error instanceof Error ? error.message : 'Unable to remove download.',
        }));
      },
    );
  }, [commitRecords]);

  const value = useMemo<OfflineAudioContextValue>(() => ({
    ready,
    records,
    progress,
    errors,
    downloadSurahs,
    cancelDownload,
    removeDownload,
    localUri: (surah) => records[surah]?.uri,
  }), [cancelDownload, downloadSurahs, errors, progress, ready, records, removeDownload]);

  return <OfflineAudioContext.Provider value={value}>{children}</OfflineAudioContext.Provider>;
}

export function useOfflineAudio(): OfflineAudioContextValue {
  const value = useContext(OfflineAudioContext);
  if (!value) throw new Error('useOfflineAudio must be used inside OfflineAudioProvider.');
  return value;
}
