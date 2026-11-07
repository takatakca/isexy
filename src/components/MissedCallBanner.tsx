import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, PhoneMissed, Video, MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface MissedCall {
  id: string;
  match_id: string;
  caller_id: string;
  created_at: string;
  caller: { first_name: string } | null;
  call: { call_type: string | null } | null;
}

const DISMISSED_KEY = "isexy_dismissed_missed_calls";

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function MissedCallBanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  // Remembered on this device so a dismissed call stays dismissed.
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const profileId = profile?.id;

  const fetchMissedCalls = useCallback(async () => {
    if (!profileId) return;

    // Missed calls from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("missed_calls")
      .select(`
        id,
        match_id,
        caller_id,
        created_at,
        caller:profiles!missed_calls_caller_id_fkey(first_name),
        call:video_call_sessions!missed_calls_call_session_id_fkey(call_type)
      `)
      .eq("receiver_id", profileId)
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!error && data) {
      setMissedCalls(data as unknown as MissedCall[]);
    }
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    void fetchMissedCalls();
    const channel = supabase
      .channel(`missed-calls-${profileId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "isexy", table: "missed_calls", filter: `receiver_id=eq.${profileId}` },
        () => void fetchMissedCalls(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, fetchMissedCalls]);

  const handleCallBack = (call: MissedCall) => {
    const type = call.call?.call_type === "phone" ? "phone" : "video";
    navigate(`/video-call/${call.match_id}?type=${type}`);
  };

  const handleDismiss = (callId: string) => {
    setDismissed((prev) => {
      const next = [...prev, callId].slice(-50);
      try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const visibleCalls = missedCalls.filter((call) => !dismissed.includes(call.id));

  if (visibleCalls.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-4" aria-label="Missed calls">
      {visibleCalls.map((call) => {
        const isPhone = call.call?.call_type === "phone";
        return (
          <div
            key={call.id}
            className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-center gap-3"
          >
            <div className="p-2 rounded-full bg-destructive/15 shrink-0">
              <PhoneMissed className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                Missed {isPhone ? "call" : "video call"} from {call.caller?.first_name ?? "a match"}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => navigate(`/chat/${call.match_id}`)}
                className="p-2 rounded-full text-foreground hover:bg-muted/60"
                aria-label={`Message ${call.caller?.first_name ?? "them"}`}
              >
                <MessageCircle className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleCallBack(call)}
                className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                aria-label={`Call ${call.caller?.first_name ?? "them"} back`}
              >
                {isPhone ? <Phone className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
              <button
                onClick={() => handleDismiss(call.id)}
                className="p-2 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
