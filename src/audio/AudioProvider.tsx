import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioStatus,
} from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  addHeadsetCommandListener,
  configureHeadsetControls,
} from '@/audio/headsetControls';
import { useOfflineAudio } from '@/audio/OfflineAudioProvider';
import { adjacentSurah, finishTransition } from '@/audio/playbackQueue';
import { enqueueSerial } from '@/audio/serialQueue';
import { MUHAMMAD_AL_FAQIH, recitationUrl } from '@/audio/reciter';
import { activeAyahAt, SYNCHRONIZED_TIMINGS } from '@/audio/timings';
import { chapterByNumber, type Chapter } from '@/data/chapters';

export type TimingStatus = 'machineAligned' | 'unavailable' | 'verified';

type AudioContextValue = {
  chapter: Chapter | undefined;
  status: AudioStatus;
  activeAyah: number | undefined;
  timingStatus: TimingStatus;
  sourceKind: 'offline' | 'streaming' | undefined;
  canPlayNext: boolean;
  canPlayPrevious: boolean;
  playChapter: (chapter: Chapter) => Promise<void>;
  nextChapter: () => Promise<void>;
  previousChapter: () => Promise<void>;
  toggle: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  seekToAyah: (ayah: number) => Promise<void>;
};

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { localUri } = useOfflineAudio();
  const player = useAudioPlayer(null, {
    updateInterval: 200,
    preferredForwardBufferDuration: 15,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);
  const [chapter, setChapter] = useState<Chapter>();
  const [sourceKind, setSourceKind] = useState<'offline' | 'streaming'>();
  const chapterRef = useRef(chapter);
  const finishHandledRef = useRef(false);
  const audioModePromiseRef = useRef<Promise<void> | undefined>(undefined);
  const actionQueueRef = useRef(Promise.resolve());
  const lockScreenActiveRef = useRef(false);

  const ensureAudioMode = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (!audioModePromiseRef.current) {
      audioModePromiseRef.current = setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
    }
    try {
      await audioModePromiseRef.current;
    } catch (error) {
      audioModePromiseRef.current = undefined;
      throw error;
    }
  }, []);

  useEffect(() => {
    void ensureAudioMode().catch(() => undefined);
  }, [ensureAudioMode]);

  const startChapter = useCallback(
    async (nextChapter: Chapter) => {
      await ensureAudioMode();
      if (chapterRef.current?.number !== nextChapter.number) {
        const downloadedUri = localUri(nextChapter.number);
        player.pause();
        player.replace({
          uri: downloadedUri ?? recitationUrl(nextChapter),
          name: nextChapter.englishName,
        });
        setChapter(nextChapter);
        chapterRef.current = nextChapter;
        setSourceKind(downloadedUri ? 'offline' : 'streaming');
      }
      player.play();
      const metadata = {
        title: `Surah ${nextChapter.englishName}`,
        artist: MUHAMMAD_AL_FAQIH.name,
        albumTitle: 'IYF Quran',
        artworkUrl: MUHAMMAD_AL_FAQIH.artworkUrl,
      };
      try {
        if (Platform.OS === 'web') return;
        if (lockScreenActiveRef.current) {
          player.updateLockScreenMetadata(metadata);
        } else {
          player.setActiveForLockScreen(
            true,
            metadata,
            { showSeekBackward: false, showSeekForward: false },
          );
          lockScreenActiveRef.current = true;
        }
      } catch {
        // Optional lock-screen metadata must not prevent core playback.
      }
    },
    [ensureAudioMode, localUri, player],
  );

  const enqueueAction = useCallback((action: () => Promise<void>): Promise<void> => {
    return enqueueSerial(actionQueueRef, action);
  }, []);

  const playChapter = useCallback(
    (nextChapter: Chapter) => enqueueAction(() => startChapter(nextChapter)),
    [enqueueAction, startChapter],
  );

  const moveChapter = useCallback((direction: -1 | 1) => enqueueAction(async () => {
    const current = chapterRef.current;
    if (!current) return;
    const number = adjacentSurah(current.number, direction);
    const next = number ? chapterByNumber(number) : undefined;
    if (next) await startChapter(next);
  }), [enqueueAction, startChapter]);

  const nextChapter = useCallback(() => moveChapter(1), [moveChapter]);
  const previousChapter = useCallback(() => moveChapter(-1), [moveChapter]);
  const canPlayNext = Boolean(chapter && adjacentSurah(chapter.number, 1));
  const canPlayPrevious = Boolean(chapter && adjacentSurah(chapter.number, -1));

  const toggle = useCallback(() => enqueueAction(async () => {
    if (!chapterRef.current) return;
    await ensureAudioMode();
    if (player.playing) player.pause();
    else player.play();
  }), [enqueueAction, ensureAudioMode, player]);

  useEffect(
    () => addHeadsetCommandListener((command) => {
      if (command === 'next') void nextChapter();
      else void previousChapter();
    }),
    [nextChapter, previousChapter],
  );

  useEffect(() => {
    configureHeadsetControls(Boolean(chapter), canPlayPrevious, canPlayNext);
  }, [canPlayNext, canPlayPrevious, chapter]);

  useEffect(() => () => {
    configureHeadsetControls(false, false, false);
    if (!lockScreenActiveRef.current) return;
    try {
      player.clearLockScreenControls();
    } catch {
      // The player may already have been released during native teardown.
    }
    lockScreenActiveRef.current = false;
  }, [player]);

  useEffect(() => {
    const transition = finishTransition(finishHandledRef.current, status.didJustFinish);
    finishHandledRef.current = transition.handled;
    if (!transition.advance || !chapter) return;
    void nextChapter();
  }, [chapter, nextChapter, status.didJustFinish]);

  const timings = chapter ? SYNCHRONIZED_TIMINGS[chapter.number] : undefined;
  const seekTo = useCallback(async (seconds: number) => {
    const duration = Number.isFinite(status.duration) ? status.duration : 0;
    const target = Math.max(0, Math.min(seconds, duration));
    await player.seekTo(target, 50, 50);
  }, [player, status.duration]);
  const seekToAyah = useCallback(
    async (ayah: number) => {
      const timing = timings?.find((candidate) => candidate.ayah === ayah);
      if (!timing) return;
      await player.seekTo(timing.start, 50, 50);
      player.play();
    },
    [player, timings],
  );

  const value = useMemo<AudioContextValue>(
    () => ({
      chapter,
      status,
      activeAyah: activeAyahAt(timings, status.currentTime),
      timingStatus: timings?.[0]?.reviewStatus ?? 'unavailable',
      sourceKind,
      canPlayNext,
      canPlayPrevious,
      playChapter,
      nextChapter,
      previousChapter,
      toggle,
      seekTo,
      seekToAyah,
    }),
    [canPlayNext, canPlayPrevious, chapter, nextChapter, playChapter, previousChapter, seekTo, seekToAyah, sourceKind, status, timings, toggle],
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useQuranAudio(): AudioContextValue {
  const value = useContext(AudioContext);
  if (!value) throw new Error('useQuranAudio must be used inside AudioProvider.');
  return value;
}
