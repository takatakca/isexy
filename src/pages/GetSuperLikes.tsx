import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Star, Crown, Loader2, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";
import { usePaymentsGate, blockedLabel } from "@/hooks/usePaymentsGate";
import { useWallet, superLikesAvailable } from "@/hooks/useWallet";
import { useCheckoutReturn } from "@/hooks/useCheckoutReturn";
import { PaymentsNotice } from "@/components/PaymentsNotice";
import { cad, startCheckout } from "@/lib/payments";
import { goBack } from "@/lib/navigation";
import { track } from "@/lib/analytics";

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
  const gate = usePaymentsGate();
  const { wallet, refresh } = useWallet();
  const [selectedPackage, setSelectedPackage] = useState<string>("15");
  const [loading, setLoading] = useState(false);

  useCheckoutReturn(refresh, "Payment received. Your Super Likes will appear in a few seconds.");

  const selected = packages.find((p) => p.id === selectedPackage)!;
  const total = selected.quantity * selected.pricePerItem;
  const blocked = blockedLabel(gate);
  const available = wallet ? superLikesAvailable(wallet) : undefined;

  const handlePurchase = async () => {
    setLoading(true);
    track("checkout_started", { product: "GetSuperLikes" });
    const result = await startCheckout("isexy-create-one-time-payment", { productId: `super_likes_${selected.quantity}` });
    if (!result.ok) {
      toast.error(result.message);
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
            <button onClick={() => goBack(navigate, "/discover")} className="p-2 rounded-full hover:bg-muted/50" aria-label="Close">
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
              <span className="text-primary">Show you really want to talk.</span>
            </h1>
            {wallet && (
              <p className="text-xs text-muted-foreground mt-2" role="status">
                {available === null ? (
                  <>Your plan: <span className="font-bold text-foreground">unlimited Super Likes</span></>
                ) : (
                  <>
                    You have <span className="font-bold text-foreground">{available} Super Like{available === 1 ? "" : "s"}</span>
                    {wallet.weekly_super_likes_max > 0 && (
                      <> ({wallet.weekly_super_likes} of {wallet.weekly_super_likes_max} this week + {wallet.super_likes} saved)</>
                    )}
                  </>
                )}
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
                <p className="text-xs text-muted-foreground mt-2">{cad(pkg.pricePerItem)}/ea</p>
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
            Gold includes 5 free Super Likes every week
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
      <div className="sticky bottom-0 glass-card border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        <PaymentsNotice gate={gate} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <ShieldCheck className="w-4 h-4 text-primary" /> Secure checkout by Stripe · prices in CAD
        </div>
        <button
          onClick={handlePurchase}
          disabled={loading || !!blocked}
          className="cta-primary w-full disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : blocked ?? `Continue — ${cad(total)} CAD`}
        </button>
      </div>
    </div>
  );
}
