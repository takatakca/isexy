import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Timer, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BoostWallet {
  boosts: number;
  primetime_boosts: number;
  super_boost_hours: number;
  monthly_boost_available: boolean;
}

interface BoostWalletCardProps {
  profileId: string;
}

export default function BoostWalletCard({ profileId }: BoostWalletCardProps) {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<BoostWallet | null>(null);
  const [using, setUsing] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    const fetchWallet = async () => {
      const { data } = await supabase
        .from("boost_wallets")
        .select("boosts, primetime_boosts, super_boost_hours, monthly_boost_available")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (data) setWallet(data);
    };
    fetchWallet();
  }, [profileId]);

  const handleUseBoost = async (type: string) => {
    setUsing(type);
    try {
      const { data, error } = await supabase.rpc("use_boost", {
        p_profile_id: profileId,
        p_boost_type: type,
      });
      if (error) throw error;
      const result = data as Record<string, unknown>;
      if (result?.success) {
        toast.success(`${type === "monthly" ? "Monthly " : ""}Boost activated! 🚀`);
        // Refresh wallet
        const { data: refreshed } = await supabase
          .from("boost_wallets")
          .select("boosts, primetime_boosts, super_boost_hours, monthly_boost_available")
          .eq("profile_id", profileId)
          .maybeSingle();
        if (refreshed) setWallet(refreshed);
      } else {
        toast.error((result?.error as string) || "Failed to use boost");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to activate boost");
    } finally {
      setUsing(null);
    }
  };

  const items = [
    {
      type: "boost",
      label: "Boosts",
      count: wallet?.boosts ?? 0,
      icon: <Zap className="w-5 h-5 text-purple-400" />,
    },
    {
      type: "primetime",
      label: "Primetime Boosts",
      count: wallet?.primetime_boosts ?? 0,
      icon: <Timer className="w-5 h-5 text-purple-400" />,
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-bold text-foreground mb-3">My Boosts</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Be a top profile in your area for 30 minutes to get more matches
      </p>

      <div className="space-y-3 mb-4">
        {items.map((item) => (
          <div key={item.type} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                {item.icon}
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.count} left</p>
              </div>
            </div>
            {item.count > 0 && (
              <button
                onClick={() => handleUseBoost(item.type)}
                disabled={using === item.type}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white disabled:opacity-50"
              >
                {using === item.type ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Use"
                )}
              </button>
            )}
          </div>
        ))}

        {wallet?.monthly_boost_available && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Monthly Boost</p>
                <p className="text-xs text-muted-foreground">Free with your plan</p>
              </div>
            </div>
            <button
              onClick={() => handleUseBoost("monthly")}
              disabled={using === "monthly"}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-400 to-yellow-500 text-white disabled:opacity-50"
            >
              {using === "monthly" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Use"
              )}
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => navigate("/get-boosts")}
        className="w-full py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm hover:opacity-90 transition-opacity"
      >
        Get more Boosts
      </button>
    </div>
  );
}
