import { useState, useEffect } from "react";
import { MessageCircle, Video, Phone, X, Loader2, Clock, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  otherName: string;
  otherPhotoUrl?: string;
}

export function ContactMethodModal({ isOpen, onClose, matchId, otherName, otherPhotoUrl }: ContactMethodModalProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [hasChatSub, setHasChatSub] = useState(false);
  const [phoneMinutes, setPhoneMinutes] = useState(0);
  const [videoMinutes, setVideoMinutes] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    if (!isOpen || !profile?.id) return;
    const fetchStatus = async () => {
      setLoadingStatus(true);
      const [subResult, creditsResult] = await Promise.all([
        supabase
          .from("chat_subscriptions")
          .select("id")
          .eq("profile_id", profile.id)
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString())
          .limit(1),
        supabase
          .from("user_credits")
          .select("phone_minutes, video_minutes")
          .eq("profile_id", profile.id)
          .maybeSingle(),
      ]);
      setHasChatSub((subResult.data?.length || 0) > 0 || profile.is_premium === true);
      setPhoneMinutes(creditsResult.data?.phone_minutes || 0);
      setVideoMinutes(creditsResult.data?.video_minutes || 0);
      setLoadingStatus(false);
    };
    fetchStatus();
  }, [isOpen, profile?.id]);

  if (!isOpen) return null;

  const handleContact = async (type: "chat" | "video" | "phone") => {
    if (!profile) return;

    // Pre-check entitlements before calling server
    if (type === "chat" && !hasChatSub) {
      toast.error("Chat requires an active subscription.", {
        action: { label: "Subscribe", onClick: () => navigate("/premium") },
      });
      return;
    }
    if (type === "video" && videoMinutes <= 0) {
      toast.error("You need video minutes to start a call.", {
        action: { label: "Buy Minutes", onClick: () => navigate("/buy-minutes") },
      });
      return;
    }
    if (type === "phone" && phoneMinutes <= 0) {
      toast.error("You need phone minutes to start a call.", {
        action: { label: "Buy Minutes", onClick: () => navigate("/buy-minutes") },
      });
      return;
    }

    setUnlocking(type);
    try {
      const { data, error } = await supabase.rpc("unlock_conversation", {
        p_profile_id: profile.id,
        p_match_id: matchId,
        p_unlock_type: type,
      });

      if (error) throw error;
      const result = data as any;

      if (!result?.success) {
        if (result?.error === "no_chat_subscription") {
          toast.error("Chat requires an active subscription.", {
            action: { label: "Subscribe", onClick: () => navigate("/premium") },
          });
        } else if (result?.error === "no_minutes") {
          toast.error(`You need ${result.type} minutes.`, {
            action: { label: "Buy Minutes", onClick: () => navigate("/buy-minutes") },
          });
        } else {
          toast.error(result?.error || "Failed to unlock");
        }
        setUnlocking(null);
        return;
      }

      onClose();
      if (type === "chat") navigate(`/chat/${matchId}`);
      else if (type === "video") navigate(`/video-call/${matchId}`);
      else navigate(`/video-call/${matchId}`); // Phone stub
    } catch (err: any) {
      console.error("Unlock error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setUnlocking(null);
    }
  };

  const options = [
    {
      type: "chat" as const,
      icon: MessageCircle,
      label: "Chat",
      desc: hasChatSub ? "Subscription active" : "Subscription required",
      available: hasChatSub,
      detail: hasChatSub ? "✓ Active" : "Subscribe",
      color: "text-primary",
    },
    {
      type: "video" as const,
      icon: Video,
      label: "Video Call",
      desc: `${videoMinutes} min available`,
      available: videoMinutes > 0,
      detail: videoMinutes > 0 ? `${videoMinutes} min` : "Buy minutes",
      color: "text-emerald-500",
    },
    {
      type: "phone" as const,
      icon: Phone,
      label: "Phone Call",
      desc: `${phoneMinutes} min available`,
      available: phoneMinutes > 0,
      detail: phoneMinutes > 0 ? `${phoneMinutes} min` : "Buy minutes",
      color: "text-blue-500",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-8 shadow-xl animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">Contact {otherName}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {otherPhotoUrl && (
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-primary/20">
              <img src={otherPhotoUrl} alt={otherName} className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        {loadingStatus ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {options.map(({ type, icon: Icon, label, desc, available, detail, color }) => (
              <button
                key={type}
                onClick={() => handleContact(type)}
                disabled={unlocking !== null}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <div className={`w-12 h-12 rounded-full bg-muted flex items-center justify-center ${color}`}>
                  {unlocking === type ? <Loader2 className="w-6 h-6 animate-spin" /> : <Icon className="w-6 h-6" />}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-foreground">{label}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  {available ? (
                    <span className="text-emerald-500 font-medium">{detail}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-500 font-medium">
                      <Lock className="w-3 h-3" />
                      {detail}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-4">
          Calls billed per minute · Chat requires subscription
        </p>
      </div>
    </div>
  );
}
