import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioStatus,
} from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { MUHAMMAD_AL_FAQIH, recitationUrl } from '@/audio/reciter';
import { activeAyahAt, VERIFIED_TIMINGS } from '@/audio/timings';
import type { Chapter } from '@/data/chapters';

type AudioContextValue = {
  chapter: Chapter | undefined;
  status: AudioStatus;
  activeAyah: number | undefined;
  hasVerifiedTimings: boolean;
  playChapter: (chapter: Chapter) => void;
  toggle: () => void;
  seekToAyah: (ayah: number) => Promise<void>;
};

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null, {
    updateInterval: 200,
    preferredForwardBufferDuration: 15,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);
  const [chapter, setChapter] = useState<Chapter>();

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => undefined);
  }, []);

  const playChapter = useCallback(
    (nextChapter: Chapter) => {
      if (chapter?.number !== nextChapter.number) {
        player.replace({ uri: recitationUrl(nextChapter), name: nextChapter.englishName });
        setChapter(nextChapter);
      }
      player.play();
      player.setActiveForLockScreen(
        true,
        {
          title: `Surah ${nextChapter.englishName}`,
          artist: MUHAMMAD_AL_FAQIH.name,
          albumTitle: 'IYF Quran',
          artworkUrl: MUHAMMAD_AL_FAQIH.artworkUrl,
        },
        { showSeekBackward: true, showSeekForward: true },
      );
    },
    [chapter?.number, player],
  );

  const toggle = useCallback(() => {
    if (!chapter) return;
    if (status.playing) player.pause();
    else player.play();
  }, [chapter, player, status.playing]);

  const timings = chapter ? VERIFIED_TIMINGS[chapter.number] : undefined;
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
      hasVerifiedTimings: Boolean(timings?.length),
      playChapter,
      toggle,
      seekToAyah,
    }),
    [chapter, playChapter, seekToAyah, status, timings, toggle],
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useQuranAudio(): AudioContextValue {
  const value = useContext(AudioContext);
  if (!value) throw new Error('useQuranAudio must be used inside AudioProvider.');
  return value;
}
