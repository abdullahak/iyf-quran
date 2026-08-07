import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  PLAYBACK_LIBRARY_STORAGE_KEY,
  addPlaylistItem,
  appendQueue,
  createPlaylist as createPlaylistRecord,
  createQueueEntry,
  moveQueueEntry,
  parsePlaybackLibrary,
  removeQueueEntry,
  type PlaybackQueueEntry,
  type QuranPlaylist,
} from './playbackLibrary';

type PlaybackLibraryContextValue = {
  queue: readonly PlaybackQueueEntry[];
  playlists: readonly QuranPlaylist[];
  ready: boolean;
  enqueueConfirmation: PlaybackQueueEntry | undefined;
  enqueueRange: (surah: number, startAyah?: number, endAyah?: number) => PlaybackQueueEntry;
  replaceQueue: (entries: readonly PlaybackQueueEntry[]) => void;
  removeFromQueue: (id: string) => void;
  moveInQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  createPlaylist: (name: string) => QuranPlaylist;
  createPlaylistWithRange: (
    name: string,
    surah: number,
    startAyah?: number,
    endAyah?: number,
  ) => QuranPlaylist;
  deletePlaylist: (id: string) => void;
  addRangeToPlaylist: (
    playlistId: string,
    surah: number,
    startAyah?: number,
    endAyah?: number,
  ) => PlaybackQueueEntry | undefined;
};

const PlaybackLibraryContext = createContext<PlaybackLibraryContextValue | null>(null);

export function PlaybackLibraryProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<PlaybackQueueEntry[]>([]);
  const [playlists, setPlaylists] = useState<QuranPlaylist[]>([]);
  const [ready, setReady] = useState(false);
  const [enqueueConfirmation, setEnqueueConfirmation] = useState<PlaybackQueueEntry>();
  const persistenceQueueRef = useRef(Promise.resolve());
  const identityCounterRef = useRef(0);

  const nextId = useCallback((kind: 'queue' | 'playlist' | 'item') => {
    identityCounterRef.current += 1;
    return `${kind}:${Date.now().toString(36)}:${identityCounterRef.current.toString(36)}`;
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PLAYBACK_LIBRARY_STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        const parsed = parsePlaybackLibrary(raw);
        setQueue(parsed.queue);
        setPlaylists(parsed.playlists);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify({ queue, playlists });
    const write = persistenceQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(PLAYBACK_LIBRARY_STORAGE_KEY, serialized));
    persistenceQueueRef.current = write;
    void write.catch(() => undefined);
  }, [playlists, queue, ready]);

  useEffect(() => {
    if (!enqueueConfirmation) return;
    const confirmationId = enqueueConfirmation.id;
    const timeout = setTimeout(() => {
      setEnqueueConfirmation((current) => current?.id === confirmationId ? undefined : current);
    }, 2500);
    return () => clearTimeout(timeout);
  }, [enqueueConfirmation]);

  const enqueueRange = useCallback((surah: number, startAyah?: number, endAyah?: number) => {
    const entry = createQueueEntry(surah, startAyah, endAyah, nextId('queue'));
    setQueue((current) => appendQueue(current, entry));
    setEnqueueConfirmation(entry);
    return entry;
  }, [nextId]);
  const replaceQueue = useCallback((entries: readonly PlaybackQueueEntry[]) => setQueue([...entries]), []);
  const removeFromQueue = useCallback((id: string) => {
    setQueue((current) => removeQueueEntry(current, id));
  }, []);
  const moveInQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((current) => moveQueueEntry(current, fromIndex, toIndex));
  }, []);
  const clearQueue = useCallback(() => setQueue([]), []);

  const createPlaylist = useCallback((name: string) => {
    const playlist = createPlaylistRecord(name, nextId('playlist'));
    setPlaylists((current) => [playlist, ...current]);
    return playlist;
  }, [nextId]);
  const createPlaylistWithRange = useCallback((
    name: string,
    surah: number,
    startAyah?: number,
    endAyah?: number,
  ) => {
    const entry = createQueueEntry(surah, startAyah, endAyah, nextId('item'));
    const playlist = addPlaylistItem(
      createPlaylistRecord(name, nextId('playlist')),
      entry,
    );
    setPlaylists((current) => [playlist, ...current]);
    return playlist;
  }, [nextId]);
  const deletePlaylist = useCallback((id: string) => {
    setPlaylists((current) => current.filter((playlist) => playlist.id !== id));
  }, []);
  const addRangeToPlaylist = useCallback((
    playlistId: string,
    surah: number,
    startAyah?: number,
    endAyah?: number,
  ) => {
    if (!playlists.some((playlist) => playlist.id === playlistId)) return undefined;
    const entry = createQueueEntry(surah, startAyah, endAyah, nextId('item'));
    setPlaylists((current) => current.map((playlist) => {
      if (playlist.id !== playlistId) return playlist;
      return addPlaylistItem(playlist, entry);
    }));
    return entry;
  }, [nextId, playlists]);

  const value = useMemo<PlaybackLibraryContextValue>(() => ({
    queue,
    playlists,
    ready,
    enqueueConfirmation,
    enqueueRange,
    replaceQueue,
    removeFromQueue,
    moveInQueue,
    clearQueue,
    createPlaylist,
    createPlaylistWithRange,
    deletePlaylist,
    addRangeToPlaylist,
  }), [
    addRangeToPlaylist,
    clearQueue,
    createPlaylist,
    createPlaylistWithRange,
    deletePlaylist,
    enqueueConfirmation,
    enqueueRange,
    moveInQueue,
    playlists,
    queue,
    ready,
    removeFromQueue,
    replaceQueue,
  ]);

  return <PlaybackLibraryContext.Provider value={value}>{children}</PlaybackLibraryContext.Provider>;
}

export function usePlaybackLibrary(): PlaybackLibraryContextValue {
  const value = useContext(PlaybackLibraryContext);
  if (!value) throw new Error('usePlaybackLibrary must be used inside PlaybackLibraryProvider.');
  return value;
}
