import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, PhoneMissed, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

interface MissedCall {
  id: string;
  match_id: string;
  caller_id: string;
  created_at: string;
  caller: { first_name: string };
}

export function MissedCallBanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    if (profile?.id) {
      fetchMissedCalls();
    }
  }, [profile?.id]);

  const fetchMissedCalls = async () => {
    if (!profile?.id) return;

    // Get missed calls from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("missed_calls")
      .select(`
        id,
        match_id,
        caller_id,
        created_at,
        caller:profiles!missed_calls_caller_id_fkey(first_name)
      `)
      .eq("receiver_id", profile.id)
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!error && data) {
      setMissedCalls(data as unknown as MissedCall[]);
    }
  };

  const handleCallBack = (matchId: string) => {
    navigate(`/video-call/${matchId}`);
  };

  const handleDismiss = (callId: string) => {
    setDismissed((prev) => [...prev, callId]);
  };

  const visibleCalls = missedCalls.filter((call) => !dismissed.includes(call.id));

  if (visibleCalls.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
      {visibleCalls.map((call) => (
        <div
          key={call.id}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-500/20">
              <PhoneMissed className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                Missed call from {call.caller?.first_name}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleCallBack(call.match_id)}
              className="bg-green-500 hover:bg-green-600"
            >
              <Phone className="w-4 h-4 mr-1" />
              Call Back
            </Button>
            <button
              onClick={() => handleDismiss(call.id)}
              className="p-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
