import { supabase } from "@/integrations/supabase/client";

/**
 * In-app call sessions (isexy.video_call_sessions) go through SECURITY
 * DEFINER RPCs only (docs/handoff/calls.sql): the server checks the match,
 * stamps the times and bills the caller's minutes.
 */
export interface CallRpcResult {
  success: boolean;
  error?: string;
  call_session_id?: string;
  remaining?: number;
  charged?: boolean;
  status?: string;
  call_type?: string;
  duration_seconds?: number;
  credits_used?: number;
  missed_call_id?: string;
  already_ended?: boolean;
}

type CallRpc =
  | "start_call"
  | "answer_call"
  | "decline_call"
  | "mark_call_connected"
  | "charge_call_minute"
  | "end_call"
  | "record_missed_call";

async function callRpc(fn: CallRpc, args: Record<string, unknown>): Promise<CallRpcResult> {
  try {
    const { data, error } = await supabase.rpc(fn, args as never);
    if (error) return { success: false, error: error.code === "PGRST202" ? "not_deployed" : "request_failed" };
    const result = data as unknown as CallRpcResult | null;
    return result ?? { success: false, error: "empty" };
  } catch {
    return { success: false, error: "request_failed" };
  }
}

export const startCall = (matchId: string, callType: "video" | "phone") =>
  callRpc("start_call", { p_match_id: matchId, p_call_type: callType });
export const answerCall = (sessionId: string) => callRpc("answer_call", { p_call_session_id: sessionId });
export const declineCall = (sessionId: string) => callRpc("decline_call", { p_call_session_id: sessionId });
export const markCallConnected = (sessionId: string) => callRpc("mark_call_connected", { p_call_session_id: sessionId });
export const chargeCallMinute = (sessionId: string) => callRpc("charge_call_minute", { p_call_session_id: sessionId });
export const endCall = (sessionId: string, reason?: string) =>
  callRpc("end_call", { p_call_session_id: sessionId, p_reason: reason ?? null });
export const recordMissedCall = (sessionId: string) => callRpc("record_missed_call", { p_call_session_id: sessionId });
