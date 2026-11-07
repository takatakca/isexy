/**
 * Camera and microphone for calls, with errors sorted into what the member
 * can act on. A video call whose camera fails (blocked, missing, busy) falls
 * back to audio only; a call needs a microphone.
 */
export type MediaIssue = "denied" | "missing" | "busy" | "unsupported";

export class CallMediaError extends Error {
  constructor(public issue: MediaIssue) {
    super(`media:${issue}`);
    this.name = "CallMediaError";
  }
}

const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO: MediaTrackConstraints = { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } };

export function classifyMediaError(e: unknown): MediaIssue {
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "missing";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  return "unsupported";
}

export function mediaSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== "undefined";
}

export async function getCallMedia(wantVideo: boolean): Promise<{ stream: MediaStream; cameraIssue: MediaIssue | null }> {
  if (!mediaSupported()) throw new CallMediaError("unsupported");
  if (wantVideo) {
    try {
      return { stream: await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: VIDEO }), cameraIssue: null };
    } catch (e) {
      const cameraIssue = classifyMediaError(e);
      try {
        return { stream: await navigator.mediaDevices.getUserMedia({ audio: AUDIO }), cameraIssue };
      } catch (e2) {
        throw new CallMediaError(classifyMediaError(e2));
      }
    }
  }
  try {
    return { stream: await navigator.mediaDevices.getUserMedia({ audio: AUDIO }), cameraIssue: null };
  } catch (e) {
    throw new CallMediaError(classifyMediaError(e));
  }
}

/** Plain-language title and next step for a camera or microphone problem. */
export function mediaIssueText(issue: MediaIssue, device: "camera" | "microphone"): { title: string; detail: string } {
  const Device = device === "camera" ? "Camera" : "Microphone";
  switch (issue) {
    case "denied":
      return {
        title: `${Device} access is blocked`,
        detail: `Allow ${device} access for this site in your browser settings (the lock icon next to the address), then try again.`,
      };
    case "missing":
      return { title: `No ${device} found`, detail: `Connect a ${device === "camera" ? "camera" : "microphone or headset"} and try again.` };
    case "busy":
      return { title: `${Device} is in use`, detail: `Another app or tab is using your ${device}. Close it and try again.` };
    default:
      return {
        title: "Calls aren't available in this browser",
        detail: "Use a recent version of Chrome, Safari, Firefox or Edge, on a secure (https) page.",
      };
  }
}

/** Short banner text when a video call continues without my camera. */
export function cameraFallbackText(issue: MediaIssue): string {
  if (issue === "denied") return "Camera blocked · you're on audio only";
  if (issue === "missing") return "No camera found · you're on audio only";
  if (issue === "busy") return "Camera in use by another app · you're on audio only";
  return "Camera unavailable · you're on audio only";
}
