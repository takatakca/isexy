import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Zap, Timer, Sparkles, Crown, Loader2, ShieldCheck, Check, Gift } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePaymentsGate, blockedLabel } from "@/hooks/usePaymentsGate";
import { useWallet } from "@/hooks/useWallet";
import { useCheckoutReturn } from "@/hooks/useCheckoutReturn";
import { PaymentsNotice } from "@/components/PaymentsNotice";
import { activateBoost, boostEndsLabel, type BoostKind } from "@/lib/boosts";
import { cad, startCheckout } from "@/lib/payments";
import { goBack } from "@/lib/navigation";
import { track } from "@/lib/analytics";

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
    description: "Be a top profile in your area for 30 minutes, so more people see you and say hi.",
    icon: <Zap className="w-6 h-6 text-primary-foreground" />,
    packages: boostPackages,
    goldUpsell: "1 free Boost a month",
  },
  primetime: {
    title: "Primetime Boost",
    description: "A 30-minute Boost for the busiest hours: start it in the evening, when the most members are online.",
    icon: <Timer className="w-6 h-6 text-primary-foreground" />,
    packages: primetimePackages,
    goldUpsell: "1 free Boost a month",
  },
  super: {
    title: "Super Boost",
    description: "Stay at the very top of Discover for hours. All your Super Boost hours run in one go when you start it.",
    icon: <Sparkles className="w-6 h-6 text-primary-foreground" />,
    packages: superBoostPackages,
    goldUpsell: "Subscriber benefit",
  },
};

export default function GetBoosts() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const gate = usePaymentsGate();
  const { wallet, refresh } = useWallet();
  const [activeType, setActiveType] = useState<BoostType>("boost");
  const [selectedPackage, setSelectedPackage] = useState<string>("10");
  const [loading, setLoading] = useState(false);
  const [using, setUsing] = useState<BoostKind | null>(null);

  useCheckoutReturn(refresh, "Payment received. Your Boosts will appear in a few seconds.");

  const config = boostTypeConfig[activeType];
  const packages = config.packages;
  const selected = packages.find((p) => p.id === selectedPackage) || packages[1];
  const total = activeType === "super" ? selected.pricePerItem : selected.quantity * selected.pricePerItem;
  const blocked = blockedLabel(gate);

  const handleTypeChange = (type: BoostType) => {
    setActiveType(type);
    setSelectedPackage(type === "super" ? "6h" : type === "primetime" ? "3" : "10");
  };

  const handlePurchase = async () => {
    const productId =
      activeType === "boost" ? `boost_${selected.quantity}`
      : activeType === "primetime" ? `primetime_${selected.quantity}`
      : `superboost_${selected.quantity}h`;
    setLoading(true);
    track("checkout_started", { product: "GetBoosts" });
    const result = await startCheckout("isexy-create-one-time-payment", { productId });
    if (!result.ok) {
      toast.error(result.message);
      setLoading(false);
    }
  };

  const use = async (kind: BoostKind) => {
    if (!profile?.id || using) return;
    setUsing(kind);
    const result = await activateBoost(profile.id, kind);
    setUsing(null);
    if (result.ok) {
      toast.success(kind === "super" ? `Super Boost on for ${result.hours} hours 🚀` : "Boost on: you're at the top of Discover for 30 minutes 🚀");
      refresh();
      refreshProfile?.();
    } else {
      toast.error(result.message);
      if (result.reason !== "error") refresh();
    }
  };

  const running = wallet?.boost_active_until && new Date(wallet.boost_active_until).getTime() > Date.now();
  const walletRows: { kind: BoostKind; label: string; count: string; icon: React.ReactNode; canUse: boolean }[] = wallet
    ? [
        { kind: "boost", label: "Boosts", count: String(wallet.boosts), icon: <Zap className="w-4 h-4 text-primary" />, canUse: wallet.boosts > 0 },
        { kind: "primetime", label: "Primetime", count: String(wallet.primetime_boosts), icon: <Timer className="w-4 h-4 text-primary" />, canUse: wallet.primetime_boosts > 0 },
        { kind: "super", label: "Super Boost", count: `${wallet.super_boost_hours}h`, icon: <Sparkles className="w-4 h-4 text-primary" />, canUse: wallet.super_boost_hours > 0 },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={() => goBack(navigate, "/discover")} className="p-2 rounded-full hover:bg-muted/50" aria-label="Close">
          <X className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="font-bold text-base text-foreground">Choose your Boost</h1>
        <div className="w-10" />
      </div>

      {/* Wallet */}
      {wallet && (
        <section className="px-4 mb-3" aria-label="Your Boosts">
          <div className="glass-card rounded-2xl p-3 space-y-2">
            {running && (
              <p className="text-xs font-semibold text-primary text-center" role="status">{boostEndsLabel(wallet.boost_active_until)}</p>
            )}
            <div className="grid grid-cols-3 gap-2 text-center">
              {walletRows.map((row) => (
                <div key={row.kind} className="flex flex-col items-center gap-1">
                  {row.icon}
                  <p className="text-lg font-extrabold text-foreground tabular-nums">{row.count}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{row.label}</p>
                  <button
                    onClick={() => use(row.kind)}
                    disabled={!row.canUse || !!using}
                    className="mt-1 px-3 py-1 rounded-full text-xs font-semibold gradient-primary text-primary-foreground disabled:opacity-40"
                    aria-label={`Use ${row.label}`}
                  >
                    {using === row.kind ? <Loader2 className="w-3 h-3 animate-spin" /> : "Use"}
                  </button>
                </div>
              ))}
            </div>
            {wallet.monthly_boost_available && (
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                <p className="text-xs text-foreground flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-primary" /> Your free monthly Boost is ready
                </p>
                <button
                  onClick={() => use("monthly")}
                  disabled={!!using}
                  className="px-3 py-1 rounded-full text-xs font-semibold gradient-primary text-primary-foreground disabled:opacity-40"
                >
                  {using === "monthly" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Use"}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Type tabs */}
      <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide" role="tablist">
        {(["boost", "primetime", "super"] as BoostType[]).map((type) => (
          <button
            key={type}
            role="tab"
            aria-selected={activeType === type}
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
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0">
            {config.icon}
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-lg mb-1">{config.title}</h2>
            <p className="text-sm text-primary-foreground/90 leading-snug">{config.description}</p>
          </div>
        </div>
      </div>

      {/* Packages */}
      <div className="flex-1 px-4 py-5 pb-56">
        <div className="space-y-3">
          {packages.map((pkg) => {
            const isSel = selectedPackage === pkg.id;
            return (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                aria-pressed={isSel}
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
                  <div className="text-right pr-6">
                    {pkg.savings && (
                      <span className="inline-block px-2 py-0.5 bg-primary/15 rounded-full text-[10px] font-bold text-primary mb-1">
                        Save {pkg.savings}%
                      </span>
                    )}
                    <p className="text-base font-bold text-foreground">
                      {cad(pkg.pricePerItem)}{activeType !== "super" && "/ea"}
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
        <PaymentsNotice gate={gate} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <ShieldCheck className="w-4 h-4 text-primary" /> Secure checkout by Stripe · prices in CAD
        </div>
        <button onClick={handlePurchase} disabled={loading || !!blocked} className="cta-primary w-full disabled:opacity-60">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : blocked ?? `Continue — ${cad(total)} CAD`}
        </button>
      </div>
    </div>
  );
}
