import { useCallback, useEffect, useRef, useState } from "react";

export type MicErrorCode = "too_short" | "permission_denied" | "not_supported" | null;

function playTone(startHz: number, endHz: number) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startHz, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endHz, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 250);
  } catch {
    // Web Audio API may be blocked or unsupported in tests
  }
}

export function useVoiceRecorder(
  onRecorded: (blob: Blob, durationSeconds: number) => void,
  maxSeconds: number = 15
) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micErrorCode, setMicErrorCode] = useState<MicErrorCode>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const isStartingRef = useRef(false);
  const pendingStopRef = useRef(false);
  const cancelledRef = useRef(false);
  const startedAtRef = useRef<number>(0);

  const cleanupTracks = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    // If pointer was released while getUserMedia was still resolving, abort cleanly on arrival
    if (isStartingRef.current) {
      pendingStopRef.current = true;
      return;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      cancelledRef.current = false;
      pendingStopRef.current = false;
      playTone(880, 587);
      try {
        if (typeof rec.requestData === "function" && rec.state === "recording") {
          rec.requestData();
        }
      } catch {
        // requestData may be unsupported on some mock/mobile implementations
      }
      rec.stop();
    }
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    pendingStopRef.current = false;
    setIsInitializing(false);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else if (!isStartingRef.current) {
      cleanupTracks();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  }, [cleanupTracks]);

  const startRecording = useCallback(async () => {
    if (isStartingRef.current || recorderRef.current) {
      return;
    }
    setMicErrorCode(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMicErrorCode("not_supported");
      return;
    }

    isStartingRef.current = true;
    pendingStopRef.current = false;
    cancelledRef.current = false;
    setIsInitializing(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      isStartingRef.current = false;
      setIsInitializing(false);

      if (cancelledRef.current) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      if (pendingStopRef.current) {
        stream.getTracks().forEach((tr) => tr.stop());
        pendingStopRef.current = false;
        setMicErrorCode("too_short");
        return;
      }

      streamRef.current = stream;
      chunksRef.current = [];

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4"
      ];
      const mimeType = preferredTypes.find((m) => MediaRecorder.isTypeSupported?.(m)) || "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const rawElapsed = (Date.now() - startedAtRef.current) / 1000;
        const elapsed = Math.min(maxSeconds, Math.max(0.2, rawElapsed));
        const chunks = [...chunksRef.current];
        const finalType = recorder.mimeType || mimeType || "audio/webm";
        chunksRef.current = [];
        cleanupTracks();
        setIsRecording(false);
        setRecordingSeconds(0);

        if (!cancelledRef.current) {
          const blob = new Blob(chunks, { type: finalType });
          if (chunks.length === 0 || blob.size === 0 || rawElapsed < 0.25) {
            setMicErrorCode("too_short");
            return;
          }
          onRecorded(blob, Number(elapsed.toFixed(2)));
        }
      };

      startedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);
      playTone(587, 880);
      recorder.start(250);
      recorderRef.current = recorder;

      timerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setRecordingSeconds(secs);
        if (secs >= maxSeconds) {
          stopRecording();
        }
      }, 250);
    } catch {
      isStartingRef.current = false;
      pendingStopRef.current = false;
      setIsInitializing(false);
      cleanupTracks();
      setIsRecording(false);
      setMicErrorCode("permission_denied");
    }
  }, [cleanupTracks, maxSeconds, onRecorded, stopRecording]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      cleanupTracks();
    };
  }, [cleanupTracks]);

  return {
    isInitializing,
    isRecording,
    recordingSeconds,
    micErrorCode,
    startRecording,
    stopRecording,
    cancelRecording
  };
}
