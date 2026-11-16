import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioQueue() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStage, setActiveStage] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  const stop = useCallback(() => {
    queueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setActiveStage(0);
  }, []);

  const playNext = useCallback(
    (rate: number) => {
      const nextUrl = queueRef.current.shift();
      if (!nextUrl) {
        setIsPlaying(false);
        return;
      }

      if (typeof Audio === "undefined") {
        setIsPlaying(false);
        return;
      }

      try {
        const audio = new Audio(nextUrl);
        audio.playbackRate = rate;
        audioRef.current = audio;
        setIsPlaying(true);

        audio.onended = () => {
          setActiveStage((s) => s + 1);
          playNext(rate);
        };
        audio.onerror = () => {
          setActiveStage((s) => s + 1);
          playNext(rate);
        };

        const maybePromise = audio.play();
        if (maybePromise && typeof maybePromise.catch === "function") {
          maybePromise.catch(() => {
            setIsPlaying(false);
          });
        }
      } catch {
        setIsPlaying(false);
      }
    },
    []
  );

  const playSequence = useCallback(
    (urls: Array<string | null | undefined>, rateOverride?: number) => {
      stop();
      const valid = urls.filter((u): u is string => Boolean(u));
      if (valid.length === 0) {
        return;
      }
      queueRef.current = [...valid];
      setActiveStage(0);
      playNext(rateOverride ?? playbackRate);
    },
    [playNext, playbackRate, stop]
  );

  const toggleSpeed = useCallback(() => {
    setPlaybackRate((prev) => {
      const next = prev === 1.0 ? 0.75 : 1.0;
      if (audioRef.current) {
        audioRef.current.playbackRate = next;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isPlaying,
    activeStage,
    playbackRate,
    playSequence,
    stop,
    toggleSpeed
  };
}
