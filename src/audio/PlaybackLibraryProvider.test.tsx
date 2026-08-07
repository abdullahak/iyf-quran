import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { PlaybackLibraryProvider, usePlaybackLibrary } from './PlaybackLibraryProvider';
import { PLAYBACK_LIBRARY_STORAGE_KEY } from './playbackLibrary';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

function Wrapper({ children }: PropsWithChildren) {
  return <PlaybackLibraryProvider>{children}</PlaybackLibraryProvider>;
}

describe('PlaybackLibraryProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a playlist with its initial range atomically', async () => {
    const { result } = await renderHook(() => usePlaybackLibrary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    let created: ReturnType<typeof result.current.createPlaylistWithRange>;
    await act(() => {
      created = result.current.createPlaylistWithRange('Morning', 2, 1, 5);
    });

    expect(created!.items).toMatchObject([{ surah: 2, startAyah: 1, endAyah: 5 }]);
    expect(result.current.playlists[0]).toEqual(created!);
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      PLAYBACK_LIBRARY_STORAGE_KEY,
      JSON.stringify({ queue: [], playlists: [created!] }),
    ));
  });

  it('publishes and then clears a transient enqueue confirmation', async () => {
    jest.useFakeTimers();
    try {
      const { result } = await renderHook(() => usePlaybackLibrary(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.ready).toBe(true));

      await act(() => {
        result.current.enqueueRange(2, 8, 10);
      });
      expect(result.current.enqueueConfirmation).toMatchObject({
        surah: 2, startAyah: 8, endAyah: 10,
      });

      await act(() => jest.advanceTimersByTime(2500));
      expect(result.current.enqueueConfirmation).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });
});
