import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Zap, Timer, Sparkles, Crown, Loader2, ShieldCheck, Lock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePaymentsGate } from "@/hooks/usePaymentsGate";

type BoostType = "boost" | "primetime" | "super";

interface Package {
  id: string;
  quantity: number;
  pricePerItem: number;
  popular?: boolean;
  bestValue?: boolean;
  savings?: number;
  duration?: string;
}

const boostPackages: Package[] = [
  { id: "1", quantity: 1, pricePerItem: 6.49 },
  { id: "10", quantity: 10, pricePerItem: 3.29, popular: true, savings: 49 },
  { id: "20", quantity: 20, pricePerItem: 2.49, bestValue: true, savings: 62 },
];

const primetimePackages: Package[] = [
  { id: "1", quantity: 1, pricePerItem: 9.99 },
  { id: "3", quantity: 3, pricePerItem: 9.33, popular: true, savings: 7 },
  { id: "5", quantity: 5, pricePerItem: 7.79, bestValue: true, savings: 22 },
];

const superBoostPackages: Package[] = [
  { id: "3h", quantity: 3, pricePerItem: 49.99, duration: "3 hours" },
  { id: "6h", quantity: 6, pricePerItem: 92.99, duration: "6 hours", popular: true, savings: 7 },
  { id: "12h", quantity: 12, pricePerItem: 169.99, duration: "12 hours", bestValue: true, savings: 15 },
];

const boostTypeConfig: Record<BoostType, {
  title: string;
  description: string;
  icon: React.ReactNode;
  packages: Package[];
  goldUpsell: string;
}> = {
  boost: {
    title: "Boost",
    description: "Be a top profile in your area for 30 minutes — get more Likes, faster.",
    icon: <Zap className="w-6 h-6 text-primary-foreground" />,
    packages: boostPackages,
    goldUpsell: "1 free Boost a month",
  },
  primetime: {
    title: "Primetime Boost",
    description: "We boost you when the most users are active so you're seen by more potential matches.",
    icon: <Timer className="w-6 h-6 text-primary-foreground" />,
    packages: primetimePackages,
    goldUpsell: "1 free Boost a month",
  },
  super: {
    title: "Super Boost",
    description: "Stay front-and-center for hours, with more opportunities to connect.",
    icon: <Sparkles className="w-6 h-6 text-primary-foreground" />,
    packages: superBoostPackages,
    goldUpsell: "Subscriber benefit",
  },
};

export default function GetBoosts() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const gate = usePaymentsGate();
  const [activeType, setActiveType] = useState<BoostType>("boost");
  const [selectedPackage, setSelectedPackage] = useState<string>("10");
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<{ boosts: number; primetime: number; superHours: number; monthlyAvail: boolean } | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from("boost_wallet" as any)
        .select("boosts, primetime_boosts, super_boost_hours, monthly_boost_available")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (data) {
        setWallet({
          boosts: (data as any).boosts ?? 0,
          primetime: (data as any).primetime_boosts ?? 0,
          superHours: (data as any).super_boost_hours ?? 0,
          monthlyAvail: !!(data as any).monthly_boost_available,
        });
      }
    };
    fetch();
  }, [profile?.id]);

  const config = boostTypeConfig[activeType];
  const packages = config.packages;
  const selected = packages.find((p) => p.id === selectedPackage) || packages[1];

  const total = activeType === "super" ? selected.pricePerItem : selected.quantity * selected.pricePerItem;

  const handleTypeChange = (type: BoostType) => {
    setActiveType(type);
    const defaultId = type === "super" ? "6h" : type === "primetime" ? "3" : "10";
    setSelectedPackage(defaultId);
  };

  const handlePurchase = async () => {
    setLoading(true);
    try {
      let productId: string | null = null;
      if (activeType === "boost") productId = `boost_${selected.quantity}`;
      else if (activeType === "primetime") productId = `primetime_${selected.quantity}`;
      else if (activeType === "super") productId = `superboost_${selected.quantity}h`;

      if (!productId) {
        toast.error("Unknown package");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-one-time-payment", {
        body: {
          productId,
          metadata: {
            type: activeType,
            ...(activeType === "super" ? { hours: String(selected.quantity) } : { quantity: String(selected.quantity) }),
            ...(activeType === "primetime" ? { schedule_peak: "true" } : {}),
          },
        },
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
      <div className="flex items-center justify-between p-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted/50">
          <X className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="font-bold text-base text-foreground">Choose your Boost</h1>
        <div className="w-10" />
      </div>

      {/* Wallet */}
      {wallet && (
        <div className="px-4 mb-3">
          <div className="glass-card rounded-2xl p-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <Zap className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-lg font-extrabold text-foreground">{wallet.boosts}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Boosts</p>
            </div>
            <div>
              <Timer className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-lg font-extrabold text-foreground">{wallet.primetime}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Primetime</p>
            </div>
            <div>
              <Sparkles className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-lg font-extrabold text-foreground">{wallet.superHours}h</p>
              <p className="text-[10px] text-muted-foreground uppercase">Super</p>
            </div>
          </div>
          {wallet.monthlyAvail && (
            <p className="text-[11px] text-primary text-center mt-2 font-semibold">
              ✨ You have 1 free monthly Boost available
            </p>
          )}
        </div>
      )}

      {/* Type tabs */}
      <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
        {(["boost", "primetime", "super"] as BoostType[]).map((type) => (
          <button
            key={type}
            onClick={() => handleTypeChange(type)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
              activeType === type
                ? "gradient-primary text-primary-foreground"
                : "text-muted-foreground border border-border hover:bg-muted/50"
            }`}
          >
            {type === "boost" ? "Boost" : type === "primetime" ? "Primetime" : "Super Boost"}
          </button>
        ))}
      </div>

      {/* Boost info card */}
      <div className="mx-4 p-4 rounded-2xl gradient-primary text-primary-foreground glow-primary">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
            {config.icon}
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-lg mb-1">{config.title}</h2>
            <p className="text-sm text-primary-foreground/90 leading-snug">{config.description}</p>
          </div>
        </div>
      </div>

      {/* Packages */}
      <div className="flex-1 px-4 py-5 pb-44">
        <div className="space-y-3">
          {packages.map((pkg) => {
            const isSel = selectedPackage === pkg.id;
            return (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                className={`w-full p-4 rounded-2xl border transition-all relative ${
                  isSel
                    ? "border-primary bg-primary/10 ring-coral"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    {(pkg.popular || pkg.bestValue) && (
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wide block mb-1">
                        {pkg.bestValue ? "Best value" : "Popular"}
                      </span>
                    )}
                    <p className="text-lg font-extrabold text-foreground">
                      {activeType === "super"
                        ? pkg.duration
                        : `${pkg.quantity} ${pkg.quantity === 1 ? config.title : config.title + "s"}`}
                    </p>
                  </div>
                  <div className="text-right">
                    {pkg.savings && (
                      <span className="inline-block px-2 py-0.5 bg-primary/15 rounded-full text-[10px] font-bold text-primary mb-1">
                        Save {pkg.savings}%
                      </span>
                    )}
                    <p className="text-base font-bold text-foreground">
                      ${pkg.pricePerItem.toFixed(2)}{activeType !== "super" && "/ea"}
                    </p>
                  </div>
                  {isSel && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Gold upsell */}
        <div className="mt-6">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs font-semibold text-muted-foreground text-center mb-3">{config.goldUpsell}</p>
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
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 glass-card border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        {gate?.blocked && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5 justify-center">
            <Lock className="w-3.5 h-3.5" /> Live payments disabled during testing
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <ShieldCheck className="w-4 h-4 text-primary" /> Secure checkout powered by Stripe
        </div>
        <button onClick={handlePurchase} disabled={loading} className="cta-primary w-full">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Continue — $${total.toFixed(2)} CAD`}
        </button>
      </div>
    </div>
  );
}
