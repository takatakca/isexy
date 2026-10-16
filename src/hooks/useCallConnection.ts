import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rtcConfiguration } from "@/lib/iceServers";

export type CallRole = "caller" | "callee";
export type ConnectionPhase = "idle" | "waiting" | "connecting" | "connected" | "reconnecting" | "failed" | "ended";
/** signaling: Realtime unreachable; timeout: never connected; connection_lost: dropped and could not recover. */
export type CallFailReason = "signaling" | "timeout" | "connection_lost";
export interface PeerMediaState {
  micOn: boolean;
  camOn: boolean;
}

interface Options {
  myId: string;
  role: CallRole;
  /** Video call: receive the other person's video even when my own camera is unavailable. */
  video: boolean;
  /** Relay media through TURN when configured (calls with people you are not matched with). */
  privateRelay?: boolean;
  onRemoteStream: (stream: MediaStream) => void;
  onConnected: () => void;
  /** Caller only: the other person answered and joined the call. */
  onPeerJoined?: () => void;
  onPeerHangup: () => void;
  onFailed: (reason: CallFailReason) => void;
}

type SignalType = "ready" | "offer" | "answer" | "ice" | "restart" | "state" | "hangup";
interface Signal {
  type: SignalType;
  from: string;
  to: string;
  /** Sender's peer-connection id: changes when that page reloads. */
  pc?: string;
  /** Offer number, echoed by the answer (late answers to older offers are ignored). */
  seq?: number;
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit | PeerMediaState | null;
}

const READY_EVERY_MS = 2_000;
const SUBSCRIBE_TIMEOUT_MS = 15_000;
/** From the moment both sides are in the call until media must flow. */
const CONNECT_TIMEOUT_MS = 30_000;
/** Short network blips recover by themselves; restart ICE after this. */
const DISCONNECT_GRACE_MS = 2_500;
const RESTART_EVERY_MS = 5_000;
/** Give up reconnecting after this long and tell the member. */
const RECONNECT_GIVE_UP_MS = 25_000;

type Timers = {
  ready?: ReturnType<typeof setInterval>;
  subscribe?: ReturnType<typeof setTimeout>;
  connect?: ReturnType<typeof setTimeout>;
  grace?: ReturnType<typeof setTimeout>;
  restart?: ReturnType<typeof setInterval>;
  giveUp?: ReturnType<typeof setTimeout>;
};

function clearTimerIn(timers: Timers, key: keyof Timers) {
  const t = timers[key];
  if (t) {
    clearTimeout(t as ReturnType<typeof setTimeout>);
    clearInterval(t as ReturnType<typeof setInterval>);
  }
  timers[key] = undefined;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/**
 * One-to-one WebRTC call. Signaling goes over a Supabase Realtime broadcast
 * channel named after the call session (`call-<sessionId>`), so two calls of
 * the same match never mix.
 *
 * Handshake: the callee announces "ready" (repeated until an offer arrives),
 * the caller answers with an offer, the callee replies with an answer. ICE
 * candidates are queued until the remote description is set.
 * Recovery: when ICE drops (disconnected for 2.5 s, or failed) the caller
 * sends ICE-restart offers (the callee asks for them) every 5 s; after 25 s
 * without media the call fails with "connection_lost". A callee page reload
 * (new peer-connection id) makes the caller start a fresh peer connection.
 */
export function useCallConnection({ myId, role, video, privateRelay, onRemoteStream, onConnected, onPeerJoined, onPeerHangup, onFailed }: Options) {
  const [phase, setPhaseState] = useState<ConnectionPhase>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerState, setPeerState] = useState<PeerMediaState>({ micOn: true, camOn: video });
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");

  const phaseRef = useRef<ConnectionPhase>("idle");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pcIdRef = useRef<string>("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const peerIdRef = useRef<string>("*");
  const peerPcRef = useRef<string | null>(null);
  const queuedIce = useRef<RTCIceCandidateInit[]>([]);
  const offerSeq = useRef(0);
  const lastOfferAt = useRef(0);
  const everConnected = useRef(false);
  const endedRef = useRef(false);
  const myState = useRef<PeerMediaState>({ micOn: true, camOn: video });
  const facingRef = useRef<"user" | "environment">("user");
  const timers = useRef<Timers>({});
  /**
   * Offers, answers and candidates are applied one at a time: two offers
   * handled concurrently (an ICE-restart retry crossing a "restart" request)
   * leave the peer connection in the wrong state for the second answer.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());
  const serial = useCallback((task: () => Promise<void>) => {
    queue.current = queue.current.then(task).catch((e) => console.warn("Call signaling step failed:", e));
  }, []);
  const callbacks = useRef({ onRemoteStream, onConnected, onPeerJoined, onPeerHangup, onFailed });
  callbacks.current = { onRemoteStream, onConnected, onPeerJoined, onPeerHangup, onFailed };

  const setPhase = useCallback((next: ConnectionPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const send = useCallback((signal: Omit<Signal, "from" | "pc">) => {
    channelRef.current
      ?.send({ type: "broadcast", event: "signal", payload: { ...signal, from: myId, pc: pcIdRef.current } })
      .catch(() => undefined);
  }, [myId]);


  const cleanup = useCallback(() => {
    (Object.keys(timers.current) as (keyof Timers)[]).forEach((k) => clearTimerIn(timers.current, k));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
  }, []);

  const fail = useCallback((reason: CallFailReason) => {
    if (endedRef.current) return;
    endedRef.current = true;
    send({ type: "hangup", to: peerIdRef.current });
    setPhase("failed");
    setTimeout(cleanup, 150);
    callbacks.current.onFailed(reason);
  }, [send, setPhase, cleanup]);

  const sendState = useCallback(() => {
    send({ type: "state", to: peerIdRef.current, data: { ...myState.current } });
  }, [send]);

  const makeOffer = useCallback(async (iceRestart = false) => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState === "closed") return;
    try {
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      await pc.setLocalDescription(offer);
      offerSeq.current += 1;
      lastOfferAt.current = Date.now();
      send({ type: "offer", to: peerIdRef.current, seq: offerSeq.current, data: pc.localDescription?.toJSON() ?? offer });
    } catch (e) {
      console.warn("Call offer failed:", e);
    }
  }, [send]);

  const startConnectTimer = useCallback(() => {
    if (timers.current.connect || everConnected.current) return;
    timers.current.connect = setTimeout(() => {
      timers.current.connect = undefined;
      if (!everConnected.current) fail("timeout");
    }, CONNECT_TIMEOUT_MS);
  }, [fail]);

  /** Ask for (callee) or send (caller) ICE-restart offers until media flows again. */
  const beginRestart = useCallback(() => {
    if (endedRef.current || timers.current.restart) return;
    const attempt = () => {
      if (endedRef.current || phaseRef.current === "connected") {
        clearTimerIn(timers.current, "restart");
        return;
      }
      if (role === "caller") serial(() => makeOffer(true));
      else send({ type: "restart", to: peerIdRef.current });
    };
    attempt();
    timers.current.restart = setInterval(attempt, RESTART_EVERY_MS);
  }, [role, makeOffer, send, serial]);

  const startGiveUp = useCallback(() => {
    if (timers.current.giveUp) return;
    timers.current.giveUp = setTimeout(() => {
      timers.current.giveUp = undefined;
      if (phaseRef.current !== "connected") fail("connection_lost");
    }, RECONNECT_GIVE_UP_MS);
  }, [fail]);

  const evaluate = useCallback((pc: RTCPeerConnection) => {
    if (pc !== pcRef.current || endedRef.current) return;
    const cs = pc.connectionState;
    const ics = pc.iceConnectionState;
    const up = cs ? cs === "connected" : ics === "connected" || ics === "completed";
    const failed = cs === "failed" || ics === "failed";
    const blip = !failed && (cs === "disconnected" || ics === "disconnected");

    if (up) {
      (["grace", "restart", "giveUp", "connect"] as const).forEach((k) => clearTimerIn(timers.current, k));
      everConnected.current = true;
      if (phaseRef.current !== "connected") {
        setPhase("connected");
        sendState();
        callbacks.current.onConnected();
      }
      return;
    }
    if (!everConnected.current) {
      // Still setting up: one restart may find a path; the connect timer decides.
      if (failed) beginRestart();
      return;
    }
    if (failed) {
      setPhase("reconnecting");
      startGiveUp();
      clearTimerIn(timers.current, "grace");
      beginRestart();
    } else if (blip) {
      setPhase("reconnecting");
      startGiveUp();
      if (!timers.current.grace && !timers.current.restart) {
        timers.current.grace = setTimeout(() => {
          timers.current.grace = undefined;
          if (phaseRef.current === "reconnecting") beginRestart();
        }, DISCONNECT_GRACE_MS);
      }
    }
  }, [setPhase, sendState, beginRestart, startGiveUp]);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    for (const c of queuedIce.current.splice(0)) {
      try { await pc.addIceCandidate(c); } catch { /* stale candidate */ }
    }
  }, []);

  /** (Re)build the peer connection around the current local stream. */
  const createPeer = useCallback(() => {
    pcRef.current?.close();
    queuedIce.current = [];
    remoteRef.current = null;
    pcIdRef.current = newId();
    const pc = new RTCPeerConnection(rtcConfiguration(import.meta.env, { privateRelay }));
    const stream = streamRef.current;
    stream?.getTracks().forEach((t) => pc.addTrack(t, stream));
    // Video call without my camera: still receive theirs.
    if (role === "caller" && video && !stream?.getVideoTracks().length) pc.addTransceiver("video", { direction: "recvonly" });
    pc.ontrack = (e) => {
      const remote = e.streams[0] ?? new MediaStream([...(remoteRef.current?.getTracks() ?? []), e.track]);
      remoteRef.current = remote;
      callbacks.current.onRemoteStream(remote);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: "ice", to: peerIdRef.current, data: e.candidate.toJSON() });
    };
    pc.oniceconnectionstatechange = () => evaluate(pc);
    pc.onconnectionstatechange = () => evaluate(pc);
    pcRef.current = pc;
    return pc;
  }, [role, video, privateRelay, send, evaluate]);

  const handleSignal = useCallback(async (msg: Signal) => {
    if (!msg || msg.from === myId || (msg.to !== myId && msg.to !== "*") || endedRef.current) return;
    let pc = pcRef.current;
    if (!pc) return;
    try {
      switch (msg.type) {
        case "ready": {
          if (role !== "caller") return;
          peerIdRef.current = msg.from;
          callbacks.current.onPeerJoined?.();
          // The callee's page reloaded: its old peer connection is gone.
          if (msg.pc && peerPcRef.current && msg.pc !== peerPcRef.current && pc.remoteDescription) {
            pc = createPeer();
          }
          peerPcRef.current = msg.pc ?? peerPcRef.current;
          if (pc.remoteDescription) return; // duplicate "ready" while the answer is on its way
          if (phaseRef.current === "waiting") setPhase("connecting");
          startConnectTimer();
          if (pc.signalingState === "have-local-offer" && pc.localDescription && Date.now() - lastOfferAt.current < 4_000) {
            send({ type: "offer", to: msg.from, seq: offerSeq.current, data: pc.localDescription.toJSON() });
          } else {
            await makeOffer();
          }
          break;
        }
        case "offer": {
          if (role !== "callee" || !msg.data) return;
          peerIdRef.current = msg.from;
          peerPcRef.current = msg.pc ?? null;
          clearTimerIn(timers.current, "ready");
          if (pc.signalingState !== "stable") {
            await pc.setLocalDescription({ type: "rollback" }).catch(() => undefined);
          }
          await pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
          await flushIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ type: "answer", to: msg.from, seq: msg.seq, data: pc.localDescription?.toJSON() ?? answer });
          sendState();
          break;
        }
        case "answer": {
          if (role !== "caller" || !msg.data || pc.signalingState !== "have-local-offer") return;
          if (msg.seq !== undefined && msg.seq !== offerSeq.current) return; // answer to an older offer
          peerPcRef.current = msg.pc ?? peerPcRef.current;
          await pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
          await flushIce();
          sendState();
          break;
        }
        case "ice": {
          if (!msg.data) return;
          if (msg.pc && peerPcRef.current && msg.pc !== peerPcRef.current) return; // from a peer connection that is gone
          if (pc.remoteDescription) {
            await pc.addIceCandidate(msg.data as RTCIceCandidateInit).catch(() => undefined);
          } else {
            queuedIce.current.push(msg.data as RTCIceCandidateInit);
          }
          break;
        }
        case "restart": {
          if (role !== "caller" || Date.now() - lastOfferAt.current < 2_000) return;
          await makeOffer(true);
          break;
        }
        case "state": {
          const s = msg.data as PeerMediaState | null;
          if (s && typeof s.micOn === "boolean" && typeof s.camOn === "boolean") setPeerState({ micOn: s.micOn, camOn: s.camOn });
          break;
        }
        case "hangup": {
          endedRef.current = true;
          setPhase("ended");
          cleanup();
          callbacks.current.onPeerHangup();
          break;
        }
      }
    } catch (e) {
      console.error("Call signaling error:", e);
    }
  }, [myId, role, createPeer, makeOffer, flushIce, send, sendState, setPhase, startConnectTimer, cleanup]);

  const handleSignalRef = useRef(handleSignal);
  handleSignalRef.current = handleSignal;

  const refreshCameraChoice = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput").length;
      setCanSwitchCamera(cams > 1 && !!streamRef.current?.getVideoTracks().length);
    } catch {
      setCanSwitchCamera(false);
    }
  }, []);

  /**
   * Join the call with media already granted (see getCallMedia). `callKey`
   * names the call (session id; `pl-<id>` for Phone Line calls): both sides
   * meet on channel `call-<callKey>`.
   */
  const start = useCallback((stream: MediaStream, callKey: string) => {
    endedRef.current = false;
    everConnected.current = false;
    streamRef.current = stream;
    setLocalStream(stream);
    myState.current = { micOn: true, camOn: stream.getVideoTracks().length > 0 };
    createPeer();
    void refreshCameraChoice();

    const channel = supabase.channel(`call-${callKey}`, { config: { broadcast: { self: false, ack: false } } });
    channel.on("broadcast", { event: "signal" }, ({ payload }) => { serial(() => handleSignalRef.current(payload as Signal)); });
    channelRef.current = channel;
    let subscribed = false;
    timers.current.subscribe = setTimeout(() => {
      if (!subscribed) fail("signaling");
    }, SUBSCRIBE_TIMEOUT_MS);
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED" || endedRef.current) return;
      const first = !subscribed;
      subscribed = true;
      clearTimerIn(timers.current, "subscribe");
      if (!first) {
        // Realtime reconnected (network change): renegotiate if media dropped.
        if (phaseRef.current === "reconnecting") {
          clearTimerIn(timers.current, "restart");
          beginRestart();
        }
        return;
      }
      if (role === "callee") {
        // Keep announcing until the caller's offer arrives (messages can be
        // missed while either side is still joining).
        const announce = () => {
          if (endedRef.current || pcRef.current?.remoteDescription) {
            clearTimerIn(timers.current, "ready");
            return;
          }
          send({ type: "ready", to: "*" });
        };
        announce();
        timers.current.ready = setInterval(announce, READY_EVERY_MS);
        startConnectTimer();
      }
    });
    setPhase(role === "caller" ? "waiting" : "connecting");
  }, [role, createPeer, refreshCameraChoice, fail, beginRestart, send, startConnectTimer, setPhase, serial]);

  const hangUp = useCallback(() => {
    if (!endedRef.current) {
      endedRef.current = true;
      send({ type: "hangup", to: peerIdRef.current });
    }
    setPhase("ended");
    // Let the hangup message leave before tearing the channel down; stop the
    // camera and microphone right away.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setTimeout(cleanup, 150);
  }, [send, setPhase, cleanup]);

  const setMuted = useCallback((muted: boolean) => {
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    myState.current = { ...myState.current, micOn: !muted };
    sendState();
  }, [sendState]);

  const setVideoOff = useCallback((off: boolean) => {
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !off; });
    myState.current = { ...myState.current, camOn: !off && !!streamRef.current?.getVideoTracks().length };
    sendState();
  }, [sendState]);

  /** Front <-> back camera (phones). Returns false when it could not switch. */
  const switchCamera = useCallback(async (): Promise<boolean> => {
    const stream = streamRef.current;
    const old = stream?.getVideoTracks()[0];
    if (!stream || !old) return false;
    const next: "user" | "environment" = facingRef.current === "user" ? "environment" : "user";
    const enabled = old.enabled;
    // Many phones cannot open two cameras at once: release the current one first.
    old.stop();
    let fresh: MediaStreamTrack | undefined;
    let nowFacing = next;
    try {
      fresh = (await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: next } } })).getVideoTracks()[0];
    } catch {
      try {
        nowFacing = facingRef.current;
        fresh = (await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingRef.current } })).getVideoTracks()[0];
      } catch {
        fresh = undefined;
      }
    }
    if (endedRef.current || streamRef.current !== stream) {
      fresh?.stop();
      return false;
    }
    stream.removeTrack(old);
    if (!fresh) {
      myState.current = { ...myState.current, camOn: false };
      sendState();
      setLocalStream(new MediaStream(stream.getTracks()));
      return false;
    }
    fresh.enabled = enabled;
    stream.addTrack(fresh);
    const sender = pcRef.current?.getSenders().find((s) => s.track === old || s.track?.kind === "video");
    await sender?.replaceTrack(fresh).catch(() => undefined);
    facingRef.current = nowFacing;
    setFacing(nowFacing);
    setLocalStream(new MediaStream(stream.getTracks()));
    return nowFacing === next;
  }, [sendState]);

  // Back online: try to recover at once instead of waiting for the next retry.
  useEffect(() => {
    const online = () => {
      if (phaseRef.current === "reconnecting") {
        clearTimerIn(timers.current, "restart");
        beginRestart();
      }
    };
    // Tab closed or app backgrounded for good: tell the other side.
    const pagehide = () => {
      if (!endedRef.current && channelRef.current) send({ type: "hangup", to: peerIdRef.current });
    };
    window.addEventListener("online", online);
    window.addEventListener("pagehide", pagehide);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("pagehide", pagehide);
    };
  }, [beginRestart, send]);

  // Unmount only (refs, not deps: a re-render must never tear the call down).
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => () => {
    if (!endedRef.current && channelRef.current) {
      endedRef.current = true;
      sendRef.current({ type: "hangup", to: peerIdRef.current });
    }
    cleanup();
  }, [cleanup]);

  /**
   * Caller: the server says the other person answered. Their signaling should
   * follow; if it never does, fail with "timeout" instead of waiting forever.
   */
  const expectPeer = useCallback(() => {
    if (!endedRef.current && role === "caller") startConnectTimer();
  }, [role, startConnectTimer]);

  return { phase, localStream, peerState, canSwitchCamera, facing, start, hangUp, setMuted, setVideoOff, switchCamera, expectPeer };
}
