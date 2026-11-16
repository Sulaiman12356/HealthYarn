import { useCallback, useEffect, useRef, useState } from "react";

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
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
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      cancelledRef.current = false;
      playTone(880, 587);
      rec.stop();
    }
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      cleanupTracks();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  }, [cleanupTracks]);

  const startRecording = useCallback(async () => {
    setMicError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMicError("Microphone recording is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;

      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
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
        const elapsed = Math.min(
          maxSeconds,
          Math.max(0.2, (Date.now() - startedAtRef.current) / 1000)
        );
        const chunks = [...chunksRef.current];
        const finalType = recorder.mimeType || "audio/webm";
        chunksRef.current = [];
        cleanupTracks();
        setIsRecording(false);
        setRecordingSeconds(0);

        if (!cancelledRef.current && chunks.length > 0) {
          const blob = new Blob(chunks, { type: finalType });
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
      cleanupTracks();
      setIsRecording(false);
      setMicError("Microphone access denied or unavailable.");
    }
  }, [cleanupTracks, maxSeconds, onRecorded, stopRecording]);

  useEffect(() => {
    return () => {
      cleanupTracks();
    };
  }, [cleanupTracks]);

  return {
    isRecording,
    recordingSeconds,
    micError,
    startRecording,
    stopRecording,
    cancelRecording
  };
}
