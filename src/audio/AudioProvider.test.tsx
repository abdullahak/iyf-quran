import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { AudioProvider, useQuranAudio } from './AudioProvider';
import { PlaybackLibraryProvider, usePlaybackLibrary } from './PlaybackLibraryProvider';
import { configureHeadsetControls } from './headsetControls';
import { createPlaybackEndRule } from './playbackEndRule';
import { remoteCommandConfiguration } from './remoteCommands';
import { SYNCHRONIZED_TIMINGS } from './timings';
import { chapterByNumber } from '../data/chapters';

const mockStatus = {
  currentTime: 0,
  didJustFinish: false,
  duration: 100,
  playing: false,
};
const mockPlayer = {
  clearLockScreenControls: jest.fn(),
  currentTime: 0,
  duration: 100,
  pause: jest.fn(),
  play: jest.fn(),
  playing: false,
  replace: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
  setActiveForLockScreen: jest.fn(),
  setPlaybackRate: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
};
const mockSettings = { reciterId: 'muhammad-al-faqih' };

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  useAudioPlayer: jest.fn(() => mockPlayer),
  useAudioPlayerStatus: jest.fn(() => mockStatus),
}));

jest.mock('./OfflineAudioProvider', () => ({
  useOfflineAudio: () => ({ localUri: () => undefined }),
}));

jest.mock('../settings/AppSettingsProvider', () => ({
  useAppSettings: () => ({ settings: mockSettings }),
}));

jest.mock('./headsetControls', () => ({
  addHeadsetCommandListener: () => () => undefined,
  configureHeadsetControls: jest.fn(),
}));

function Wrapper({ children }: PropsWithChildren) {
  return (
    <PlaybackLibraryProvider>
      <AudioProvider>{children}</AudioProvider>
    </PlaybackLibraryProvider>
  );
}

describe('AudioProvider queue positioning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayer.currentTime = 0;
    mockPlayer.duration = 100;
    mockPlayer.playing = false;
    mockStatus.currentTime = 0;
    mockStatus.didJustFinish = false;
    mockStatus.duration = 100;
    mockStatus.playing = false;
    mockSettings.reciterId = 'muhammad-al-faqih';
    mockPlayer.seekTo.mockResolvedValue(undefined);
  });

  it('waits for the current item, then consumes exact queued ranges in order and clears at the end', async () => {
    const currentChapter = chapterByNumber(1)!;
    const queuedChapter = chapterByNumber(2)!;
    const firstStart = SYNCHRONIZED_TIMINGS[2]!.find((timing) => timing.ayah === 1)!.start;
    const firstEnd = SYNCHRONIZED_TIMINGS[2]!.find((timing) => timing.ayah === 1)!.end;
    const secondStart = SYNCHRONIZED_TIMINGS[2]!.find((timing) => timing.ayah === 2)!.start;
    const secondEnd = SYNCHRONIZED_TIMINGS[2]!.find((timing) => timing.ayah === 3)!.end;
    const { rerender, result } = await renderHook(() => ({
      audio: useQuranAudio(),
      library: usePlaybackLibrary(),
    }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.library.ready).toBe(true));

    await act(() => result.current.audio.playChapter(currentChapter));
    jest.clearAllMocks();
    await act(() => {
      result.current.library.enqueueRange(queuedChapter.number, 1, 1);
      result.current.library.enqueueRange(queuedChapter.number, 2, 3);
    });

    expect(result.current.library.queue).toHaveLength(2);
    expect(mockPlayer.pause).not.toHaveBeenCalled();
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.replace).not.toHaveBeenCalled();
    expect(mockPlayer.seekTo).not.toHaveBeenCalled();

    mockStatus.currentTime = mockStatus.duration;
    mockStatus.didJustFinish = true;
    await rerender(undefined);
    await waitFor(() => expect(result.current.audio.activeQueueEntry).toMatchObject({
      surah: 2,
      startAyah: 1,
      endAyah: 1,
    }));
    expect(mockPlayer.seekTo).toHaveBeenLastCalledWith(0, 50, 50);

    mockPlayer.playing = true;
    mockStatus.currentTime = 0;
    mockStatus.didJustFinish = false;
    mockStatus.playing = true;
    await rerender(undefined);
    mockStatus.currentTime = firstStart;
    await rerender(undefined);
    mockStatus.currentTime = firstEnd;
    await rerender(undefined);
    await waitFor(() => expect(result.current.audio.activeQueueEntry).toMatchObject({
      surah: 2,
      startAyah: 2,
      endAyah: 3,
    }));
    expect(result.current.library.queue).toHaveLength(1);
    expect(result.current.library.queue[0]).toMatchObject({ startAyah: 2, endAyah: 3 });
    expect(mockPlayer.seekTo).toHaveBeenLastCalledWith(secondStart, 50, 50);

    mockStatus.currentTime = secondStart;
    await rerender(undefined);
    mockStatus.currentTime = secondEnd;
    await rerender(undefined);
    await waitFor(() => expect(result.current.audio.activeQueueEntry).toBeUndefined());
    expect(result.current.library.queue).toEqual([]);
    expect(mockPlayer.pause).toHaveBeenCalled();
  });

  it('keeps an idle enqueue waiting until manual queue play starts its exact range', async () => {
    const start = SYNCHRONIZED_TIMINGS[2]!.find((timing) => timing.ayah === 8)!.start;
    const { result } = await renderHook(() => ({
      audio: useQuranAudio(),
      library: usePlaybackLibrary(),
    }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.library.ready).toBe(true));

    await act(() => {
      result.current.library.enqueueRange(2, 8, 10);
    });
    expect(result.current.audio.activeQueueEntry).toBeUndefined();
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.seekTo).not.toHaveBeenCalled();

    let started = false;
    await act(async () => {
      started = await result.current.audio.playLibraryQueue();
    });
    expect(started).toBe(true);
    expect(result.current.audio.activeQueueEntry).toMatchObject({
      surah: 2, startAyah: 8, endAyah: 10,
    });
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(start, 50, 50);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('makes play-from-Ayah continue only through the end of that Surah', async () => {
    const chapter = chapterByNumber(2)!;
    const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(chapter));
    await act(() => result.current.setPlaybackScope('page'));
    expect(result.current.endRule.kind).toBe('page');

    let started = false;
    await act(async () => {
      started = await result.current.playFromAyah(chapter, 2);
    });

    expect(started).toBe(true);
    expect(result.current.endRule).toEqual({ kind: 'surah' });
  });

  it('starts the first Ayah from the very beginning of the Surah track', async () => {
    const chapter = chapterByNumber(2)!;
    const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    jest.clearAllMocks();
    let started = false;
    await act(async () => {
      started = await result.current.playFromAyah(chapter, 1);
    });

    expect(started).toBe(true);
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0, 50, 50);
    expect(result.current.endRule).toEqual({ kind: 'surah' });
  });

  it('seeks the first Ayah to the very beginning of the loaded Surah track', async () => {
    const chapter = chapterByNumber(2)!;
    const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(chapter));
    jest.clearAllMocks();

    await act(() => result.current.seekToAyah(1));

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0, 50, 50);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('does not map stale time from the previous Surah onto a newly commanded source', async () => {
    const firstChapter = chapterByNumber(1)!;
    const nextChapter = chapterByNumber(2)!;
    const { rerender, result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(firstChapter));
    mockStatus.currentTime = 50;
    mockStatus.playing = true;
    await rerender(undefined);

    await act(() => result.current.playFromAyah(nextChapter, 1));

    expect(result.current.chapter?.number).toBe(2);
    expect(result.current.activeAyah).toBeUndefined();
  });

  it('keeps Previous usable on the first Surah by restarting the track', async () => {
    const chapter = chapterByNumber(1)!;
    const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(chapter));
    expect(result.current.canPlayPrevious).toBe(true);
    jest.clearAllMocks();

    await act(() => result.current.previousChapter());

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0, 50, 50);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('keeps Next usable at a queue edge by continuing to the adjacent Surah', async () => {
    const chapter = chapterByNumber(1)!;
    const entry = { id: 'only-entry', surah: 1, startAyah: 1, endAyah: chapter.ayahCount };
    const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playQueue([entry]));
    expect(result.current.canPlayNext).toBe(true);

    await act(() => result.current.nextChapter());

    expect(result.current.chapter?.number).toBe(2);
    expect(result.current.activeQueueEntry).toBeUndefined();
  });

  it.each(['page', 'juz'] as const)(
    'rebases a selected %s scope when a chapter is started manually',
    async (scope) => {
      const firstChapter = chapterByNumber(1)!;
      const nextChapter = chapterByNumber(3)!;
      const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

      await act(() => result.current.playChapter(firstChapter));
      await act(() => result.current.setPlaybackScope(scope));
      expect(result.current.endRule).toEqual(createPlaybackEndRule(scope, 1, 1));

      await act(() => result.current.playChapter(nextChapter));
      expect(result.current.endRule).toEqual(createPlaybackEndRule(scope, 3, 1));
    },
  );

  it('preserves an absolute sleep timer across queue start and queue advance', async () => {
    const firstChapter = chapterByNumber(1)!;
    const secondChapter = chapterByNumber(2)!;
    const entries = [
      { id: 'timer-first', surah: 1, startAyah: 1, endAyah: firstChapter.ayahCount },
      { id: 'timer-second', surah: 2, startAyah: 1, endAyah: secondChapter.ayahCount },
    ];
    const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(firstChapter));
    await act(() => result.current.setSleepTimer(30));
    const timer = result.current.endRule;
    expect(timer).toMatchObject({ kind: 'timer', durationMinutes: 30 });

    await act(() => result.current.playQueue(entries));
    expect(result.current.endRule).toEqual(timer);
    await act(() => result.current.nextChapter());
    expect(result.current.endRule).toEqual(timer);

    await act(() => result.current.setSleepTimer(undefined));
  });

  it('pauses and positions a same-source queue entry before publishing or playing it', async () => {
    const chapter = chapterByNumber(1)!;
    const entry = { id: 'same-source', surah: 1, startAyah: 1, endAyah: chapter.ayahCount };
    const { rerender, result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(chapter));
    expect(result.current.chapter).toEqual(chapter);

    jest.clearAllMocks();
    mockPlayer.currentTime = 25;
    mockPlayer.playing = true;
    let resolveSeek!: () => void;
    mockPlayer.seekTo.mockReturnValue(new Promise<void>((resolve) => {
      resolveSeek = resolve;
    }));

    let startPromise!: Promise<boolean>;
    await act(async () => {
      startPromise = result.current.playQueue([entry]);
      await Promise.resolve();
    });
    await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(0, 50, 50));

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.activeQueueEntry).toBeUndefined();

    await act(async () => {
      resolveSeek();
      await startPromise;
    });

    expect(result.current.activeQueueEntry).toEqual(entry);
    expect(mockPlayer.pause.mock.invocationCallOrder[0]).toBeLessThan(
      mockPlayer.seekTo.mock.invocationCallOrder[0],
    );
    expect(mockPlayer.seekTo.mock.invocationCallOrder[0]).toBeLessThan(
      mockPlayer.play.mock.invocationCallOrder[0],
    );

    const ayahOneRange = {
      id: 'ayah-one-range',
      surah: 1,
      startAyah: 1,
      endAyah: 2,
    };
    await act(() => result.current.playQueue([entry, ayahOneRange]));
    jest.clearAllMocks();
    mockPlayer.playing = true;
    let resolveNextSeek!: () => void;
    mockPlayer.seekTo.mockReturnValue(new Promise<void>((resolve) => {
      resolveNextSeek = resolve;
    }));

    let nextPromise!: Promise<void>;
    await act(async () => {
      nextPromise = result.current.nextChapter();
      await Promise.resolve();
    });
    const firstAyahStart = SYNCHRONIZED_TIMINGS[1]![0]!.start;
    await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(0, 50, 50));

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.activeQueueEntry).toEqual(entry);

    await act(async () => {
      resolveNextSeek();
      await nextPromise;
    });

    expect(result.current.activeQueueEntry).toEqual(ayahOneRange);
    expect(mockPlayer.pause.mock.invocationCallOrder[0]).toBeLessThan(
      mockPlayer.seekTo.mock.invocationCallOrder[0],
    );
    expect(mockPlayer.seekTo.mock.invocationCallOrder[0]).toBeLessThan(
      mockPlayer.play.mock.invocationCallOrder[0],
    );

    const rangeEnd = SYNCHRONIZED_TIMINGS[1]!.find((timing) => timing.ayah === 2)!.end;
    mockStatus.playing = true;
    mockStatus.currentTime = rangeEnd + 10;
    await rerender(undefined);
    expect(result.current.activeQueueEntry).toEqual(ayahOneRange);

    mockStatus.currentTime = firstAyahStart;
    await rerender(undefined);
    expect(result.current.activeQueueEntry).toEqual(ayahOneRange);

    mockStatus.currentTime = rangeEnd;
    await rerender(undefined);
    await waitFor(() => expect(result.current.activeQueueEntry).toBeUndefined());
  });

  it('ignores old range-end and finish advances emitted while the next queue seek is pending', async () => {
    const chapter = chapterByNumber(1)!;
    const repeatedRange = {
      id: 'duplicate-id',
      surah: 1,
      startAyah: 1,
      endAyah: 2,
    };
    const entries = [repeatedRange, { ...repeatedRange }];
    const start = SYNCHRONIZED_TIMINGS[1]!.find((timing) => timing.ayah === 1)!.start;
    const end = SYNCHRONIZED_TIMINGS[1]!.find((timing) => timing.ayah === 2)!.end;
    const { rerender, result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(chapter));
    await act(() => result.current.playQueue(entries));
    mockPlayer.playing = true;
    mockStatus.playing = true;
    mockStatus.currentTime = start;
    await rerender(undefined);
    expect(result.current.queueIndex).toBe(0);

    jest.clearAllMocks();
    let resolveSeek!: () => void;
    mockPlayer.seekTo.mockReturnValue(new Promise<void>((resolve) => {
      resolveSeek = resolve;
    }));
    let nextPromise!: Promise<void>;
    await act(async () => {
      nextPromise = result.current.nextChapter();
      await Promise.resolve();
    });
    await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(0, 50, 50));

    mockStatus.currentTime = end;
    mockStatus.didJustFinish = true;
    await rerender(undefined);
    await act(async () => {
      resolveSeek();
      await nextPromise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.queueIndex).toBe(1);
    expect(result.current.activeQueueEntry).toEqual(entries[1]);
  });

  it('requires a fresh near-target status before rearming a repeated whole-Surah entry', async () => {
    const chapter = chapterByNumber(1)!;
    const wholeSurah = {
      id: 'duplicate-whole-surah',
      surah: 1,
      startAyah: 1,
      endAyah: chapter.ayahCount,
    };
    const entries = [wholeSurah, { ...wholeSurah }];
    const { rerender, result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(chapter));
    await act(() => result.current.playQueue(entries));
    mockPlayer.playing = true;
    mockStatus.playing = true;
    mockStatus.currentTime = 0;
    await rerender(undefined);

    let resolveSeek!: () => void;
    mockPlayer.seekTo.mockReturnValue(new Promise<void>((resolve) => {
      resolveSeek = resolve;
    }));
    let nextPromise!: Promise<void>;
    await act(async () => {
      nextPromise = result.current.nextChapter();
      await Promise.resolve();
    });
    await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenLastCalledWith(0, 50, 50));
    await act(async () => {
      resolveSeek();
      await nextPromise;
    });
    expect(result.current.queueIndex).toBe(1);

    mockStatus.currentTime = 50;
    await rerender(undefined);
    mockStatus.currentTime = 100;
    mockStatus.didJustFinish = true;
    await rerender(undefined);
    await act(async () => Promise.resolve());

    expect(result.current.queueIndex).toBe(1);

    mockStatus.currentTime = 0;
    mockStatus.didJustFinish = false;
    await rerender(undefined);
    mockStatus.currentTime = 100;
    mockStatus.didJustFinish = true;
    await rerender(undefined);
    await waitFor(() => expect(result.current.activeQueueEntry).toBeUndefined());
  });

  it('keeps the starting reciter when Settings changes during an active queue', async () => {
    const first = {
      id: 'reciter-bound-first',
      surah: 1,
      startAyah: 1,
      endAyah: 2,
    };
    const second = {
      id: 'reciter-bound-second',
      surah: 1,
      startAyah: 3,
      endAyah: 4,
    };
    const firstStart = SYNCHRONIZED_TIMINGS[1]!.find((timing) => timing.ayah === 1)!.start;
    const secondStart = SYNCHRONIZED_TIMINGS[1]!.find((timing) => timing.ayah === 3)!.start;
    const { rerender, result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playQueue([first, second]));
    mockPlayer.playing = true;
    mockStatus.playing = true;
    mockStatus.currentTime = firstStart;
    await rerender(undefined);
    expect(result.current.reciter.id).toBe('muhammad-al-faqih');

    mockSettings.reciterId = 'mishary-alafasi';
    await rerender(undefined);
    await act(() => result.current.nextChapter());

    expect(result.current.queueIndex).toBe(1);
    expect(result.current.activeQueueEntry).toEqual(second);
    expect(result.current.reciter.id).toBe('muhammad-al-faqih');
    expect(mockPlayer.seekTo).toHaveBeenLastCalledWith(secondStart, 50, 50);
  });

  it('publishes a coherent paused source and clears the queue when a source-changing seek fails', async () => {
    const firstChapter = chapterByNumber(1)!;
    const nextChapter = chapterByNumber(2)!;
    const firstEntry = {
      id: 'first-source',
      surah: 1,
      startAyah: 1,
      endAyah: firstChapter.ayahCount,
    };
    const nextEntry = {
      id: 'replacement-source',
      surah: 2,
      startAyah: 1,
      endAyah: nextChapter.ayahCount,
    };
    const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(firstChapter));
    await act(() => result.current.playQueue([firstEntry]));
    jest.clearAllMocks();
    mockPlayer.seekTo.mockRejectedValueOnce(new Error('Native seek failed.'));

    let started!: boolean;
    await act(async () => {
      started = await result.current.playQueue([nextEntry]);
    });

    expect(started).toBe(false);
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.chapter).toEqual(nextChapter);
    expect(result.current.sourceKind).toBe('streaming');
    expect(result.current.activeQueueEntry).toBeUndefined();
    expect(result.current.endRule).toEqual({ kind: 'continuous' });
    expect(mockPlayer.updateLockScreenMetadata).toHaveBeenCalledWith(expect.objectContaining({
      title: `Surah ${nextChapter.englishName}`,
    }));
    expect(configureHeadsetControls).toHaveBeenLastCalledWith(
      remoteCommandConfiguration(nextChapter.number),
    );
  });

  it('serializes public free and Ayah seeks behind an in-flight queue seek', async () => {
    const chapter = chapterByNumber(1)!;
    const entry = {
      id: 'serialized-seek',
      surah: 1,
      startAyah: 1,
      endAyah: chapter.ayahCount,
    };
    const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(chapter));
    jest.clearAllMocks();
    let resolveQueueSeek!: () => void;
    mockPlayer.seekTo
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        resolveQueueSeek = resolve;
      }))
      .mockResolvedValue(undefined);

    let queuePromise!: Promise<boolean>;
    await act(async () => {
      queuePromise = result.current.playQueue([entry]);
      await Promise.resolve();
    });
    await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledTimes(1));

    let freeSeekPromise!: Promise<void>;
    await act(async () => {
      freeSeekPromise = result.current.seekTo(40);
      await Promise.resolve();
    });
    let ayahSeekPromise!: Promise<void>;
    await act(async () => {
      ayahSeekPromise = result.current.seekToAyah(2);
      await Promise.resolve();
    });
    expect(mockPlayer.seekTo).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveQueueSeek();
      await queuePromise;
      await freeSeekPromise;
      await ayahSeekPromise;
    });
    const ayahTwoStart = SYNCHRONIZED_TIMINGS[1]!.find((timing) => timing.ayah === 2)!.start;
    expect(mockPlayer.seekTo.mock.calls).toEqual([
      [0, 50, 50],
      [40, 50, 50],
      [ayahTwoStart, 50, 50],
    ]);
  });

  it('keeps a paused free seek protected through resume until a fresh near-target status arrives', async () => {
    const first = {
      id: 'paused-seek-first',
      surah: 1,
      startAyah: 1,
      endAyah: 2,
    };
    const second = {
      id: 'paused-seek-second',
      surah: 1,
      startAyah: 3,
      endAyah: 4,
    };
    const firstStart = SYNCHRONIZED_TIMINGS[1]!.find((timing) => timing.ayah === 1)!.start;
    const firstEnd = SYNCHRONIZED_TIMINGS[1]!.find((timing) => timing.ayah === 2)!.end;
    const seekTarget = firstStart + 0.25;
    const { rerender, result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playQueue([first, second]));
    mockPlayer.playing = true;
    mockStatus.playing = true;
    mockStatus.currentTime = firstStart;
    await rerender(undefined);
    expect(result.current.queueIndex).toBe(0);

    mockPlayer.playing = false;
    mockStatus.playing = false;
    await rerender(undefined);
    await act(() => result.current.seekTo(seekTarget));
    await act(() => result.current.toggle());

    mockStatus.playing = true;
    mockStatus.currentTime = firstEnd;
    mockStatus.didJustFinish = true;
    await rerender(undefined);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.queueIndex).toBe(0);

    mockStatus.didJustFinish = false;
    mockStatus.currentTime = seekTarget;
    await rerender(undefined);
    mockStatus.currentTime = firstEnd;
    await rerender(undefined);
    await waitFor(() => expect(result.current.queueIndex).toBe(1));
  });

  it.each(['free', 'Ayah'] as const)(
    'does not let deferred page expiry interrupt a newer %s seek',
    async (seekKind) => {
      const realSetTimeout = globalThis.setTimeout;
      let expireEndRule: (() => void) | undefined;
      const chapter = chapterByNumber(2)!;
      const { rerender, result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

      await act(() => result.current.playChapter(chapter));
      mockPlayer.currentTime = 0;
      mockPlayer.playing = true;
      mockStatus.currentTime = 0;
      mockStatus.playing = true;
      await rerender(undefined);
      await act(() => result.current.setPlaybackScope('page'));
      const pageRule = result.current.endRule;
      expect(pageRule.kind).toBe('page');
      if (pageRule.kind !== 'page') throw new Error('Expected a page rule.');
      const endTiming = SYNCHRONIZED_TIMINGS[pageRule.end.surah]!
        .find((timing) => timing.ayah === pageRule.end.ayah)!;

      const timeoutSpy = jest.spyOn(globalThis, 'setTimeout').mockImplementation((
        ...parameters: Parameters<typeof globalThis.setTimeout>
      ) => {
        const [callback, delay, ...args] = parameters;
        if (typeof callback === 'function' && (delay ?? 0) === 0 && !expireEndRule) {
          expireEndRule = () => callback(...args);
          return 1 as unknown as ReturnType<typeof setTimeout>;
        }
        return realSetTimeout(...parameters);
      });
      try {
        mockStatus.currentTime = endTiming.end;
        await rerender(undefined);
        expect(expireEndRule).toEqual(expect.any(Function));

        let resolveSeek!: () => void;
        mockPlayer.seekTo.mockReturnValueOnce(new Promise<void>((resolve) => {
          resolveSeek = resolve;
        }));
        let seekPromise!: Promise<void>;
        await act(async () => {
          seekPromise = seekKind === 'free'
            ? result.current.seekTo(1)
            : result.current.seekToAyah(2);
          await Promise.resolve();
        });
        await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalled());
        await act(async () => {
          expireEndRule!();
          await Promise.resolve();
        });
        await act(async () => {
          resolveSeek();
          await seekPromise;
          await Promise.resolve();
        });

        expect(result.current.endRule.kind).toBe('page');
      } finally {
        timeoutSpy.mockRestore();
      }
    },
  );

  it('serializes queue clearing behind an in-flight queue start', async () => {
    const chapter = chapterByNumber(1)!;
    const entry = {
      id: 'clear-during-start',
      surah: 1,
      startAyah: 1,
      endAyah: chapter.ayahCount,
    };
    const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(chapter));
    let resolveQueueSeek!: () => void;
    mockPlayer.seekTo.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolveQueueSeek = resolve;
    }));
    let queuePromise!: Promise<boolean>;
    await act(async () => {
      queuePromise = result.current.playQueue([entry]);
      await Promise.resolve();
    });
    await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(0, 50, 50));

    let clearPromise!: Promise<void>;
    await act(async () => {
      clearPromise = result.current.clearPlaybackQueue();
      await Promise.resolve();
    });
    await act(async () => {
      resolveQueueSeek();
      await queuePromise;
      await clearPromise;
      await Promise.resolve();
    });

    expect(result.current.activeQueueEntry).toBeUndefined();
    expect(result.current.endRule).toEqual({ kind: 'surah' });
  });

  it('serializes playback-scope changes behind an in-flight queue start', async () => {
    const chapter = chapterByNumber(1)!;
    const entry = {
      id: 'scope-during-start',
      surah: 1,
      startAyah: 1,
      endAyah: chapter.ayahCount,
    };
    const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(chapter));
    let resolveQueueSeek!: () => void;
    mockPlayer.seekTo.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolveQueueSeek = resolve;
    }));
    let queuePromise!: Promise<boolean>;
    await act(async () => {
      queuePromise = result.current.playQueue([entry]);
      await Promise.resolve();
    });
    await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(0, 50, 50));

    let scopePromise!: Promise<boolean>;
    await act(async () => {
      scopePromise = result.current.setPlaybackScope('surah');
      await Promise.resolve();
    });
    let applied!: boolean;
    await act(async () => {
      resolveQueueSeek();
      await queuePromise;
      applied = await scopePromise;
      await Promise.resolve();
    });

    expect(applied).toBe(true);
    expect(result.current.activeQueueEntry).toBeUndefined();
    expect(result.current.endRule).toEqual({ kind: 'surah' });
  });

  it('serializes sleep-timer changes behind an in-flight queue start', async () => {
    const chapter = chapterByNumber(1)!;
    const entry = {
      id: 'timer-during-start',
      surah: 1,
      startAyah: 1,
      endAyah: chapter.ayahCount,
    };
    const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(chapter));
    let resolveQueueSeek!: () => void;
    mockPlayer.seekTo.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolveQueueSeek = resolve;
    }));
    let queuePromise!: Promise<boolean>;
    await act(async () => {
      queuePromise = result.current.playQueue([entry]);
      await Promise.resolve();
    });
    await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(0, 50, 50));

    let timerPromise!: Promise<void>;
    await act(async () => {
      timerPromise = result.current.setSleepTimer(30);
      await Promise.resolve();
    });
    await act(async () => {
      resolveQueueSeek();
      await queuePromise;
      await timerPromise;
      await Promise.resolve();
    });

    expect(result.current.endRule).toMatchObject({ kind: 'timer', durationMinutes: 30 });
  });

  it('lets timer expiry wait behind an in-flight queue start and then pause the queue', async () => {
    const realSetTimeout = globalThis.setTimeout;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(0);
    let expireTimer!: () => void;
    const timeoutSpy = jest.spyOn(globalThis, 'setTimeout').mockImplementation((
      ...parameters: Parameters<typeof globalThis.setTimeout>
    ) => {
      const [callback, delay, ...args] = parameters;
      if (typeof callback === 'function' && (delay ?? 0) > 59_000) {
        expireTimer = () => callback(...args);
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }
      return realSetTimeout(...parameters);
    });
    try {
      const chapter = chapterByNumber(1)!;
      const entry = {
        id: 'timer-expiry-during-start',
        surah: 1,
        startAyah: 1,
        endAyah: chapter.ayahCount,
      };
      const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

      await act(() => result.current.playChapter(chapter));
      await act(() => result.current.setSleepTimer(1));
      jest.clearAllMocks();
      let resolveQueueSeek!: () => void;
      mockPlayer.seekTo.mockReturnValueOnce(new Promise<void>((resolve) => {
        resolveQueueSeek = resolve;
      }));
      let queuePromise!: Promise<boolean>;
      await act(async () => {
        queuePromise = result.current.playQueue([entry]);
        await Promise.resolve();
      });
      expect(mockPlayer.pause).toHaveBeenCalledTimes(1);

      await act(async () => {
        nowSpy.mockReturnValue(60_000);
        expireTimer();
        await Promise.resolve();
      });
      expect(mockPlayer.pause).toHaveBeenCalledTimes(1);

      let started!: boolean;
      await act(async () => {
        resolveQueueSeek();
        started = await queuePromise;
        await result.current.setSleepTimer(undefined);
      });
      expect(started).toBe(true);
      expect(result.current.activeQueueEntry).toEqual(entry);
      expect(result.current.endRule).toEqual({ kind: 'continuous' });
      expect(mockPlayer.play).toHaveBeenCalledTimes(1);
      expect(mockPlayer.pause).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
      timeoutSpy.mockRestore();
    }
  });

  it('defers a nonzero source-changing queue start until exact positioning and then publishes queue metadata', async () => {
    const firstChapter = chapterByNumber(1)!;
    const nextChapter = chapterByNumber(2)!;
    const entries = [
      {
        id: 'source-one',
        surah: 1,
        startAyah: 1,
        endAyah: firstChapter.ayahCount,
      },
      {
        id: 'source-two',
        surah: 2,
        startAyah: 1,
        endAyah: nextChapter.ayahCount,
      },
    ];
    const { result } = await renderHook(() => useQuranAudio(), { wrapper: Wrapper });

    await act(() => result.current.playChapter(firstChapter));
    jest.clearAllMocks();
    let resolveSeek!: () => void;
    mockPlayer.seekTo.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolveSeek = resolve;
    }));
    let queuePromise!: Promise<boolean>;
    await act(async () => {
      queuePromise = result.current.playQueue(entries, 1);
      await Promise.resolve();
    });
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());

    expect(result.current.chapter).toEqual(firstChapter);
    expect(result.current.activeQueueEntry).toBeUndefined();
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(configureHeadsetControls).not.toHaveBeenCalled();

    let started!: boolean;
    await act(async () => {
      resolveSeek();
      started = await queuePromise;
    });

    expect(started).toBe(true);
    expect(result.current.chapter).toEqual(nextChapter);
    expect(result.current.queueIndex).toBe(1);
    expect(result.current.activeQueueEntry).toEqual(entries[1]);
    expect(mockPlayer.updateLockScreenMetadata).toHaveBeenCalledWith(expect.objectContaining({
      title: `Surah ${nextChapter.englishName}`,
    }));
    expect(configureHeadsetControls).toHaveBeenLastCalledWith(
      remoteCommandConfiguration(nextChapter.number, { index: 1, count: 2 }),
    );
    const playOrder = mockPlayer.play.mock.invocationCallOrder.at(-1)!;
    const remoteOrder = (configureHeadsetControls as jest.Mock).mock.invocationCallOrder.at(-1)!;
    expect(playOrder).toBeLessThan(remoteOrder);
  });
});
