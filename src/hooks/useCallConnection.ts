import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CallRole = "caller" | "callee";
export type ConnectionPhase = "idle" | "waiting" | "connecting" | "connected" | "reconnecting" | "failed" | "ended";

interface Options {
  matchId: string;
  myId: string;
  role: CallRole;
  audioOnly: boolean;
  onRemoteStream: (stream: MediaStream) => void;
  onConnected: () => void;
  onPeerHangup: () => void;
  onFailed: () => void;
}

interface Signal {
  type: "ready" | "offer" | "answer" | "ice" | "hangup";
  from: string;
  to: string;
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
}

/**
 * STUN finds a direct path; TURN relays media when both sides are behind
 * strict NAT (common on mobile networks, very common in Cuba). Configure with
 * VITE_TURN_URLS (comma separated), VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL.
 */
function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  const turn = (import.meta.env.VITE_TURN_URLS as string | undefined)?.split(",").map((u) => u.trim()).filter(Boolean);
  if (turn?.length) {
    servers.push({
      urls: turn,
      username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
    });
  }
  return servers;
}

/**
 * One-to-one WebRTC call over Supabase Realtime broadcast signaling.
 *
 * Handshake: the callee announces "ready" (repeated until an offer arrives),
 * the caller answers each "ready" with an offer, the callee replies with an
 * answer. ICE candidates are addressed to the peer and queued until the
 * remote description is set. One ICE restart is attempted on failure.
 */
export function useCallConnection({ matchId, myId, role, audioOnly, onRemoteStream, onConnected, onPeerHangup, onFailed }: Options) {
  const [phase, setPhase] = useState<ConnectionPhase>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerIdRef = useRef<string>("*");
  const queuedIce = useRef<RTCIceCandidateInit[]>([]);
  const readyTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartedRef = useRef(false);
  const endedRef = useRef(false);
  const callbacks = useRef({ onRemoteStream, onConnected, onPeerHangup, onFailed });
  callbacks.current = { onRemoteStream, onConnected, onPeerHangup, onFailed };

  const send = useCallback((signal: Omit<Signal, "from">) => {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload: { ...signal, from: myId } });
  }, [myId]);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    for (const c of queuedIce.current.splice(0)) {
      try { await pc.addIceCandidate(c); } catch { /* stale candidate */ }
    }
  }, []);

  const makeOffer = useCallback(async (iceRestart = false) => {
    const pc = pcRef.current;
    if (!pc) return;
    const offer = await pc.createOffer({ iceRestart });
    await pc.setLocalDescription(offer);
    send({ type: "offer", to: peerIdRef.current, data: pc.localDescription?.toJSON() ?? offer });
  }, [send]);

  const cleanup = useCallback(() => {
    if (readyTimer.current) clearInterval(readyTimer.current);
    readyTimer.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
  }, []);

  const handleSignal = useCallback(async (msg: Signal) => {
    if (msg.from === myId || (msg.to !== myId && msg.to !== "*")) return;
    const pc = pcRef.current;
    if (!pc) return;
    try {
      switch (msg.type) {
        case "ready":
          if (role !== "caller" || pc.connectionState === "connected") return;
          peerIdRef.current = msg.from;
          setPhase("connecting");
          await makeOffer();
          break;
        case "offer":
          if (role !== "callee") return;
          peerIdRef.current = msg.from;
          if (readyTimer.current) { clearInterval(readyTimer.current); readyTimer.current = null; }
          await pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
          await flushIce();
          {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send({ type: "answer", to: msg.from, data: pc.localDescription?.toJSON() ?? answer });
          }
          setPhase((p) => (p === "connected" ? p : "connecting"));
          break;
        case "answer":
          if (role !== "caller" || pc.signalingState !== "have-local-offer") return;
          await pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
          await flushIce();
          break;
        case "ice":
          if (!msg.data) return;
          if (pc.remoteDescription) await pc.addIceCandidate(msg.data as RTCIceCandidateInit);
          else queuedIce.current.push(msg.data as RTCIceCandidateInit);
          break;
        case "hangup":
          if (endedRef.current) return;
          endedRef.current = true;
          setPhase("ended");
          cleanup();
          callbacks.current.onPeerHangup();
          break;
      }
    } catch (e) {
      console.error("Call signaling error:", e);
    }
  }, [myId, role, makeOffer, flushIce, send, cleanup]);

  /** Open camera/mic, join the signaling channel and start the handshake. */
  const start = useCallback(async (): Promise<MediaStream> => {
    endedRef.current = false;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: audioOnly ? false : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    streamRef.current = stream;
    setLocalStream(stream);

    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.ontrack = (e) => {
      if (e.streams[0]) callbacks.current.onRemoteStream(e.streams[0]);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: "ice", to: peerIdRef.current, data: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case "connected":
          restartedRef.current = false;
          setPhase("connected");
          callbacks.current.onConnected();
          break;
        case "disconnected":
          setPhase("reconnecting");
          break;
        case "failed":
          if (role === "caller" && !restartedRef.current) {
            restartedRef.current = true;
            setPhase("reconnecting");
            makeOffer(true).catch(() => undefined);
          } else if (!endedRef.current) {
            setPhase("failed");
            callbacks.current.onFailed();
          }
          break;
      }
    };
    pcRef.current = pc;

    const channel = supabase.channel(`call-${matchId}`, { config: { broadcast: { self: false, ack: false } } });
    channel.on("broadcast", { event: "signal" }, ({ payload }) => { handleSignal(payload as Signal); });
    channelRef.current = channel;
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      if (role === "callee") {
        // Keep announcing until the caller's offer arrives (messages can be
        // missed while either side is still joining).
        send({ type: "ready", to: "*" });
        let tries = 0;
        readyTimer.current = setInterval(() => {
          if (++tries > 15 || pcRef.current?.remoteDescription) {
            if (readyTimer.current) clearInterval(readyTimer.current);
            readyTimer.current = null;
            return;
          }
          send({ type: "ready", to: "*" });
        }, 2000);
      }
    });
    setPhase(role === "caller" ? "waiting" : "connecting");
    return stream;
  }, [audioOnly, matchId, role, send, handleSignal, makeOffer]);

  const hangUp = useCallback(() => {
    if (!endedRef.current) {
      endedRef.current = true;
      send({ type: "hangup", to: peerIdRef.current });
    }
    setPhase("ended");
    // Let the hangup message leave before tearing the channel down.
    setTimeout(cleanup, 150);
  }, [send, cleanup]);

  const setMuted = useCallback((muted: boolean) => {
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  }, []);

  const setVideoOff = useCallback((off: boolean) => {
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !off; });
  }, []);

  useEffect(() => () => {
    if (!endedRef.current && channelRef.current) {
      endedRef.current = true;
      send({ type: "hangup", to: peerIdRef.current });
    }
    cleanup();
  }, [send, cleanup]);

  return { phase, localStream, start, hangUp, setMuted, setVideoOff };
}
