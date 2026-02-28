import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Check, Loader2, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subscriptionTiers, SubscriptionTier } from "@/lib/subscriptionTiers";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PromoCountdownBanner } from "@/components/PromoCountdownBanner";

type Duration = "week" | "month" | "6months";

interface PlanOption {
  duration: Duration;
  label: string;
  popular?: boolean;
  bestValue?: boolean;
  weeklyPrice: number;
  totalPrice: number;
  savings?: number;
}

const planOptions: Record<SubscriptionTier, PlanOption[]> = {
  plus: [
    { duration: "week", label: "1 Week", popular: true, weeklyPrice: 3.75, totalPrice: 3.75 },
    { duration: "month", label: "1 Month", weeklyPrice: 3.75, totalPrice: 14.99, savings: 0 },
    { duration: "6months", label: "6 Months", bestValue: true, weeklyPrice: 2.50, totalPrice: 59.99, savings: 33 },
  ],
  gold: [
    { duration: "week", label: "1 Week", popular: true, weeklyPrice: 7.50, totalPrice: 7.50 },
    { duration: "month", label: "1 Month", weeklyPrice: 7.50, totalPrice: 29.99, savings: 0 },
    { duration: "6months", label: "6 Months", bestValue: true, weeklyPrice: 5.00, totalPrice: 119.99, savings: 33 },
  ],
  platinum: [
    { duration: "week", label: "1 Week", popular: true, weeklyPrice: 10.00, totalPrice: 10.00 },
    { duration: "month", label: "1 Month", weeklyPrice: 10.00, totalPrice: 39.99, savings: 0 },
    { duration: "6months", label: "6 Months", bestValue: true, weeklyPrice: 6.67, totalPrice: 159.99, savings: 33 },
  ],
};

const tierFeatures: Record<SubscriptionTier, { title: string; description?: string }[]> = {
  plus: [
    { title: "Unlimited Likes" },
    { title: "Unlimited Rewinds" },
    { title: "Unlimited Passport™ Mode", description: "Match and chat with people anywhere in the world." },
    { title: "Control Your Profile", description: "Only show what you want them to know." },
    { title: "Control Who Sees You", description: "Manage who you're seen by." },
    { title: "Control Who You See", description: "Choose the type of people you want to connect with." },
    { title: "Hide Ads" },
  ],
  gold: [
    { title: "Unlimited Likes" },
    { title: "See Who Likes You" },
    { title: "Unlimited Rewinds" },
    { title: "1 Free Boost per month", description: "Free monthly Boost only available for 1 month or longer subscriptions." },
    { title: "5 Free Super Likes per week" },
    { title: "Unlimited Passport™ Mode", description: "Match and chat with people anywhere in the world." },
    { title: "Top Picks", description: "Browse through a daily curated selection of profiles." },
    { title: "Control Your Profile", description: "Only show what you want them to know." },
    { title: "Control Who Sees You", description: "Manage who you're seen by." },
    { title: "Control Who You See", description: "Choose the type of people you want to connect with." },
    { title: "Hide Ads" },
  ],
  platinum: [
    { title: "Unlimited Likes" },
    { title: "See Who Likes You" },
    { title: "Priority Likes", description: "Your Likes will be seen sooner with Priority Likes." },
    { title: "Unlimited Rewinds" },
    { title: "1 Free Boost per month", description: "Free monthly Boost only available for 1 month or longer subscriptions." },
    { title: "3 Free Super Likes per week" },
    { title: "3 Free First Impressions per week", description: "Stand out with a message before matching." },
    { title: "Unlimited Passport™ Mode", description: "Match and chat with people anywhere in the world." },
    { title: "Top Picks", description: "Browse through a daily curated selection of profiles." },
    { title: "Control Your Profile", description: "Only show what you want them to know." },
    { title: "Control Who Sees You", description: "Manage who you're seen by." },
    { title: "Control Who You See", description: "Choose the type of people you want to connect with." },
    { title: "Hide Ads" },
  ],
};

const tierConfig: Record<SubscriptionTier, { 
  gradient: string; 
  headerGradient: string;
  buttonGradient: string;
  badgeColor: string;
  headline: string;
}> = {
  plus: {
    gradient: "from-pink-400 to-rose-500",
    headerGradient: "from-pink-100 to-rose-100",
    buttonGradient: "from-pink-500 to-rose-500",
    badgeColor: "text-rose-500",
    headline: "Unlimited Likes. Unlimited Rewinds. Unlimited Passport™ Mode. No Ads.",
  },
  gold: {
    gradient: "from-yellow-400 to-amber-500",
    headerGradient: "from-yellow-100 to-amber-100",
    buttonGradient: "from-yellow-400 to-amber-500",
    badgeColor: "text-amber-600",
    headline: "See Who Likes You and match with them instantly with CubaDate Gold™.",
  },
  platinum: {
    gradient: "from-slate-600 to-slate-800",
    headerGradient: "from-slate-100 to-slate-200",
    buttonGradient: "from-slate-700 to-slate-900",
    badgeColor: "text-slate-700",
    headline: "Upgrade your Likes and Super Likes with CubaDate Platinum.",
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
  const plans = planOptions[activeTier];
  const features = tierFeatures[activeTier];
  const selectedPlan = plans.find((p) => p.duration === selectedDuration)!;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const tier = subscriptionTiers[activeTier];
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: tier.price_id },
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
      {/* Header gradient */}
      <div className={`bg-gradient-to-b ${config.headerGradient} pb-6`}>
        {/* Top bar */}
        <div className="flex items-center justify-between p-4">
          <button onClick={() => navigate(-1)} className="p-2">
            <X className="w-6 h-6 text-foreground" />
          </button>
          
          {/* Tier tabs */}
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
                    ? tier === "plus"
                      ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white"
                      : tier === "gold"
                      ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-white"
                      : "bg-gradient-to-r from-slate-600 to-slate-800 text-white"
                    : "text-muted-foreground"
                }`}
              >
                <Flame className={`w-4 h-4 ${activeTier === tier ? "fill-white" : ""}`} />
                {tier === "plus" ? "+" : tier === "gold" ? "GOLD" : "PLATINUM"}
              </button>
            ))}
          </div>
          
          <div className="w-10" />
        </div>

        {/* Headline */}
        <div className="px-6 pt-2">
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            {config.headline}
          </h1>
        </div>
      </div>

      {/* FOMO Promo Banner */}
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

      {/* Plan selection */}
      <div className="px-4 -mt-2">
        <h2 className="text-lg font-semibold text-foreground mb-3">Select a Plan</h2>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {plans.map((plan) => (
            <button
              key={plan.duration}
              onClick={() => setSelectedDuration(plan.duration)}
              className={`flex-shrink-0 w-32 p-4 rounded-xl border-2 transition-all relative ${
                selectedDuration === plan.duration
                  ? activeTier === "plus"
                    ? "border-rose-500 bg-rose-50"
                    : activeTier === "gold"
                    ? "border-amber-500 bg-amber-50"
                    : "border-slate-700 bg-slate-50"
                  : "border-border bg-card"
              }`}
            >
              {plan.popular && selectedDuration !== plan.duration && (
                <span className={`absolute -top-2 left-2 text-xs font-semibold ${config.badgeColor}`}>
                  Popular
                </span>
              )}
              {plan.bestValue && selectedDuration !== plan.duration && (
                <span className={`absolute -top-2 left-2 text-xs font-semibold ${config.badgeColor}`}>
                  Best Value
                </span>
              )}
              
              {selectedDuration === plan.duration && (
                <div className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center ${
                  activeTier === "plus"
                    ? "bg-rose-500"
                    : activeTier === "gold"
                    ? "bg-amber-500"
                    : "bg-slate-700"
                }`}>
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
          ))}
        </div>

        {/* Dots indicator */}
        <div className="flex justify-center gap-1.5 py-3">
          {plans.map((plan) => (
            <div
              key={plan.duration}
              className={`w-2 h-2 rounded-full transition-colors ${
                selectedDuration === plan.duration ? "bg-foreground" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Features list */}
      <div className="flex-1 px-4 pb-48 overflow-y-auto">
        <div className="border border-border rounded-2xl p-4">
          <div className="flex justify-center mb-4">
            <span className="px-3 py-1 bg-muted rounded-full text-xs font-semibold text-muted-foreground">
              Included with CubaDate {activeTier.charAt(0).toUpperCase() + activeTier.slice(1)}®
            </span>
          </div>
          
          <div className="space-y-4">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">{feature.title}</p>
                  {feature.description && (
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 space-y-3">
        <button 
          onClick={() => navigate("/compare-plans")}
          className="w-full text-center text-sm text-primary font-semibold hover:underline"
        >
          Compare all plans →
        </button>
        <p className="text-xs text-muted-foreground text-center">
          By tapping Continue, you will be charged, your subscription will auto-renew for the same price and package length until you cancel, and you agree to our <span className="underline">Terms</span>.
        </p>
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br ${config.gradient}`}>
              <Flame className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{selectedPlan.label}</p>
              <p className="text-sm text-foreground font-bold">${selectedPlan.totalPrice.toFixed(2)} total</p>
            </div>
          </div>
          
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className={`flex-1 py-4 px-6 rounded-full font-bold text-white transition-all bg-gradient-to-r ${config.buttonGradient} hover:opacity-90 disabled:opacity-50`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
