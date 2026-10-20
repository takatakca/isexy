import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Check, Loader2, Crown, Sparkles, ShieldCheck } from "lucide-react";
import { subscriptionTiers, SubscriptionTier, Duration } from "@/lib/subscriptionTiers";
import { toast } from "sonner";
import { PaymentsNotice } from "@/components/PaymentsNotice";
import { usePaymentsGate, blockedLabel } from "@/hooks/usePaymentsGate";
import { useWallet } from "@/hooks/useWallet";
import { useCheckoutReturn } from "@/hooks/useCheckoutReturn";
import { cad, startCheckout } from "@/lib/payments";
import { goBack } from "@/lib/navigation";
import { track } from "@/lib/analytics";

const tierMeta: Record<SubscriptionTier, { label: string; headline: string; icon: React.ReactNode }> = {
  plus: {
    label: "Plus",
    headline: "Unlimited Likes, Rewinds & Passport with ISEXY Plus.",
    icon: <Sparkles className="w-4 h-4" />,
  },
  gold: {
    label: "Gold",
    headline: "See who likes you and match instantly with ISEXY Gold.",
    icon: <Crown className="w-4 h-4" />,
  },
  platinum: {
    label: "Platinum",
    headline: "Stand out and get top-priority reach with ISEXY Platinum.",
    icon: <Crown className="w-4 h-4" />,
  },
};

export default function Premium() {
  const navigate = useNavigate();
  const gate = usePaymentsGate();
  const { wallet } = useWallet();
  const [activeTier, setActiveTier] = useState<SubscriptionTier>("gold");
  const [selectedDuration, setSelectedDuration] = useState<Duration>("week");
  const [loading, setLoading] = useState(false);

  useCheckoutReturn();

  // No countdown or discount banner (main 62ca7c1, decision 19): an offer the
  // payment server does not enforce is never shown.
  // A member who already pays through Stripe changes plan in Stripe's billing
  // page: a second checkout would start a second subscription.
  const paysWithStripe = wallet?.plan_source === "stripe";
  // Fail closed: null (still checking) or an unreadable status blocks checkout.
  const blocked = blockedLabel(gate);

  const tierData = subscriptionTiers[activeTier];
  const plans = tierData.plans;
  const features = tierData.features;
  const selectedPlan = plans.find((p) => p.duration === selectedDuration)!;

  const handleSubscribe = async () => {
    if (paysWithStripe) {
      navigate("/my-subscription");
      return;
    }
    if (blocked) {
      toast.error("Subscription availability could not be confirmed. Please retry later.");
      return;
    }
    setLoading(true);
    track("checkout_started", { product: "Premium" });
    const result = await startCheckout("isexy-create-checkout", {
      tier: activeTier,
      duration: selectedDuration,
    });
    if (!result.ok) {
      toast.error(result.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Coral glow header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/25 via-primary/5 to-transparent" aria-hidden />
        <div className="relative">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => goBack(navigate, "/discover")} className="p-2 rounded-full hover:bg-muted/50" aria-label="Close">
              <X className="w-6 h-6 text-foreground" />
            </button>
            <div className="flex items-center gap-1 glass-card rounded-full p-1">
              {(["plus", "gold", "platinum"] as SubscriptionTier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => {
                    setActiveTier(tier);
                    setSelectedDuration("week");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    activeTier === tier
                      ? "gradient-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tierMeta[tier].icon}
                  {tierMeta[tier].label}
                </button>
              ))}
            </div>
            <div className="w-10" />
          </div>

          <div className="px-6 pb-6 pt-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight">
              {tierMeta[activeTier].headline}
            </h1>
          </div>
        </div>
      </div>

      {/* Duration selector */}
      <div className="px-4 -mt-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">Choose duration</h2>
        <div className="grid grid-cols-3 gap-2">
          {plans.map((plan) => {
            const selected = selectedDuration === plan.duration;
            return (
              <button
                key={plan.duration}
                onClick={() => setSelectedDuration(plan.duration)}
                className={`relative p-3 rounded-2xl border text-left transition-all ${
                  selected
                    ? "border-primary bg-primary/10 ring-coral"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {(plan.popular || plan.bestValue) && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold gradient-primary text-primary-foreground whitespace-nowrap">
                    {plan.bestValue ? "Best value" : "Popular"}
                  </span>
                )}
                <p className="text-sm font-bold text-foreground">{plan.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{cad(plan.weeklyPrice)}/wk</p>
                {plan.savings && (
                  <span className="inline-block mt-2 text-[10px] font-bold text-primary">Save {plan.savings}%</span>
                )}
                {selected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Features */}
      <div className="flex-1 px-4 pb-56 overflow-y-auto mt-4">
        <div className="glass-card rounded-2xl p-5">
          <div className="flex justify-center mb-4">
            <span className="px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold">
              Included with {tierData.name}
            </span>
          </div>
          <div className="space-y-3">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="font-semibold text-foreground text-sm">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Secure checkout by Stripe · prices in CAD
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 glass-card border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        {paysWithStripe ? (
          <p className="text-xs text-center text-foreground" role="status">
            You have ISEXY {wallet?.tier ? wallet.tier.charAt(0).toUpperCase() + wallet.tier.slice(1) : ""}. Change or cancel it in My Subscription.
          </p>
        ) : (
          <PaymentsNotice gate={gate} />
        )}
        <button
          onClick={() => navigate("/compare-plans")}
          className="w-full text-center text-xs text-primary font-bold hover:underline"
        >
          Compare all plans →
        </button>
        <button
          onClick={() => handleSubscribe()}
          disabled={loading || (!paysWithStripe && !!blocked)}
          className="cta-primary w-full text-base disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : paysWithStripe ? (
            <>Manage my plan</>
          ) : blocked ? (
            <>{blocked}</>
          ) : (
            <>Continue {tierMeta[activeTier].label} · {selectedPlan.label} — {cad(selectedPlan.totalPrice)} CAD</>
          )}
        </button>
        <p className="text-[10px] text-muted-foreground text-center leading-snug">
          Renews automatically until cancelled. Cancel anytime in My Subscription. Your plan starts once Stripe confirms the payment.
        </p>
      </div>
    </div>
  );
}
