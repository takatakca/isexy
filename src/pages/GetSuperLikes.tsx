import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Star, Crown, Loader2, ShieldCheck, Lock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePaymentsGate } from "@/hooks/usePaymentsGate";

interface Package {
  id: string;
  quantity: number;
  pricePerItem: number;
  popular?: boolean;
  bestValue?: boolean;
  savings?: number;
}

const packages: Package[] = [
  { id: "3", quantity: 3, pricePerItem: 3.99 },
  { id: "15", quantity: 15, pricePerItem: 3.26, popular: true, savings: 18 },
  { id: "30", quantity: 30, pricePerItem: 2.49, bestValue: true, savings: 37 },
];

export default function GetSuperLikes() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const gate = usePaymentsGate();
  const [selectedPackage, setSelectedPackage] = useState<string>("15");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from("user_credits")
        .select("super_likes")
        .eq("profile_id", profile.id)
        .maybeSingle();
      // @ts-ignore — column may not exist on every project
      if (data) setBalance(data.super_likes ?? 0);
    };
    fetch();
  }, [profile?.id]);

  const selected = packages.find((p) => p.id === selectedPackage)!;
  const total = selected.quantity * selected.pricePerItem;

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const productId = `super_likes_${selected.quantity}`;
      const { data, error } = await supabase.functions.invoke("create-one-time-payment", {
        body: { productId, metadata: { type: "super_likes", quantity: String(selected.quantity) } },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (error) {
      console.error("Purchase error:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/25 via-primary/5 to-transparent" aria-hidden />
        <div className="relative">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted/50">
              <X className="w-6 h-6 text-foreground" />
            </button>
            <div className="flex items-center gap-2 glass-card px-3 py-1 rounded-full">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="font-bold text-foreground text-sm">Super Likes</span>
            </div>
            <div className="w-10" />
          </div>

          <div className="px-6 pb-6">
            <h1 className="text-2xl font-extrabold text-foreground leading-tight">
              Stand out with Super Like.<br />
              <span className="text-primary">3× more likely</span> to match.
            </h1>
            {balance !== null && (
              <p className="text-xs text-muted-foreground mt-2">
                Your balance: <span className="font-bold text-foreground">{balance} Super Like{balance === 1 ? "" : "s"}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Packages */}
      <div className="px-4 py-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">Select a package</h2>

        <div className="grid grid-cols-3 gap-2">
          {packages.map((pkg) => {
            const isSel = selectedPackage === pkg.id;
            return (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                className={`relative p-3 rounded-2xl border transition-all text-left ${
                  isSel
                    ? "border-primary bg-primary/10 ring-coral"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {(pkg.popular || pkg.bestValue) && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold gradient-primary text-primary-foreground whitespace-nowrap">
                    {pkg.bestValue ? "Best value" : "Popular"}
                  </span>
                )}
                <p className="text-lg font-extrabold text-foreground">{pkg.quantity}</p>
                <p className="text-[11px] text-muted-foreground">Super Like{pkg.quantity > 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground mt-2">${pkg.pricePerItem.toFixed(2)}/ea</p>
                {pkg.savings && <span className="inline-block mt-1 text-[10px] font-bold text-primary">Save {pkg.savings}%</span>}
                {isSel && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 px-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-muted-foreground text-xs uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Gold upsell */}
      <div className="px-4 py-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold text-muted-foreground text-center mb-3">
            Includes 5 free Super Likes every week
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary fill-primary/30" />
              <span className="font-bold text-foreground">Get ISEXY Gold</span>
            </div>
            <button
              onClick={() => navigate("/premium")}
              className="px-4 py-2 border border-border rounded-full text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Select
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1" />

      {/* Bottom CTA */}
      <div className="glass-card border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        {gate?.blocked && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5 justify-center">
            <Lock className="w-3.5 h-3.5" /> Live payments disabled during testing
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <ShieldCheck className="w-4 h-4 text-primary" /> Secure checkout powered by Stripe
        </div>
        <button
          onClick={handlePurchase}
          disabled={loading}
          className="cta-primary w-full"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Continue — $${total.toFixed(2)} CAD`}
        </button>
      </div>
    </div>
  );
}
