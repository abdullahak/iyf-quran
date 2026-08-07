import AsyncStorage from '@react-native-async-storage/async-storage';
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
import {
  createPlaybackEndRule,
  createSleepTimerRule,
  rebasePlaybackEndRule,
  shouldAdvanceAfterSurah,
  type PlaybackEndRule,
  type PlaybackScope,
} from '@/audio/playbackEndRule';
import type { PlaybackQueueEntry } from '@/audio/playbackLibrary';
import { transitionQueuedPlayback } from '@/audio/playbackLibrary';
import { usePlaybackLibrary } from '@/audio/PlaybackLibraryProvider';
import {
  adjacentSurah,
  ayahPlaybackStartTime,
  finishTransition,
  nextQueueIndex,
  queueEntryStartTime,
} from '@/audio/playbackQueue';
import {
  DEFAULT_PLAYBACK_RATE,
  parsePlaybackRate,
  PLAYBACK_RATE_STORAGE_KEY,
  type PlaybackRate,
} from '@/audio/playbackRate';
import { enqueueSerial } from '@/audio/serialQueue';
import { recitationUrl, reciterById, type QuranReciter } from '@/audio/reciter';
import { remoteCommandConfiguration } from '@/audio/remoteCommands';
import { activeAyahAt, SYNCHRONIZED_TIMINGS } from '@/audio/timings';
import { chapterByNumber, type Chapter } from '@/data/chapters';
import { useAppSettings } from '@/settings/AppSettingsProvider';

export type TimingStatus = 'machineAligned' | 'unavailable' | 'verified';

const QUEUE_START_CONFIRMATION_WINDOW_SECONDS = 1;

type QueueSession = {
  entries: readonly PlaybackQueueEntry[];
  generation: number;
  index: number;
  kind: 'external' | 'library';
  reciterId: QuranReciter['id'];
};

type TransportTransition = {
  acceptCurrentPosition?: boolean;
  confirmAfterStatusSequence: number;
  confirmBefore: number;
  generation: number;
  phase: 'confirming' | 'positioning';
  queueEntryId?: string;
  queueGeneration?: number;
  queueIndex?: number;
  requirePlaying: boolean;
  startTime: number;
};

type AudioContextValue = {
  chapter: Chapter | undefined;
  reciter: QuranReciter;
  status: AudioStatus;
  activeAyah: number | undefined;
  timingStatus: TimingStatus;
  sourceKind: 'offline' | 'streaming' | undefined;
  canPlayNext: boolean;
  canPlayPrevious: boolean;
  playbackRate: PlaybackRate;
  endRule: PlaybackEndRule;
  activeQueueEntry: PlaybackQueueEntry | undefined;
  queueIndex: number | undefined;
  playChapter: (chapter: Chapter) => Promise<void>;
  playFromAyah: (chapter: Chapter, ayah: number) => Promise<boolean>;
  playQueue: (entries: readonly PlaybackQueueEntry[], startIndex?: number) => Promise<boolean>;
  playLibraryQueue: (startIndex?: number) => Promise<boolean>;
  clearPlaybackQueue: () => Promise<void>;
  nextChapter: () => Promise<void>;
  previousChapter: () => Promise<void>;
  toggle: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  seekToAyah: (ayah: number) => Promise<void>;
  setPlaybackRate: (rate: PlaybackRate) => void;
  setPlaybackScope: (scope: PlaybackScope) => Promise<boolean>;
  setSleepTimer: (durationMinutes?: number) => Promise<void>;
};

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { localUri } = useOfflineAudio();
  const { queue: libraryQueue, replaceQueue } = usePlaybackLibrary();
  const { language = 'en', settings } = useAppSettings();
  const selectedReciter = reciterById(settings.reciterId)!;
  const player = useAudioPlayer(null, {
    updateInterval: 200,
    preferredForwardBufferDuration: 15,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);
  const statusRef = useRef(status);
  const [chapter, setChapter] = useState<Chapter>();
  const [reciter, setReciter] = useState<QuranReciter>(selectedReciter);
  const [sourceKind, setSourceKind] = useState<'offline' | 'streaming'>();
  const [playbackRate, setPlaybackRateState] = useState<PlaybackRate>(DEFAULT_PLAYBACK_RATE);
  const [endRule, setEndRule] = useState<PlaybackEndRule>({ kind: 'continuous' });
  const [queueSession, setQueueSession] = useState<QueueSession>();
  const [transportAnchorTime, setTransportAnchorTime] = useState<number>();
  const chapterRef = useRef(chapter);
  const reciterRef = useRef(reciter);
  const playbackRateRef = useRef(playbackRate);
  const endRuleRef = useRef(endRule);
  const queueSessionRef = useRef(queueSession);
  const libraryQueueRef = useRef(libraryQueue);
  const finishHandledRef = useRef(false);
  const rangeHandledRef = useRef(false);
  const transportTransitionRef = useRef<TransportTransition | undefined>(undefined);
  const endRuleHandledRef = useRef(false);
  const audioModePromiseRef = useRef<Promise<void> | undefined>(undefined);
  const actionQueueRef = useRef(Promise.resolve());
  const transportGenerationRef = useRef(0);
  const statusSequenceRef = useRef(0);
  const lockScreenActiveRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    libraryQueueRef.current = libraryQueue;
  }, [libraryQueue]);

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

  useEffect(() => {
    statusSequenceRef.current += 1;
  }, [status.currentTime, status.didJustFinish, status.playing]);

  const updateEndRule = useCallback((next: PlaybackEndRule) => {
    endRuleRef.current = next;
    endRuleHandledRef.current = false;
    setEndRule(next);
  }, []);

  const updateQueueSession = useCallback((next: typeof queueSession) => {
    queueSessionRef.current = next;
    rangeHandledRef.current = false;
    if (!next && transportTransitionRef.current?.queueIndex !== undefined) {
      transportTransitionRef.current = undefined;
      setTransportAnchorTime(undefined);
    }
    setQueueSession(next);
  }, []);

  const beginTransportTransition = useCallback((
    startTime: number,
    confirmBefore: number,
    requirePlaying: boolean,
    queue?: {
      acceptCurrentPosition?: boolean;
      entryId: string;
      generation?: number;
      index: number;
    },
  ) => {
    const generation = transportGenerationRef.current + 1;
    transportGenerationRef.current = generation;
    transportTransitionRef.current = {
      confirmAfterStatusSequence: Number.POSITIVE_INFINITY,
      confirmBefore,
      generation,
      phase: 'positioning',
      ...(queue ? {
        acceptCurrentPosition: queue.acceptCurrentPosition,
        queueEntryId: queue.entryId,
        queueGeneration: queue.generation ?? generation,
        queueIndex: queue.index,
      } : {}),
      requirePlaying,
      startTime,
    };
    setTransportAnchorTime(startTime);
    return generation;
  }, []);

  const confirmTransportTransition = useCallback((generation: number) => {
    const transition = transportTransitionRef.current;
    if (!transition || transition.generation !== generation) return false;
    const sample = statusRef.current;
    if (
      transition.acceptCurrentPosition &&
      !sample.didJustFinish &&
      sample.currentTime >= transition.startTime - 0.25 &&
      sample.currentTime < transition.confirmBefore - 0.05
    ) {
      transportTransitionRef.current = undefined;
      setTransportAnchorTime(undefined);
      return true;
    }
    transportTransitionRef.current = {
      ...transition,
      confirmAfterStatusSequence: statusSequenceRef.current,
      phase: 'confirming',
    };
    return true;
  }, []);

  const clearTransportTransition = useCallback((generation: number) => {
    if (transportTransitionRef.current?.generation === generation) {
      transportTransitionRef.current = undefined;
      setTransportAnchorTime(undefined);
    }
  }, []);

  const publishSourceIdentity = useCallback((
    nextChapter: Chapter,
    targetReciter: QuranReciter,
    nextSourceKind: 'offline' | 'streaming',
  ) => {
    chapterRef.current = nextChapter;
    reciterRef.current = targetReciter;
    setChapter(nextChapter);
    setReciter(targetReciter);
    setSourceKind(nextSourceKind);
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PLAYBACK_RATE_STORAGE_KEY).then((raw) => {
      if (!active) return;
      const restored = parsePlaybackRate(raw);
      playbackRateRef.current = restored;
      setPlaybackRateState(restored);
      player.setPlaybackRate(restored, 'high');
    });
    return () => {
      active = false;
    };
  }, [player]);

  const startChapter = useCallback(
    async (
      nextChapter: Chapter,
      targetReciter = selectedReciter,
      startTime?: number,
      beforePlay?: () => void,
      transitionGeneration?: number,
    ) => {
      const sourceChanged =
        chapterRef.current?.number !== nextChapter.number ||
        reciterRef.current.id !== targetReciter.id;
      const downloadedUri = sourceChanged && targetReciter.supportsOffline
        ? localUri(nextChapter.number)
        : undefined;
      const nextSourceKind = downloadedUri ? 'offline' : 'streaming';
      const metadata = {
        title: language === 'ar'
          ? `سورة ${nextChapter.arabicName.replace(/^سُورَةُ\s*/, '')}`
          : `Surah ${nextChapter.englishName}`,
        artist: language === 'ar' ? targetReciter.arabicName : targetReciter.name,
        albumTitle: language === 'ar' ? 'القرآن الكريم' : 'Quran',
        ...(targetReciter.artworkUrl ? { artworkUrl: targetReciter.artworkUrl } : {}),
      };
      const targetStartTime = startTime ?? (sourceChanged ? 0 : player.currentTime);
      const generation = transitionGeneration ?? beginTransportTransition(
        targetStartTime,
        targetStartTime + QUEUE_START_CONFIRMATION_WINDOW_SECONDS,
        true,
      );
      let sourceReplaced = false;
      try {
        await ensureAudioMode();
        if (sourceChanged) {
          player.pause();
          player.replace({
            uri: downloadedUri ?? recitationUrl(nextChapter, targetReciter.id),
            name: nextChapter.englishName,
          });
          sourceReplaced = true;
          player.setPlaybackRate(playbackRateRef.current, 'high');
        } else if (startTime !== undefined) {
          player.pause();
        } else if (
          player.duration > 0 &&
          player.currentTime >= player.duration - 0.05
        ) {
          await player.seekTo(0, 50, 50);
        }
        if (startTime !== undefined) await player.seekTo(startTime, 50, 50);
        if (sourceChanged) {
          publishSourceIdentity(nextChapter, targetReciter, nextSourceKind);
        }
        beforePlay?.();
        if (!confirmTransportTransition(generation)) {
          player.pause();
          return false;
        }
        player.play();
        try {
          if (Platform.OS !== 'web') {
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
          }
        } catch {
          // Optional lock-screen metadata must not prevent core playback.
        }
        const session = queueSessionRef.current;
        configureHeadsetControls(remoteCommandConfiguration(
          nextChapter.number,
          session ? { index: session.index, count: session.entries.length } : undefined,
        ));
        return true;
      } catch {
        player.pause();
        if (sourceReplaced) {
          publishSourceIdentity(nextChapter, targetReciter, nextSourceKind);
        }
        updateQueueSession(undefined);
        updateEndRule({ kind: 'continuous' });
        clearTransportTransition(generation);
        const currentChapter = chapterRef.current;
        const currentReciter = reciterRef.current;
        if (currentChapter && Platform.OS !== 'web' && lockScreenActiveRef.current) {
          try {
            player.updateLockScreenMetadata({
              title: language === 'ar'
                ? `سورة ${currentChapter.arabicName.replace(/^سُورَةُ\s*/, '')}`
                : `Surah ${currentChapter.englishName}`,
              artist: language === 'ar' ? currentReciter.arabicName : currentReciter.name,
              albumTitle: language === 'ar' ? 'القرآن الكريم' : 'Quran',
              ...(currentReciter.artworkUrl ? { artworkUrl: currentReciter.artworkUrl } : {}),
            });
          } catch {
            // Optional lock-screen metadata must not prevent coherent failure cleanup.
          }
        }
        configureHeadsetControls(remoteCommandConfiguration(currentChapter?.number));
        return false;
      }
    },
    [beginTransportTransition, clearTransportTransition, confirmTransportTransition, ensureAudioMode, language, localUri, player, publishSourceIdentity, selectedReciter, updateEndRule, updateQueueSession],
  );

  const enqueueAction = useCallback((action: () => Promise<void>): Promise<void> => {
    return enqueueSerial(actionQueueRef, action);
  }, []);

  const playChapter = useCallback(
    (nextChapter: Chapter) => enqueueAction(async () => {
      updateQueueSession(undefined);
      await startChapter(nextChapter, selectedReciter, undefined, () => {
        updateEndRule(rebasePlaybackEndRule(endRuleRef.current, nextChapter.number, 1));
      });
    }),
    [enqueueAction, selectedReciter, startChapter, updateEndRule, updateQueueSession],
  );

  const startQueueIndex = useCallback(async (
    entries: readonly PlaybackQueueEntry[],
    index: number,
    targetReciter: QuranReciter,
    kind: QueueSession['kind'] = 'external',
  ): Promise<boolean> => {
    const entry = entries[index];
    const nextChapter = entry ? chapterByNumber(entry.surah) : undefined;
    if (!entry || !nextChapter) return false;
    const entryTimings = targetReciter.supportsTimings
      ? SYNCHRONIZED_TIMINGS[entry.surah]
      : undefined;
    const wholeSurah = entry.startAyah === 1 && entry.endAyah === nextChapter.ayahCount;
    if (!wholeSurah && !entryTimings) return false;
    const startTiming = entryTimings?.find((timing) => timing.ayah === entry.startAyah);
    const endTiming = entryTimings?.find((timing) => timing.ayah === entry.endAyah);
    const startTime = queueEntryStartTime(entry, startTiming?.start);
    if (startTime === undefined || (!wholeSurah && !endTiming)) return false;

    const generation = beginTransportTransition(
      startTime,
      Math.min(
        endTiming?.end ?? Number.POSITIVE_INFINITY,
        startTime + QUEUE_START_CONFIRMATION_WINDOW_SECONDS,
      ),
      true,
      { acceptCurrentPosition: startTime > 0, entryId: entry.id, index },
    );
    const started = await startChapter(nextChapter, targetReciter, startTime, () => {
      updateQueueSession({ entries, generation, index, kind, reciterId: targetReciter.id });
      if (endRuleRef.current.kind !== 'timer') updateEndRule({ kind: 'continuous' });
    }, generation);
    return started;
  }, [beginTransportTransition, startChapter, updateEndRule, updateQueueSession]);

  const playFromAyah = useCallback(async (nextChapter: Chapter, ayah: number) => {
    let started = false;
    await enqueueAction(async () => {
      const chapterTimings = selectedReciter.supportsTimings
        ? SYNCHRONIZED_TIMINGS[nextChapter.number]
        : undefined;
      const timing = chapterTimings?.find((candidate) => candidate.ayah === ayah);
      const startTime = ayahPlaybackStartTime(ayah, timing?.start);
      if (startTime === undefined) return;
      updateQueueSession(undefined);
      started = await startChapter(nextChapter, selectedReciter, startTime, () => {
        updateEndRule({ kind: 'surah' });
      });
    });
    return started;
  }, [enqueueAction, selectedReciter, startChapter, updateEndRule, updateQueueSession]);

  const playQueue = useCallback(async (
    entries: readonly PlaybackQueueEntry[],
    startIndex = 0,
  ) => {
    let started = false;
    await enqueueAction(async () => {
      started = await startQueueIndex(entries, startIndex, selectedReciter);
    });
    return started;
  }, [enqueueAction, selectedReciter, startQueueIndex]);

  const startPendingLibraryQueue = useCallback(async (
    targetReciter: QuranReciter,
    startIndex = 0,
  ) => {
    const pending = libraryQueueRef.current.slice(startIndex);
    const transition = transitionQueuedPlayback(pending, { type: 'current-finished' });
    if (transition.action !== 'play') return false;
    const started = await startQueueIndex(transition.queue, 0, targetReciter, 'library');
    if (started) replaceQueue(transition.queue);
    return started;
  }, [replaceQueue, startQueueIndex]);

  const playLibraryQueue = useCallback(async (startIndex = 0) => {
    let started = false;
    await enqueueAction(async () => {
      started = await startPendingLibraryQueue(selectedReciter, startIndex);
    });
    return started;
  }, [enqueueAction, selectedReciter, startPendingLibraryQueue]);

  const clearPlaybackQueue = useCallback(() => enqueueAction(async () => {
    updateQueueSession(undefined);
    updateEndRule({ kind: 'surah' });
  }), [enqueueAction, updateEndRule, updateQueueSession]);

  const advanceQueue = useCallback((expectedGeneration: number) => enqueueAction(async () => {
    const session = queueSessionRef.current;
    if (!session || session.generation !== expectedGeneration) return;
    const sessionReciter = reciterById(session.reciterId);
    if (session.kind === 'library') {
      const completedEntry = session.entries[session.index];
      if (!completedEntry) return;
      const transition = transitionQueuedPlayback(libraryQueueRef.current, {
        type: 'entry-finished',
        entryId: completedEntry.id,
      });
      replaceQueue(transition.queue);
      const started = transition.action === 'play' && sessionReciter
        ? await startQueueIndex(transition.queue, 0, sessionReciter, 'library')
        : false;
      if (started) return;
      player.pause();
      updateQueueSession(undefined);
      return;
    }
    const nextIndex = nextQueueIndex(session.entries.length, session.index, 1);
    if (nextIndex !== undefined) {
      const started = sessionReciter
        ? await startQueueIndex(session.entries, nextIndex, sessionReciter)
        : false;
      if (started) return;
    } else if (await startPendingLibraryQueue(selectedReciter)) {
      return;
    }
    player.pause();
    updateQueueSession(undefined);
  }), [enqueueAction, player, replaceQueue, selectedReciter, startPendingLibraryQueue, startQueueIndex, updateQueueSession]);

  const moveChapter = useCallback((direction: -1 | 1) => enqueueAction(async () => {
    const session = queueSessionRef.current;
    if (session) {
      const nextIndex = nextQueueIndex(session.entries.length, session.index, direction);
      if (nextIndex !== undefined) {
        const sessionReciter = reciterById(session.reciterId);
        const started = sessionReciter
          ? await startQueueIndex(session.entries, nextIndex, sessionReciter)
          : false;
        if (!started) {
          player.pause();
          updateQueueSession(undefined);
        }
        return;
      }
      updateQueueSession(undefined);
    }
    const current = chapterRef.current;
    if (!current) return;
    const number = adjacentSurah(current.number, direction);
    const next = number ? chapterByNumber(number) : undefined;
    if (next) {
      await startChapter(next, reciterRef.current);
    } else if (direction === -1) {
      await startChapter(current, reciterRef.current, 0);
    }
  }), [enqueueAction, player, startChapter, startQueueIndex, updateQueueSession]);

  const nextChapter = useCallback(() => moveChapter(1), [moveChapter]);
  const previousChapter = useCallback(() => moveChapter(-1), [moveChapter]);
  const canPlayNext = queueSession
    ? nextQueueIndex(queueSession.entries.length, queueSession.index, 1) !== undefined
      || Boolean(chapter && adjacentSurah(chapter.number, 1))
    : Boolean(chapter && adjacentSurah(chapter.number, 1));
  const canPlayPrevious = queueSession
    ? nextQueueIndex(queueSession.entries.length, queueSession.index, -1) !== undefined
      || Boolean(chapter)
    : Boolean(chapter);

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
    configureHeadsetControls(remoteCommandConfiguration(
      chapter?.number,
      queueSession ? { index: queueSession.index, count: queueSession.entries.length } : undefined,
    ));
  }, [chapter?.number, queueSession]);

  useEffect(() => () => {
    configureHeadsetControls(remoteCommandConfiguration(undefined));
    if (!lockScreenActiveRef.current) return;
    try {
      player.clearLockScreenControls();
    } catch {
      // The player may already have been released during native teardown.
    }
    lockScreenActiveRef.current = false;
  }, [player]);

  useEffect(() => {
    const pending = transportTransitionRef.current;
    const entry = queueSession
      ? queueSession.entries[queueSession.index]
      : undefined;
    if (
      !pending ||
      pending.phase !== 'confirming' ||
      statusSequenceRef.current <= pending.confirmAfterStatusSequence
    ) return;
    // A fresh completion is valid for ordinary playback, even when a very short
    // track never emitted a separate near-start status. Queue transitions keep
    // the stricter barrier so a previous entry's completion cannot skip a range.
    if (pending.queueIndex === undefined && status.didJustFinish) {
      transportTransitionRef.current = undefined;
      setTransportAnchorTime(undefined);
      return;
    }
    if (
      (pending.queueIndex !== undefined && (
        entry?.id !== pending.queueEntryId ||
        queueSession?.generation !== pending.queueGeneration ||
        queueSession?.index !== pending.queueIndex
      )) ||
      (pending.requirePlaying && !status.playing) ||
      status.didJustFinish ||
      status.currentTime < pending.startTime - 0.25 ||
      status.currentTime >= pending.confirmBefore - 0.05
    ) return;
    transportTransitionRef.current = undefined;
    setTransportAnchorTime(undefined);
  }, [queueSession, status.currentTime, status.didJustFinish, status.playing]);

  useEffect(() => {
    if (transportTransitionRef.current) return;
    const transition = finishTransition(finishHandledRef.current, status.didJustFinish);
    finishHandledRef.current = transition.handled;
    if (!transition.advance || !chapter) return;
    const session = queueSessionRef.current;
    if (session) {
      void advanceQueue(session.generation);
      return;
    }
    const queued = transitionQueuedPlayback(libraryQueueRef.current, { type: 'current-finished' });
    if (queued.action === 'play') {
      void playLibraryQueue();
      return;
    }
    if (shouldAdvanceAfterSurah(endRuleRef.current, chapter.number)) {
      void nextChapter();
      return;
    }
    player.pause();
    updateEndRule({ kind: 'continuous' });
  }, [advanceQueue, chapter, nextChapter, playLibraryQueue, player, status.didJustFinish, updateEndRule]);

  const timings = chapter && reciter.supportsTimings
    ? SYNCHRONIZED_TIMINGS[chapter.number]
    : undefined;
  const activeAyah = activeAyahAt(
    timings,
    transportAnchorTime ?? status.currentTime,
  );

  useEffect(() => {
    const session = queueSession;
    const entry = session
      ? session.entries[session.index]
      : undefined;
    if (
      !session ||
      !entry ||
      !chapter ||
      entry.surah !== chapter.number ||
      entry.endAyah === chapter.ayahCount ||
      rangeHandledRef.current ||
      transportTransitionRef.current ||
      !status.playing
    ) return;
    const endTiming = timings?.find((timing) => timing.ayah === entry.endAyah);
    if (!endTiming || status.currentTime < endTiming.end - 0.05) return;
    rangeHandledRef.current = true;
    void advanceQueue(session.generation);
  }, [advanceQueue, chapter, queueSession, status.currentTime, status.playing, timings]);

  useEffect(() => {
    if (
      (endRule.kind !== 'page' && endRule.kind !== 'juz') ||
      !chapter ||
      endRule.end.surah !== chapter.number ||
      endRule.end.ayah === chapter.ayahCount ||
      endRuleHandledRef.current ||
      transportTransitionRef.current ||
      !status.playing
    ) return;
    const endTiming = timings?.find((timing) => timing.ayah === endRule.end.ayah);
    if (!endTiming || status.currentTime < endTiming.end - 0.05) return;
    endRuleHandledRef.current = true;
    const expectedRule = endRule;
    const expectedTransportGeneration = transportGenerationRef.current;
    const timeout = setTimeout(() => {
      void enqueueAction(async () => {
        if (
          endRuleRef.current !== expectedRule ||
          transportGenerationRef.current !== expectedTransportGeneration
        ) return;
        player.pause();
        updateEndRule({ kind: 'continuous' });
      });
    }, 0);
    return () => clearTimeout(timeout);
  }, [chapter, endRule, enqueueAction, player, status.currentTime, status.playing, timings, updateEndRule]);

  useEffect(() => {
    if (endRule.kind !== 'timer') return;
    const remaining = endRule.endsAt - Date.now();
    const expectedRule = endRule;
    const timeout = setTimeout(() => {
      void enqueueAction(async () => {
        if (endRuleRef.current !== expectedRule) return;
        player.pause();
        updateEndRule({ kind: 'continuous' });
      });
    }, Math.max(0, remaining));
    return () => clearTimeout(timeout);
  }, [endRule, enqueueAction, player, updateEndRule]);

  const setPlaybackRate = useCallback((rate: PlaybackRate) => {
    const normalized = parsePlaybackRate(JSON.stringify(rate));
    playbackRateRef.current = normalized;
    setPlaybackRateState(normalized);
    player.setPlaybackRate(normalized, 'high');
    void AsyncStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, JSON.stringify(normalized));
  }, [player]);

  const setPlaybackScope = useCallback(async (scope: PlaybackScope) => {
    let applied = false;
    await enqueueAction(async () => {
      const currentChapter = chapterRef.current;
      if (!currentChapter) return;
      const currentTimings = reciterRef.current.supportsTimings
        ? SYNCHRONIZED_TIMINGS[currentChapter.number]
        : undefined;
      const currentAyah = activeAyahAt(currentTimings, player.currentTime) ?? 1;
      const rule = createPlaybackEndRule(scope, currentChapter.number, currentAyah);
      if (rule.kind === 'page' || rule.kind === 'juz') {
        if (!currentTimings || !reciterRef.current.supportsTimings) return;
        const targetTimings = SYNCHRONIZED_TIMINGS[rule.end.surah];
        if (!targetTimings?.some((timing) => timing.ayah === rule.end.ayah)) return;
      }
      updateQueueSession(undefined);
      updateEndRule(rule);
      applied = true;
    });
    return applied;
  }, [enqueueAction, player, updateEndRule, updateQueueSession]);

  const setSleepTimer = useCallback((durationMinutes?: number) => enqueueAction(async () => {
    updateEndRule(durationMinutes
      ? createSleepTimerRule(durationMinutes, Date.now())
      : { kind: 'continuous' });
  }), [enqueueAction, updateEndRule]);
  const seekTo = useCallback((seconds: number) => enqueueAction(async () => {
    const duration = Number.isFinite(player.duration) ? player.duration : 0;
    const target = Math.max(0, Math.min(seconds, duration));
    const session = queueSessionRef.current;
    const entry = session?.entries[session.index];
    const requirePlaying = player.playing;
    const generation = beginTransportTransition(
      target,
      target + QUEUE_START_CONFIRMATION_WINDOW_SECONDS,
      requirePlaying,
      session && entry
        ? { entryId: entry.id, generation: session.generation, index: session.index }
        : undefined,
    );
    try {
      await player.seekTo(target, 50, 50);
      confirmTransportTransition(generation);
    } catch {
      clearTransportTransition(generation);
    }
  }), [beginTransportTransition, clearTransportTransition, confirmTransportTransition, enqueueAction, player]);
  const seekToAyah = useCallback(
    (ayah: number) => enqueueAction(async () => {
      const currentChapter = chapterRef.current;
      const currentTimings = currentChapter && reciterRef.current.supportsTimings
        ? SYNCHRONIZED_TIMINGS[currentChapter.number]
        : undefined;
      const timing = currentTimings?.find((candidate) => candidate.ayah === ayah);
      const startTime = ayahPlaybackStartTime(ayah, timing?.start);
      if (startTime === undefined) return;
      const session = queueSessionRef.current;
      const entry = session?.entries[session.index];
      const generation = beginTransportTransition(
        startTime,
        startTime + QUEUE_START_CONFIRMATION_WINDOW_SECONDS,
        true,
        session && entry
          ? { entryId: entry.id, generation: session.generation, index: session.index }
          : undefined,
      );
      try {
        await ensureAudioMode();
        player.pause();
        await player.seekTo(startTime, 50, 50);
        if (!confirmTransportTransition(generation)) return;
        player.play();
      } catch {
        player.pause();
        clearTransportTransition(generation);
      }
    }),
    [beginTransportTransition, clearTransportTransition, confirmTransportTransition, enqueueAction, ensureAudioMode, player],
  );

  const value = useMemo<AudioContextValue>(
    () => ({
      chapter,
      reciter,
      status,
      activeAyah,
      timingStatus: timings?.[0]?.reviewStatus ?? 'unavailable',
      sourceKind,
      canPlayNext,
      canPlayPrevious,
      playbackRate,
      endRule,
      activeQueueEntry: queueSession?.entries[queueSession.index],
      queueIndex: queueSession?.index,
      playChapter,
      playFromAyah,
      playQueue,
      playLibraryQueue,
      clearPlaybackQueue,
      nextChapter,
      previousChapter,
      toggle,
      seekTo,
      seekToAyah,
      setPlaybackRate,
      setPlaybackScope,
      setSleepTimer,
    }),
    [activeAyah, canPlayNext, canPlayPrevious, chapter, clearPlaybackQueue, endRule, nextChapter, playbackRate, playChapter, playFromAyah, playLibraryQueue, playQueue, previousChapter, queueSession, reciter, seekTo, seekToAyah, setPlaybackRate, setPlaybackScope, setSleepTimer, sourceKind, status, timings, toggle],
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useQuranAudio(): AudioContextValue {
  const value = useContext(AudioContext);
  if (!value) throw new Error('useQuranAudio must be used inside AudioProvider.');
  return value;
}
