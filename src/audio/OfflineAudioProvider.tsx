import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  OFFLINE_AUDIO_STORAGE_KEY,
  offlineAudioUrl,
  parseOfflineAudioRecords,
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
            .map((entry) => FileSystem.deleteAsync(`${AUDIO_DIRECTORY}${entry}`, { idempotent: true })),
        );
      }
      await Promise.all(Object.values(parsed).filter(Boolean).map(async (record) => {
        if (!record) return;
        if (!AUDIO_DIRECTORY || record.uri !== destinationUri(record.surah)) return;
        const info = await FileSystem.getInfoAsync(record.uri);
        if (info.exists && !info.isDirectory && info.size === record.bytes) valid[record.surah] = record;
      }));
      if (AUDIO_DIRECTORY) {
        const validUris = new Set(Object.values(valid).map((record) => record?.uri));
        await Promise.all(
          directoryEntries
            .filter((entry) => entry.endsWith('.mp3'))
            .map((entry) => `${AUDIO_DIRECTORY}${entry}`)
            .filter((uri) => !validUris.has(uri))
            .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })),
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

    try {
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
      const result = await task.downloadAsync();
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
      await FileSystem.deleteAsync(destination, { idempotent: true });
      await FileSystem.moveAsync({ from: temporary, to: destination });
      promoted = true;
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
      setProgress((current) => ({ ...current, [surah]: 1 }));
    } catch (error) {
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      if (promoted) await FileSystem.deleteAsync(destination, { idempotent: true });
      throw error;
    }
  }, [commitRecords]);

  const downloadSurahs = useCallback((surahs: readonly number[]) => {
    const requested = Array.from(new Set(surahs)).sort((a, b) => a - b);
    return enqueueSerial(
      operationQueueRef,
      async () => {
        await restorePromiseRef.current;
        const pending = requested.filter((surah) => !recordsRef.current[surah]);
        if (pending.length === 0) return;
        const remainingBytes = pending.reduce(
          (total, surah) => total + recitationTrack({ number: surah }).bytes,
          0,
        );
        const reserve = Math.max(DOWNLOAD_RESERVE_BYTES, Math.ceil(remainingBytes * 0.1));
        const freeBytes = await FileSystem.getFreeDiskStorageAsync();
        if (freeBytes < remainingBytes + reserve) {
          const message = 'Not enough free storage for the selected Surahs.';
          setErrors((current) => Object.fromEntries([
            ...Object.entries(current),
            ...pending.map((surah) => [surah, message]),
          ]));
          return;
        }

        for (const surah of pending) {
          try {
            await downloadOne(surah);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Download failed.';
            setErrors((current) => ({ ...current, [surah]: message }));
            setProgress((current) => ({ ...current, [surah]: undefined }));
          }
        }
      },
      (error) => {
        const message = error instanceof Error ? error.message : 'Download failed.';
        setErrors((current) => Object.fromEntries([
          ...Object.entries(current),
          ...requested.map((surah) => [surah, message]),
        ]));
      },
    );
  }, [downloadOne]);

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
    removeDownload,
    localUri: (surah) => records[surah]?.uri,
  }), [downloadSurahs, errors, progress, ready, records, removeDownload]);

  return <OfflineAudioContext.Provider value={value}>{children}</OfflineAudioContext.Provider>;
}

export function useOfflineAudio(): OfflineAudioContextValue {
  const value = useContext(OfflineAudioContext);
  if (!value) throw new Error('useOfflineAudio must be used inside OfflineAudioProvider.');
  return value;
}
