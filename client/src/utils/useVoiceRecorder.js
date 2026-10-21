import { useCallback, useEffect, useRef, useState } from "react";

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

const MIC_ERRORS = {
  NotAllowedError: "Microphone access is blocked. Allow it in your browser's site settings.",
  NotFoundError: "No microphone was found.",
  NotReadableError: "Your microphone is being used by another app.",
};

export function useVoiceRecorder({ maxSeconds = 150, onStop } = {}) {
  const supported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined";

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);
  const peakRef = useRef(0);
  const startedAtRef = useRef(0);
  const recordingRef = useRef(false);
  const stopResolveRef = useRef(null);
  const onStopRef = useRef(onStop);

  useEffect(() => {
    onStopRef.current = onStop;
  });

  const release = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close?.().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (!supported || recordingRef.current) return false;
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      streamRef.current = stream;

      // device names are only available after permission is granted
      navigator.mediaDevices
        .enumerateDevices()
        .then((list) => setDevices(list.filter((d) => d.kind === "audioinput")))
        .catch(() => {});

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;

      const data = new Uint8Array(analyser.fftSize);
      peakRef.current = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        peakRef.current = Math.max(peakRef.current, rms);
        setLevel(Math.min(1, rms * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mimeType = MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported?.(t));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const result = {
          blob: new Blob(chunksRef.current, {
            type: recorder.mimeType || mimeType || "audio/webm",
          }),
          seconds: Math.round((Date.now() - startedAtRef.current) / 1000),
          peak: peakRef.current,
        };
        release();
        recordingRef.current = false;
        setRecording(false);
        onStopRef.current?.(result);
        stopResolveRef.current?.(result);
        stopResolveRef.current = null;
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      recordingRef.current = true;
      setRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        const s = Math.round((Date.now() - startedAtRef.current) / 1000);
        setSeconds(s);
        if (s >= maxSeconds && recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      }, 500);
      return true;
    } catch (err) {
      release();
      setError(MIC_ERRORS[err?.name] || "Couldn't start the microphone.");
      return false;
    }
  }, [supported, deviceId, maxSeconds, release]);

  // resolves after onStop has run
  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state !== "recording") {
          resolve(null);
          return;
        }
        stopResolveRef.current = resolve;
        recorder.stop();
      }),
    [],
  );

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.onstop = null;
        recorder.stop();
      }
      release();
    },
    [release],
  );

  return {
    supported,
    recording,
    recordingRef,
    seconds,
    level,
    error,
    devices,
    deviceId,
    setDeviceId,
    start,
    stop,
  };
}