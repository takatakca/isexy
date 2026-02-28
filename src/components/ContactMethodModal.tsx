import { useState } from "react";
import { MessageCircle, Video, Phone, X, Loader2, CreditCard } from "lucide-react";
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

  if (!isOpen) return null;

  const handleContact = async (type: "chat" | "video" | "phone") => {
    if (!profile) return;
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
        if (result?.error === "no_credits") {
          toast.error(`You need ${result.cost} credits to unlock ${type}. You have ${result.balance}.`, {
            action: { label: "Buy Credits", onClick: () => navigate("/buy-credits") },
          });
          setUnlocking(null);
          return;
        }
        toast.error(result?.error || "Failed to unlock");
        setUnlocking(null);
        return;
      }

      onClose();

      if (type === "chat") {
        navigate(`/chat/${matchId}`);
      } else if (type === "video") {
        navigate(`/video-call/${matchId}`);
      } else {
        // Phone call - navigate to video call as fallback
        navigate(`/video-call/${matchId}`);
      }

      if (result.credits_spent > 0) {
        toast.success(`Unlocked ${type} for ${result.credits_spent} credits`);
      }
    } catch (err: any) {
      console.error("Unlock error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setUnlocking(null);
    }
  };

  const options = [
    { type: "chat" as const, icon: MessageCircle, label: "Chat", desc: "Send messages", cost: 5, color: "text-primary" },
    { type: "video" as const, icon: Video, label: "Video Call", desc: "Face-to-face", cost: 10, color: "text-emerald-500" },
    { type: "phone" as const, icon: Phone, label: "Phone Call", desc: "Voice call", cost: 10, color: "text-blue-500" },
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

        <div className="space-y-3">
          {options.map(({ type, icon: Icon, label, desc, cost, color }) => (
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
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <CreditCard className="w-4 h-4" />
                <span>{cost}</span>
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Premium members get free unlocks
        </p>
      </div>
    </div>
  );
}
