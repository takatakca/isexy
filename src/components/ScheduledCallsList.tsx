import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, Video, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, isPast, isFuture } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ScheduledCall {
  id: string;
  match_id: string;
  scheduler_id: string;
  recipient_id: string;
  scheduled_at: string;
  status: string;
  scheduler: { first_name: string };
  recipient: { first_name: string };
}

export function ScheduledCallsList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<ScheduledCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchScheduledCalls();
      subscribeToChanges();
    }
  }, [profile?.id]);

  const fetchScheduledCalls = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from("scheduled_calls")
      .select(`
        *,
        scheduler:profiles!scheduled_calls_scheduler_id_fkey(first_name),
        recipient:profiles!scheduled_calls_recipient_id_fkey(first_name)
      `)
      .or(`scheduler_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .in("status", ["pending", "confirmed"])
      .order("scheduled_at", { ascending: true });

    if (!error && data) {
      setCalls(data as unknown as ScheduledCall[]);
    }
    setLoading(false);
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel("scheduled-calls-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scheduled_calls" },
        () => fetchScheduledCalls()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleConfirm = async (callId: string) => {
    const { error } = await supabase
      .from("scheduled_calls")
      .update({ status: "confirmed" })
      .eq("id", callId);

    if (error) {
      toast.error("Failed to confirm call");
    } else {
      toast.success("Call confirmed!");
      fetchScheduledCalls();
    }
  };

  const handleCancel = async (callId: string) => {
    const { error } = await supabase
      .from("scheduled_calls")
      .update({ status: "cancelled" })
      .eq("id", callId);

    if (error) {
      toast.error("Failed to cancel call");
    } else {
      toast.success("Call cancelled");
      fetchScheduledCalls();
    }
  };

  const handleJoinCall = (matchId: string) => {
    navigate(`/video-call/${matchId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (calls.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-4">
      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        Scheduled Calls
      </h3>
      
      <div className="space-y-3">
        {calls.map((call) => {
          const isScheduler = call.scheduler_id === profile?.id;
          const otherPerson = isScheduler ? call.recipient : call.scheduler;
          const scheduledDate = new Date(call.scheduled_at);
          const isNow = Math.abs(Date.now() - scheduledDate.getTime()) < 5 * 60 * 1000; // Within 5 mins
          const isPastCall = isPast(scheduledDate) && !isNow;

          return (
            <div
              key={call.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                isNow ? "bg-primary/10 border border-primary" : "bg-muted"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isNow ? "bg-primary" : "bg-muted-foreground/20"}`}>
                  <Video className={`w-4 h-4 ${isNow ? "text-primary-foreground" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {otherPerson?.first_name}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {format(scheduledDate, "MMM d 'at' h:mm a")}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    call.status === "confirmed" 
                      ? "bg-green-500/20 text-green-500" 
                      : "bg-amber-500/20 text-amber-500"
                  }`}>
                    {call.status === "confirmed" ? "Confirmed" : "Pending"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isNow && (
                  <Button
                    size="sm"
                    onClick={() => handleJoinCall(call.match_id)}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    Join Now
                  </Button>
                )}
                
                {!isScheduler && call.status === "pending" && !isPastCall && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleConfirm(call.id)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
                
                {!isPastCall && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCancel(call.id)}
                    className="text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
