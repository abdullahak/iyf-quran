import { chapterByNumber } from '@/data/chapters';

export const PLAYBACK_LIBRARY_STORAGE_KEY = 'quran:playback-library:v1';

export type PlaybackQueueEntry = {
  id: string;
  surah: number;
  startAyah: number;
  endAyah: number;
};

export type QuranPlaylist = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: PlaybackQueueEntry[];
};

export type PlaybackLibrary = {
  queue: PlaybackQueueEntry[];
  playlists: QuranPlaylist[];
};

export const EMPTY_PLAYBACK_LIBRARY: PlaybackLibrary = { queue: [], playlists: [] };

export function createQueueEntry(
  surah: number,
  startAyah = 1,
  endAyah = chapterByNumber(surah)?.ayahCount,
  id = `${surah}:${startAyah}-${endAyah}`,
): PlaybackQueueEntry {
  const chapter = chapterByNumber(surah);
  if (
    !chapter ||
    !id.trim() ||
    !Number.isInteger(startAyah) ||
    !Number.isInteger(endAyah) ||
    startAyah < 1 ||
    endAyah! > chapter.ayahCount ||
    startAyah > endAyah!
  ) throw new RangeError('Unknown Quran queue range.');
  return { id, surah, startAyah, endAyah: endAyah! };
}

export function appendQueue(
  queue: readonly PlaybackQueueEntry[],
  entry: PlaybackQueueEntry,
): PlaybackQueueEntry[] {
  return [...queue, entry];
}

export function removeQueueEntry(
  queue: readonly PlaybackQueueEntry[],
  id: string,
): PlaybackQueueEntry[] {
  return queue.filter((entry) => entry.id !== id);
}

export function moveQueueEntry(
  queue: readonly PlaybackQueueEntry[],
  fromIndex: number,
  toIndex: number,
): PlaybackQueueEntry[] {
  const next = [...queue];
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= next.length ||
    toIndex >= next.length ||
    fromIndex === toIndex
  ) return next;
  const [entry] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, entry!);
  return next;
}

export function createPlaylist(name: string, id: string, createdAt = Date.now()): QuranPlaylist {
  const normalizedName = name.trim();
  if (!normalizedName || !id.trim() || !Number.isFinite(createdAt)) {
    throw new RangeError('A playlist needs a name and identity.');
  }
  return { id, name: normalizedName, createdAt, updatedAt: createdAt, items: [] };
}

export function addPlaylistItem(
  playlist: QuranPlaylist,
  entry: PlaybackQueueEntry,
  updatedAt = Date.now(),
): QuranPlaylist {
  if (!Number.isFinite(updatedAt)) throw new RangeError('Invalid playlist update time.');
  return { ...playlist, updatedAt, items: [...playlist.items, entry] };
}

export function parsePlaybackLibrary(raw: string | null): PlaybackLibrary {
  if (!raw) return EMPTY_PLAYBACK_LIBRARY;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object') return EMPTY_PLAYBACK_LIBRARY;
    const candidate = value as Partial<PlaybackLibrary>;
    const queue = Array.isArray(candidate.queue) ? candidate.queue.filter(isQueueEntry) : [];
    const playlists = Array.isArray(candidate.playlists)
      ? candidate.playlists.filter(isPlaylist).map((playlist) => ({
          ...playlist,
          items: playlist.items.filter(isQueueEntry),
        }))
      : [];
    return { queue, playlists };
  } catch {
    return EMPTY_PLAYBACK_LIBRARY;
  }
}

function isQueueEntry(value: unknown): value is PlaybackQueueEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PlaybackQueueEntry>;
  const chapter = chapterByNumber(candidate.surah ?? 0);
  return Boolean(
    chapter &&
    typeof candidate.id === 'string' && candidate.id.trim() &&
    Number.isInteger(candidate.startAyah) && candidate.startAyah! >= 1 &&
    Number.isInteger(candidate.endAyah) && candidate.endAyah! <= chapter.ayahCount &&
    candidate.startAyah! <= candidate.endAyah!,
  );
}

function isPlaylist(value: unknown): value is QuranPlaylist {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QuranPlaylist>;
  return Boolean(
    typeof candidate.id === 'string' && candidate.id.trim() &&
    typeof candidate.name === 'string' && candidate.name.trim() &&
    Number.isFinite(candidate.createdAt) &&
    Number.isFinite(candidate.updatedAt) &&
    Array.isArray(candidate.items),
  );
}
