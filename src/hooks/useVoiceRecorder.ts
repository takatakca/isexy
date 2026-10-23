import { useCallback, useEffect, useRef, useState } from "react";
import { classifyMediaError, mediaIssueText, type MediaIssue } from "@/lib/callMedia";
import { extensionFor, pickRecorderType, toWav, voiceRecordingSupported } from "@/lib/voiceRecording";

export type VoiceRecorderState = "idle" | "starting" | "recording" | "processing" | "recorded";
/** Microphone problem (see mediaIssueText) or "failed" (the recording came out empty). */
export type VoiceRecorderIssue = MediaIssue | "failed";

export interface VoiceRecording {
  blob: Blob;
  url: string;
  /** Content type to upload with (audio/wav after conversion). */
  mime: string;
  ext: string;
  /** Whole seconds, 1..maxSeconds. */
  seconds: number;
}

/** Title and next step for a recorder problem, in plain language. */
export function voiceIssueText(issue: VoiceRecorderIssue): { title: string; detail: string } {
  if (issue === "failed") return { title: "Nothing was recorded", detail: "Check that your microphone works, then record again." };
  if (issue === "unsupported") {
    return { title: "Recording isn't available in this browser", detail: "Use a recent version of Chrome, Safari, Firefox or Edge, on a secure (https) page." };
  }
  return mediaIssueText(issue, "microphone");
}

const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

/**
 * Records one voice clip (Phone Line greeting or voice reply), up to
 * `maxSeconds`. The microphone is released as soon as recording stops, on
 * reset() and when the page unmounts; the finished clip is converted to WAV
 * (lib/voiceRecording) so every browser and Twilio can play it.
 */
export function useVoiceRecorder(maxSeconds: number) {
  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [issue, setIssue] = useState<VoiceRecorderIssue | null>(null);
  const [recording, setRecording] = useState<VoiceRecording | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const urlRef = useRef<string | null>(null);
  const aliveRef = useRef(true);
  // Bumped by reset() and unmount: a recording that finishes afterwards is dropped.
  const runRef = useRef(0);
  const busyRef = useRef(false);

  /** Drops a recording that is still starting or finishing. */
  const invalidate = useCallback(() => {
    runRef.current += 1;
    busyRef.current = false;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopRecorder = useCallback(() => {
    const mr = recorderRef.current;
    recorderRef.current = null;
    if (mr && mr.state !== "inactive") {
      try {
        mr.stop();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") stopRecorder();
    else releaseMic();
  }, [clearTimer, releaseMic, stopRecorder]);

  const start = useCallback(async () => {
    if (busyRef.current) return;
    if (!voiceRecordingSupported()) {
      setIssue("unsupported");
      return;
    }
    busyRef.current = true;
    const run = ++runRef.current;
    const current = () => run === runRef.current && aliveRef.current;
    setIssue(null);
    setState("starting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO });
    } catch (e) {
      busyRef.current = false;
      if (current()) {
        setIssue(classifyMediaError(e));
        setState("idle");
      }
      return;
    }
    if (!current()) {
      // Reset or left the page while the permission prompt was open.
      stream.getTracks().forEach((t) => t.stop());
      busyRef.current = false;
      return;
    }
    streamRef.current = stream;

    const type = pickRecorderType();
    let mr: MediaRecorder;
    try {
      mr = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
    } catch {
      releaseMic();
      busyRef.current = false;
      setIssue("unsupported");
      setState("idle");
      return;
    }
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    mr.onstop = async () => {
      clearTimer();
      releaseMic();
      busyRef.current = false;
      if (!current()) return;
      const seconds = Math.min(maxSeconds, (Date.now() - startedAtRef.current) / 1000);
      const mime = mr.mimeType || type || chunks[0]?.type || "audio/webm";
      const raw = new Blob(chunks, { type: mime });
      if (raw.size === 0) {
        setIssue("failed");
        setState("idle");
        return;
      }
      setState("processing");
      let out: Omit<VoiceRecording, "url">;
      try {
        const wav = await toWav(raw);
        out = { blob: wav.blob, mime: "audio/wav", ext: "wav", seconds: wav.seconds || seconds };
      } catch {
        // The browser cannot decode its own recording: keep it as recorded.
        out = { blob: raw, mime: mime.split(";")[0], ext: extensionFor(mime), seconds };
      }
      if (!current()) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(out.blob);
      setRecording({ ...out, url: urlRef.current, seconds: Math.max(1, Math.min(maxSeconds, Math.round(out.seconds))) });
      setState("recorded");
    };
    mr.onerror = () => {
      if (current()) setIssue("failed");
      stop();
    };

    recorderRef.current = mr;
    startedAtRef.current = Date.now();
    setElapsed(0);
    mr.start(1000);
    setState("recording");
    timerRef.current = window.setInterval(() => {
      const s = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(Math.min(maxSeconds, Math.floor(s)));
      if (s >= maxSeconds) stop();
    }, 250);
  }, [clearTimer, maxSeconds, releaseMic, stop]);

  /** Discards the clip (or a recording in progress) and releases the microphone. */
  const reset = useCallback(() => {
    invalidate();
    clearTimer();
    stopRecorder();
    releaseMic();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setRecording(null);
    setElapsed(0);
    setIssue(null);
    setState("idle");
  }, [clearTimer, invalidate, releaseMic, stopRecorder]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      invalidate();
      clearTimer();
      stopRecorder();
      releaseMic();
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [clearTimer, invalidate, releaseMic, stopRecorder]);

  return {
    state,
    elapsed,
    issue,
    recording,
    start,
    stop,
    reset,
    supported: voiceRecordingSupported(),
  };
}
