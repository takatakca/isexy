import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WebRTCConfig {
  matchId: string;
  profileId: string;
  onRemoteStream?: (stream: MediaStream) => void;
  onCallEnded?: () => void;
  onCallConnected?: () => void;
}

interface SignalingMessage {
  type: "offer" | "answer" | "ice-candidate" | "call-end";
  payload: any;
  from: string;
  to: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function useWebRTC({
  matchId,
  profileId,
  onRemoteStream,
  onCallEnded,
  onCallConnected,
}: WebRTCConfig) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);

  // Initialize the signaling channel
  const initSignaling = useCallback(() => {
    const channel = supabase.channel(`video-call-${matchId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "signaling" }, async ({ payload }) => {
        const message = payload as SignalingMessage;
        
        // Ignore messages from ourselves or not for us
        if (message.from === profileId || message.to !== profileId) return;

        const pc = peerConnectionRef.current;
        if (!pc) return;

        try {
          switch (message.type) {
            case "offer":
              await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              
              // Send answer
              channel.send({
                type: "broadcast",
                event: "signaling",
                payload: {
                  type: "answer",
                  payload: answer,
                  from: profileId,
                  to: message.from,
                } as SignalingMessage,
              });
              
              // Add pending ICE candidates
              for (const candidate of pendingCandidatesRef.current) {
                await pc.addIceCandidate(candidate);
              }
              pendingCandidatesRef.current = [];
              break;

            case "answer":
              await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
              
              // Add pending ICE candidates
              for (const candidate of pendingCandidatesRef.current) {
                await pc.addIceCandidate(candidate);
              }
              pendingCandidatesRef.current = [];
              break;

            case "ice-candidate":
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(message.payload));
              } else {
                pendingCandidatesRef.current.push(new RTCIceCandidate(message.payload));
              }
              break;

            case "call-end":
              endCall();
              onCallEnded?.();
              break;
          }
        } catch (error) {
          console.error("Error handling signaling message:", error);
        }
      })
      .subscribe();

    channelRef.current = channel;
  }, [matchId, profileId, onCallEnded]);

  // Create peer connection
  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      if (event.streams[0]) {
        onRemoteStream?.(event.streams[0]);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "signaling",
          payload: {
            type: "ice-candidate",
            payload: event.candidate.toJSON(),
            from: profileId,
            to: "*", // Broadcast to all
          } as SignalingMessage,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case "connected":
          setIsConnected(true);
          setIsConnecting(false);
          onCallConnected?.();
          break;
        case "disconnected":
        case "failed":
        case "closed":
          setIsConnected(false);
          setIsConnecting(false);
          break;
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [profileId, onRemoteStream, onCallConnected]);

  // Start a call (caller)
  const startCall = useCallback(async () => {
    setIsConnecting(true);

    try {
      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);

      // Initialize signaling
      initSignaling();

      // Create peer connection
      const pc = createPeerConnection(stream);

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channelRef.current?.send({
        type: "broadcast",
        event: "signaling",
        payload: {
          type: "offer",
          payload: offer,
          from: profileId,
          to: "*", // Broadcast to match
        } as SignalingMessage,
      });

      return stream;
    } catch (error) {
      console.error("Error starting call:", error);
      setIsConnecting(false);
      throw error;
    }
  }, [initSignaling, createPeerConnection, profileId]);

  // Answer a call (callee)
  const answerCall = useCallback(async () => {
    setIsConnecting(true);

    try {
      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);

      // Initialize signaling
      initSignaling();

      // Create peer connection
      createPeerConnection(stream);

      return stream;
    } catch (error) {
      console.error("Error answering call:", error);
      setIsConnecting(false);
      throw error;
    }
  }, [initSignaling, createPeerConnection]);

  // End the call
  const endCall = useCallback(() => {
    // Send end signal
    channelRef.current?.send({
      type: "broadcast",
      event: "signaling",
      payload: {
        type: "call-end",
        payload: null,
        from: profileId,
        to: "*",
      } as SignalingMessage,
    });

    // Stop local stream
    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);

    // Close peer connection
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    // Unsubscribe from channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    pendingCandidatesRef.current = [];
  }, [localStream, profileId]);

  // Toggle mute
  const toggleMute = useCallback((muted: boolean) => {
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback((videoOff: boolean) => {
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = !videoOff;
    });
  }, [localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    localStream,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}
