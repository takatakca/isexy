/**
 * ICE servers for calls. STUN finds a direct path between two browsers; TURN
 * relays the media when both people are behind strict NAT (mobile data, many
 * office and campus networks), where a STUN-only call never connects.
 *
 * Build-time settings (Vite env, baked into the web build):
 *   VITE_STUN_URL         optional, comma separated; default Google public STUN
 *   VITE_TURN_URL         comma separated TURN URLs, e.g.
 *                         "turn:turn.example.ca:3478?transport=udp,turns:turn.example.ca:5349?transport=tcp"
 *   VITE_TURN_USERNAME    TURN username
 *   VITE_TURN_CREDENTIAL  TURN password (use a limited, rotated credential)
 *   VITE_TURN_RELAY_ONLY  "true" sends all media through TURN (testing TURN)
 * The older name VITE_TURN_URLS is still read.
 */
type Env = Record<string, string | boolean | undefined>;

const DEFAULT_STUN = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];

function list(value: unknown): string[] {
  return typeof value === "string" ? value.split(",").map((u) => u.trim()).filter(Boolean) : [];
}

export function iceServers(env: Env = import.meta.env): RTCIceServer[] {
  const stun = list(env.VITE_STUN_URL);
  const servers: RTCIceServer[] = [{ urls: stun.length ? stun : DEFAULT_STUN }];
  const turn = [...list(env.VITE_TURN_URL), ...list(env.VITE_TURN_URLS)];
  if (turn.length) {
    servers.push({
      urls: Array.from(new Set(turn)),
      username: typeof env.VITE_TURN_USERNAME === "string" ? env.VITE_TURN_USERNAME : undefined,
      credential: typeof env.VITE_TURN_CREDENTIAL === "string" ? env.VITE_TURN_CREDENTIAL : undefined,
    });
  }
  return servers;
}

export function rtcConfiguration(env: Env = import.meta.env): RTCConfiguration {
  const servers = iceServers(env);
  const relayOnly = env.VITE_TURN_RELAY_ONLY === "true" && servers.length > 1;
  return { iceServers: servers, iceTransportPolicy: relayOnly ? "relay" : "all" };
}
