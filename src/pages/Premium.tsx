import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Check, Loader2, Crown, Sparkles, ShieldCheck, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subscriptionTiers, SubscriptionTier, Duration } from "@/lib/subscriptionTiers";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PromoCountdownBanner } from "@/components/PromoCountdownBanner";
import { usePaymentsGate } from "@/hooks/usePaymentsGate";

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
  const { profile } = useAuth();
  const gate = usePaymentsGate();
  const [activeTier, setActiveTier] = useState<SubscriptionTier>("gold");
  const [selectedDuration, setSelectedDuration] = useState<Duration>("week");
  const [loading, setLoading] = useState(false);
  const showPromo = !profile?.first_purchase_promo_used && !profile?.is_premium;

  const tierData = subscriptionTiers[activeTier];
  const plans = tierData.plans;
  const features = tierData.features;
  const selectedPlan = plans.find((p) => p.duration === selectedDuration)!;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { tier: activeTier, duration: selectedDuration },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
    } finally {
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
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted/50" aria-label="Close">
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

      {showPromo && (
        <PromoCountdownBanner
          onCtaClick={() => {
            setSelectedDuration("week");
            handleSubscribe();
          }}
          discountPercent={50}
          durationMinutes={30}
        />
      )}

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
                <p className="text-xs text-muted-foreground mt-1">${plan.weeklyPrice.toFixed(2)}/wk</p>
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
          Secure checkout powered by Stripe
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 glass-card border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
        {gate?.blocked && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5 justify-center">
            <Lock className="w-3.5 h-3.5" />
            Live payments are disabled during testing
          </div>
        )}
        <button
          onClick={() => navigate("/compare-plans")}
          className="w-full text-center text-xs text-primary font-bold hover:underline"
        >
          Compare all plans →
        </button>
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="cta-primary w-full text-base"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>Continue {tierMeta[activeTier].label} · {selectedPlan.label} — ${selectedPlan.totalPrice.toFixed(2)}</>
          )}
        </button>
        <p className="text-[10px] text-muted-foreground text-center leading-snug">
          Subscription renews automatically until cancelled. Cancel anytime in Settings. Purchases apply after successful payment.
        </p>
      </div>
    </div>
  );
}
