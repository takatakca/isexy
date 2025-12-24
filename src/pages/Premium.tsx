import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthButton } from "@/components/AuthButton";
import { Crown, Check, Zap, Eye, Star, RotateCcw, Heart } from "lucide-react";

const tiers = [
  {
    id: "plus",
    name: "CubaDate Plus",
    price: "$14.99",
    period: "/month",
    color: "from-pink-500 to-rose-500",
    features: [
      { icon: Heart, text: "Unlimited Likes" },
      { icon: RotateCcw, text: "5 Rewinds per day" },
      { icon: Zap, text: "1 Boost per month" },
      { icon: Star, text: "5 Super Likes per week" },
    ],
  },
  {
    id: "gold",
    name: "CubaDate Gold",
    price: "$29.99",
    period: "/month",
    color: "from-yellow-400 to-orange-500",
    popular: true,
    features: [
      { icon: Heart, text: "Unlimited Likes" },
      { icon: Eye, text: "See who likes you" },
      { icon: RotateCcw, text: "Unlimited Rewinds" },
      { icon: Zap, text: "5 Boosts per month" },
      { icon: Star, text: "5 Super Likes per week" },
    ],
  },
  {
    id: "platinum",
    name: "CubaDate Platinum",
    price: "$39.99",
    period: "/month",
    color: "from-slate-400 to-slate-600",
    features: [
      { icon: Heart, text: "Unlimited Likes" },
      { icon: Eye, text: "See who likes you" },
      { icon: RotateCcw, text: "Unlimited Rewinds" },
      { icon: Zap, text: "Unlimited Boosts" },
      { icon: Star, text: "Unlimited Super Likes" },
      { icon: Check, text: "Priority Likes" },
      { icon: Check, text: "Message before matching" },
    ],
  },
];

export default function Premium() {
  const navigate = useNavigate();

  const handleSubscribe = async (tierId: string) => {
    // TODO: Implement Stripe integration
    navigate("/settings");
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
          {tiers.map((tier) => (
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
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-foreground">
                      {tier.price}
                    </span>
                    <span className="text-muted-foreground">{tier.period}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {tier.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <feature.icon className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground">{feature.text}</span>
                  </div>
                ))}
              </div>

              <AuthButton
                variant={tier.popular ? "primary" : "secondary"}
                onClick={() => handleSubscribe(tier.id)}
              >
                Subscribe
              </AuthButton>
            </div>
          ))}
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
