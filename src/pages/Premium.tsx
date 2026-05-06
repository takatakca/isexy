import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Check, Loader2, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subscriptionTiers, SubscriptionTier, Duration } from "@/lib/subscriptionTiers";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PromoCountdownBanner } from "@/components/PromoCountdownBanner";

const tierConfig: Record<SubscriptionTier, {
  gradient: string;
  headerGradient: string;
  buttonGradient: string;
  badgeColor: string;
  selectedBorder: string;
  selectedBg: string;
  checkBg: string;
  headline: string;
  label: string;
}> = {
  plus: {
    gradient: "from-pink-400 to-rose-500",
    headerGradient: "from-pink-100 to-rose-100",
    buttonGradient: "from-pink-500 to-rose-500",
    badgeColor: "text-rose-500",
    selectedBorder: "border-rose-500",
    selectedBg: "bg-rose-50",
    checkBg: "bg-rose-500",
    headline: "Unlimited Likes, Rewinds and Passport Mode with ISEXY Plus.",
    label: "Plus",
  },
  gold: {
    gradient: "from-yellow-400 to-amber-500",
    headerGradient: "from-yellow-100 to-amber-100",
    buttonGradient: "from-yellow-400 to-amber-500",
    badgeColor: "text-amber-600",
    selectedBorder: "border-amber-500",
    selectedBg: "bg-amber-50",
    checkBg: "bg-amber-500",
    headline: "See who likes you and match instantly with ISEXY Gold.",
    label: "Gold",
  },
  platinum: {
    gradient: "from-slate-600 to-slate-800",
    headerGradient: "from-slate-100 to-slate-200",
    buttonGradient: "from-slate-700 to-slate-900",
    badgeColor: "text-slate-700",
    selectedBorder: "border-slate-700",
    selectedBg: "bg-slate-50",
    checkBg: "bg-slate-700",
    headline: "Stand out and get priority with ISEXY Platinum.",
    label: "Platinum",
  },
};

export default function Premium() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeTier, setActiveTier] = useState<SubscriptionTier>("gold");
  const [selectedDuration, setSelectedDuration] = useState<Duration>("week");
  const [loading, setLoading] = useState(false);
  const showPromo = !profile?.first_purchase_promo_used && !profile?.is_premium;

  const config = tierConfig[activeTier];
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
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create checkout session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className={`bg-gradient-to-b ${config.headerGradient} pb-6`}>
        <div className="flex items-center justify-between p-4">
          <button onClick={() => navigate(-1)} className="p-2" aria-label="Close">
            <X className="w-6 h-6 text-foreground" />
          </button>

          <div className="flex items-center gap-1">
            {(["plus", "gold", "platinum"] as SubscriptionTier[]).map((tier) => (
              <button
                key={tier}
                onClick={() => {
                  setActiveTier(tier);
                  setSelectedDuration("week");
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  activeTier === tier
                    ? `bg-gradient-to-r ${tierConfig[tier].buttonGradient} text-white`
                    : "text-muted-foreground"
                }`}
              >
                <Flame className={`w-4 h-4 ${activeTier === tier ? "fill-white" : ""}`} />
                {tierConfig[tier].label}
              </button>
            ))}
          </div>

          <div className="w-10" />
        </div>

        <div className="px-6 pt-2">
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            {config.headline}
          </h1>
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

      <div className="px-4 -mt-2">
        <h2 className="text-lg font-semibold text-foreground mb-3">Select a Plan</h2>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {plans.map((plan) => {
            const selected = selectedDuration === plan.duration;
            return (
              <button
                key={plan.duration}
                onClick={() => setSelectedDuration(plan.duration)}
                className={`flex-shrink-0 w-32 p-4 rounded-xl border-2 transition-all relative ${
                  selected ? `${config.selectedBorder} ${config.selectedBg}` : "border-border bg-card"
                }`}
              >
                {plan.popular && !selected && (
                  <span className={`absolute -top-2 left-2 text-xs font-semibold ${config.badgeColor}`}>
                    Popular
                  </span>
                )}
                {plan.bestValue && !selected && (
                  <span className={`absolute -top-2 left-2 text-xs font-semibold ${config.badgeColor}`}>
                    Best Value
                  </span>
                )}

                {selected && (
                  <div className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center ${config.checkBg}`}>
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                <div className="text-left">
                  <p className="text-xl font-bold text-foreground">{plan.label}</p>
                  <p className="text-sm text-muted-foreground mt-2">${plan.weeklyPrice.toFixed(2)}/wk</p>
                  {plan.savings && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-muted rounded-full text-xs font-semibold text-muted-foreground">
                      Save {plan.savings}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-4 pb-48 overflow-y-auto mt-2">
        <div className="border border-border rounded-2xl p-4">
          <div className="flex justify-center mb-4">
            <span className="px-3 py-1 bg-muted rounded-full text-xs font-semibold text-muted-foreground">
              Included with {tierData.name}
            </span>
          </div>

          <div className="space-y-4">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
                <p className="font-semibold text-foreground">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 space-y-3">
        <button
          onClick={() => navigate("/compare-plans")}
          className="w-full text-center text-sm text-primary font-semibold hover:underline"
        >
          Compare all plans →
        </button>
        <p className="text-xs text-muted-foreground text-center">
          By tapping Continue, you agree that your subscription renews automatically until cancelled. You can cancel anytime in your account settings. Terms apply.
        </p>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className={`w-full py-4 px-6 rounded-full font-bold text-white transition-all bg-gradient-to-r ${config.buttonGradient} hover:opacity-90 disabled:opacity-50`}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            `Continue for $${selectedPlan.totalPrice.toFixed(2)} total`
          )}
        </button>
      </div>
    </div>
  );
}
