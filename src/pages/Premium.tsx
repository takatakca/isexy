import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthButton } from "@/components/AuthButton";
import { Crown, Check, Zap, Eye, Star, RotateCcw, Heart, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subscriptionTiers, SubscriptionTier } from "@/lib/subscriptionTiers";
import { toast } from "sonner";

const tiers: { id: SubscriptionTier; popular?: boolean; color: string }[] = [
  { id: "plus", color: "from-pink-500 to-rose-500" },
  { id: "gold", color: "from-yellow-400 to-orange-500", popular: true },
  { id: "platinum", color: "from-slate-400 to-slate-600" },
];

const featureIcons: Record<string, typeof Heart> = {
  "Unlimited Likes": Heart,
  "5 Rewinds per day": RotateCcw,
  "1 Boost per month": Zap,
  "5 Super Likes per week": Star,
  "See who likes you": Eye,
  "Unlimited Rewinds": RotateCcw,
  "5 Boosts per month": Zap,
  "Unlimited Boosts": Zap,
  "Unlimited Super Likes": Star,
  "Priority Likes": Check,
  "Message before matching": Check,
};

export default function Premium() {
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);

  const handleSubscribe = async (tierId: SubscriptionTier) => {
    setLoadingTier(tierId);
    try {
      const tier = subscriptionTiers[tierId];
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
      setLoadingTier(null);
    }
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col pb-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">
            Get Premium
          </h1>
          <p className="text-muted-foreground">
            Unlock all features and find your match faster
          </p>
        </div>

        {/* Tiers */}
        <div className="space-y-4 mb-8">
          {tiers.map((tier) => {
            const tierData = subscriptionTiers[tier.id];
            return (
              <div
                key={tier.id}
                className={`relative p-5 rounded-2xl border-2 transition-all ${
                  tier.popular
                    ? "border-primary bg-primary/5 shadow-glow"
                    : "border-border bg-card"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3
                      className={`font-bold text-lg bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}
                    >
                      {tierData.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-foreground">
                        ${tierData.price.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {tierData.features.map((feature, idx) => {
                    const IconComponent = featureIcons[feature] || Check;
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <IconComponent className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    );
                  })}
                </div>

                <AuthButton
                  variant={tier.popular ? "primary" : "secondary"}
                  onClick={() => handleSubscribe(tier.id)}
                  disabled={loadingTier !== null}
                >
                  {loadingTier === tier.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Subscribe"
                  )}
                </AuthButton>
              </div>
            );
          })}
        </div>

        {/* Info */}
        <p className="text-center text-xs text-muted-foreground">
          Subscriptions automatically renew unless cancelled. Cancel anytime in settings.
          <br />
          By subscribing, you agree to our Terms of Service.
        </p>
      </div>
    </AuthLayout>
  );
}
