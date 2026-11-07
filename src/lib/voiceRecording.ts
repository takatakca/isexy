/**
 * Voice greetings and voice replies (Phone Line).
 *
 * Browsers record in different formats (Chrome/Firefox: WebM/Opus, Safari:
 * MP4/AAC). Safari cannot play WebM and Twilio's <Play> (browse by phone)
 * plays neither, so a finished recording is converted to a small WAV file
 * (16 kHz mono, 16-bit PCM: about 32 KB per second) that every browser and
 * Twilio can play. If the browser cannot decode its own recording, the
 * original file is kept with its real type.
 */

export const WAV_SAMPLE_RATE = 16000;

const RECORDER_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];

export function voiceRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined"
  );
}

/** First container this browser's MediaRecorder supports ("" = browser default). */
export function pickRecorderType(): string {
  const MR = typeof window !== "undefined" ? window.MediaRecorder : undefined;
  if (!MR || typeof MR.isTypeSupported !== "function") return "";
  return RECORDER_TYPES.find((t) => MR.isTypeSupported(t)) ?? "";
}

/** File extension for a stored recording, from its MIME type. */
export function extensionFor(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base === "audio/wav" || base === "audio/x-wav" || base === "audio/wave") return "wav";
  if (base === "audio/mp4" || base === "audio/x-m4a" || base === "audio/aac") return "m4a";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mpeg") return "mp3";
  return "webm";
}

/** 16-bit PCM mono WAV from float samples in [-1, 1]. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0, o = 44; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

type AudioContextCtor = typeof AudioContext;

/** Decodes a browser recording and re-encodes it as 16 kHz mono WAV. */
export async function toWav(recording: Blob, sampleRate = WAV_SAMPLE_RATE): Promise<{ blob: Blob; seconds: number }> {
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  const Ctx = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctx || typeof OfflineAudioContext === "undefined") throw new Error("no_audio_context");
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await recording.arrayBuffer());
    const length = Math.max(1, Math.ceil(decoded.duration * sampleRate));
    const offline = new OfflineAudioContext(1, length, sampleRate); // mixes down to mono
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return { blob: encodeWav(rendered.getChannelData(0), sampleRate), seconds: decoded.duration };
  } finally {
    void ctx.close().catch(() => undefined);
  }
}
