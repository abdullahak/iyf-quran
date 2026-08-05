import {
  PLAYBACK_LIBRARY_STORAGE_KEY,
  addPlaylistItem,
  appendQueue,
  createPlaylist,
  createQueueEntry,
  moveQueueEntry,
  parsePlaybackLibrary,
  removeQueueEntry,
} from './playbackLibrary';

describe('playback queue and playlists', () => {
  it('creates canonical Surah and Ayah range entries', () => {
    expect(PLAYBACK_LIBRARY_STORAGE_KEY).toBe('quran:playback-library:v1');
    expect(createQueueEntry(1, undefined, undefined, 'surah-1')).toEqual({
      id: 'surah-1',
      surah: 1,
      startAyah: 1,
      endAyah: 7,
    });
    expect(createQueueEntry(2, 255, 257, 'range')).toEqual({
      id: 'range',
      surah: 2,
      startAyah: 255,
      endAyah: 257,
    });
    expect(() => createQueueEntry(2, 10, 9, 'bad')).toThrow(RangeError);
  });

  it('preserves queue order, permits intentional repeats, and reorders immutably', () => {
    const first = createQueueEntry(1, 1, 7, 'first');
    const repeated = createQueueEntry(1, 1, 7, 'repeat');
    const third = createQueueEntry(2, 1, 5, 'third');
    const queue = appendQueue(appendQueue([], first), repeated);
    expect(queue.map((entry) => entry.id)).toEqual(['first', 'repeat']);
    expect(moveQueueEntry([...queue, third], 2, 0).map((entry) => entry.id)).toEqual([
      'third',
      'first',
      'repeat',
    ]);
    expect(removeQueueEntry(queue, 'first').map((entry) => entry.id)).toEqual(['repeat']);
  });

  it('creates named playlists and adds ordered ranges', () => {
    const playlist = createPlaylist('Morning recitation', 'morning', 100);
    const updated = addPlaylistItem(
      playlist,
      createQueueEntry(112, 1, 4, 'ikhlas'),
      200,
    );
    expect(updated).toMatchObject({
      id: 'morning',
      name: 'Morning recitation',
      createdAt: 100,
      updatedAt: 200,
    });
    expect(updated.items.map((item) => item.surah)).toEqual([112]);
    expect(() => createPlaylist('   ', 'empty', 100)).toThrow(RangeError);
  });

  it('parses valid persisted state while dropping corrupt ranges and playlists', () => {
    expect(parsePlaybackLibrary(JSON.stringify({
      queue: [
        { id: 'valid', surah: 114, startAyah: 1, endAyah: 6 },
        { id: 'bad', surah: 114, startAyah: 1, endAyah: 7 },
      ],
      playlists: [
        {
          id: 'saved',
          name: 'Saved',
          createdAt: 10,
          updatedAt: 20,
          items: [{ id: 'entry', surah: 1, startAyah: 1, endAyah: 7 }],
        },
        { id: '', name: 'Broken', createdAt: 1, updatedAt: 1, items: [] },
      ],
    }))).toEqual({
      queue: [{ id: 'valid', surah: 114, startAyah: 1, endAyah: 6 }],
      playlists: [{
        id: 'saved',
        name: 'Saved',
        createdAt: 10,
        updatedAt: 20,
        items: [{ id: 'entry', surah: 1, startAyah: 1, endAyah: 7 }],
      }],
    });
    expect(parsePlaybackLibrary('{broken')).toEqual({ queue: [], playlists: [] });
  });
});
