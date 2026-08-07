import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { PropsWithChildren } from 'react';

import { OfflineAudioProvider, useOfflineAudio } from './OfflineAudioProvider';
import { sha256File } from './fileIntegrity';
import { recitationTrack } from './reciter';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  createDownloadResumable: jest.fn(),
  deleteAsync: jest.fn(),
  getFreeDiskStorageAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  moveAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
}));

jest.mock('./fileIntegrity', () => ({
  sha256File: jest.fn(),
}));

jest.mock('./reciter', () => ({
  ...jest.requireActual('./reciter'),
  MUHAMMAD_AL_FAQIH_OFFLINE_RIGHTS_CONFIRMED: true,
}));

const track = recitationTrack({ number: 1 });
const record = {
  surah: 1,
  uri: 'file:///cache/quran-audio/muhammad-al-faqih/001.mp3',
  bytes: track.bytes,
  sha256: track.sha256,
  downloadedAt: '2026-08-04T00:00:00.000Z',
  verifiedAt: '2026-08-04T00:00:01.000Z',
};

function Wrapper({ children }: PropsWithChildren) {
  return <OfflineAudioProvider>{children}</OfflineAudioProvider>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('OfflineAudioProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([record]));
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['001.mp3']);
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: track.bytes,
    });
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.getFreeDiskStorageAsync as jest.Mock).mockResolvedValue(Number.MAX_SAFE_INTEGER);
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.moveAsync as jest.Mock).mockResolvedValue(undefined);
    (sha256File as jest.Mock).mockResolvedValue(track.sha256);
  });

  it('clears stale progress when file removal fails after receipt persistence', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
    (FileSystem.createDownloadResumable as jest.Mock).mockReturnValue({
      cancelAsync: jest.fn(),
      downloadAsync: jest.fn().mockResolvedValue({ status: 200 }),
    });
    const { result } = await renderHook(() => useOfflineAudio(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.downloadSurahs([1]));
    expect(result.current.progress[1]).toBe(1);
    const downloaded = result.current.records[1]!;
    expect(downloaded).toMatchObject({
      surah: 1,
      uri: record.uri,
      bytes: track.bytes,
      sha256: track.sha256,
    });

    (FileSystem.deleteAsync as jest.Mock).mockImplementation((uri: string) => (
      uri === downloaded.uri
        ? Promise.reject(new Error('Unable to delete file.'))
        : Promise.resolve()
    ));
    await act(() => result.current.removeDownload(1));

    expect(result.current.records[1]).toBeUndefined();
    expect(result.current.progress[1]).toBeUndefined();
    expect(result.current.errors[1]).toBe('Unable to delete file.');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'quran:offline-audio:v3',
      '[]',
    );
  });

  it('cleans a promoted file independently when part cleanup fails after persistence rejection', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
    (FileSystem.createDownloadResumable as jest.Mock).mockReturnValue({
      cancelAsync: jest.fn(),
      downloadAsync: jest.fn().mockResolvedValue({ status: 200 }),
    });
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Receipt persistence failed.'));
    let temporaryDeleteCount = 0;
    (FileSystem.deleteAsync as jest.Mock).mockImplementation((uri: string) => {
      if (uri === `${record.uri}.part`) {
        temporaryDeleteCount += 1;
        if (temporaryDeleteCount === 2) return Promise.reject(new Error('Part cleanup failed.'));
      }
      return Promise.resolve();
    });
    const { result } = await renderHook(() => useOfflineAudio(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.downloadSurahs([1]));

    expect(result.current.records[1]).toBeUndefined();
    expect(result.current.errors[1]).toBe('Receipt persistence failed.');
    expect((FileSystem.deleteAsync as jest.Mock).mock.calls
      .filter(([uri]) => uri === record.uri)).toHaveLength(2);
  });

  it('restores valid receipts when other startup cleanup and stat operations fail', async () => {
    const secondTrack = recitationTrack({ number: 2 });
    const secondRecord = {
      surah: 2,
      uri: 'file:///cache/quran-audio/muhammad-al-faqih/002.mp3',
      bytes: secondTrack.bytes,
      sha256: secondTrack.sha256,
      downloadedAt: '2026-08-04T00:00:02.000Z',
      verifiedAt: '2026-08-04T00:00:03.000Z',
    };
    const partialUri = 'file:///cache/quran-audio/muhammad-al-faqih/stale.part';
    const orphanUri = 'file:///cache/quran-audio/muhammad-al-faqih/999.mp3';
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([record, secondRecord]));
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
      '001.mp3',
      '002.mp3',
      'stale.part',
      '999.mp3',
    ]);
    (FileSystem.getInfoAsync as jest.Mock).mockImplementation((uri: string) => (
      uri === secondRecord.uri
        ? Promise.reject(new Error('Unable to stat second receipt.'))
        : Promise.resolve({ exists: true, isDirectory: false, size: track.bytes })
    ));
    (FileSystem.deleteAsync as jest.Mock).mockImplementation((uri: string) => (
      uri === partialUri || uri === orphanUri
        ? Promise.reject(new Error('Unable to clean startup artifact.'))
        : Promise.resolve()
    ));

    const { result } = await renderHook(() => useOfflineAudio(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.records[1]).toEqual(record);
    expect(result.current.records[2]).toBeUndefined();
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(partialUri, { idempotent: true });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(orphanUri, { idempotent: true });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'quran:offline-audio:v3',
      JSON.stringify([record]),
    );
  });

  it('does not let ownerless cancellation suppress a later request', async () => {
    const downloadAsync = jest.fn().mockRejectedValue(new Error('Network failed.'));
    (FileSystem.createDownloadResumable as jest.Mock).mockReturnValue({
      cancelAsync: jest.fn(),
      downloadAsync,
    });
    const { result } = await renderHook(() => useOfflineAudio(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.cancelDownload(2));
    await act(() => result.current.downloadSurahs([2]));

    expect(downloadAsync).toHaveBeenCalledTimes(1);
    expect(result.current.progress[2]).toBeUndefined();
    expect(result.current.errors[2]).toBe('Network failed.');
  });

  it('clears progress when every requested Surah already has a receipt', async () => {
    const { result } = await renderHook(() => useOfflineAudio(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.downloadSurahs([1]));

    expect(result.current.progress[1]).toBeUndefined();
    expect(result.current.errors[1]).toBeUndefined();
    expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
  });

  it('preserves cancellation cleanup across a pending low-space preflight and part deletion failure', async () => {
    const freeBytes = deferred<number>();
    (FileSystem.getFreeDiskStorageAsync as jest.Mock).mockReturnValue(freeBytes.promise);
    const { result } = await renderHook(() => useOfflineAudio(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    let downloadPromise!: Promise<void>;
    await act(async () => {
      downloadPromise = result.current.downloadSurahs([2]);
      await Promise.resolve();
    });
    await waitFor(() => expect(FileSystem.getFreeDiskStorageAsync).toHaveBeenCalled());
    (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(new Error('Part cleanup failed.'));
    await act(async () => {
      await expect(result.current.cancelDownload(2)).resolves.toBeUndefined();
    });
    freeBytes.resolve(0);
    await act(() => downloadPromise);

    expect(result.current.progress[2]).toBeUndefined();
    expect(result.current.errors[2]).toBeUndefined();
    expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
  });

  it('preserves cancellation cleanup when disk preflight rejects', async () => {
    const freeBytes = deferred<number>();
    (FileSystem.getFreeDiskStorageAsync as jest.Mock).mockReturnValue(freeBytes.promise);
    const { result } = await renderHook(() => useOfflineAudio(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    let downloadPromise!: Promise<void>;
    await act(async () => {
      downloadPromise = result.current.downloadSurahs([2]);
      await Promise.resolve();
    });
    await waitFor(() => expect(FileSystem.getFreeDiskStorageAsync).toHaveBeenCalled());
    await act(() => result.current.cancelDownload(2));
    freeBytes.reject(new Error('Disk probe failed.'));
    await act(() => downloadPromise);

    expect(result.current.progress[2]).toBeUndefined();
    expect(result.current.errors[2]).toBeUndefined();
    expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
  });
});
