import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Check, Lock, Flame } from "lucide-react";
import { subscriptionTiers, SubscriptionTier } from "@/lib/subscriptionTiers";

interface FeatureItem {
  title: string;
  description?: string;
  included: boolean;
}

interface TierSection {
  category: string;
  features: FeatureItem[];
}

const tierSections: Record<SubscriptionTier, TierSection[]> = {
  plus: [
    {
      category: "Upgrade Your Likes",
      features: [
        { title: "Unlimited Likes", included: true },
        { title: "See Who Likes You", included: false },
        { title: "Priority Likes", description: "Your Likes will be seen sooner with Priority Likes.", included: false },
      ],
    },
    {
      category: "Enhance Your Experience",
      features: [
        { title: "Unlimited Rewinds", included: true },
        { title: "1 Free Boost per month", description: "Free monthly Boost only available for 1 month or longer subscriptions.", included: false },
        { title: "3 Free Super Likes per week", included: false },
        { title: "3 Free First Impressions per week", description: "Stand out with a message before matching.", included: false },
      ],
    },
    {
      category: "Premium Discovery",
      features: [
        { title: "Unlimited Passport™ Mode", description: "Match and chat with people anywhere in the world.", included: true },
        { title: "Top Picks", description: "Browse through a daily curated selection of profiles.", included: false },
      ],
    },
    {
      category: "Take Control",
      features: [
        { title: "Control Your Profile", description: "Only show what you want them to know.", included: true },
        { title: "Control Who Sees You", description: "Manage who you're seen by.", included: true },
        { title: "Control Who You See", description: "Choose the type of people you want to connect with.", included: true },
        { title: "Hide Ads", included: true },
      ],
    },
  ],
  gold: [
    {
      category: "Upgrade Your Likes",
      features: [
        { title: "Unlimited Likes", included: true },
        { title: "See Who Likes You", included: true },
        { title: "Priority Likes", description: "Your Likes will be seen sooner with Priority Likes.", included: false },
      ],
    },
    {
      category: "Enhance Your Experience",
      features: [
        { title: "Unlimited Rewinds", included: true },
        { title: "1 Free Boost per month", description: "Free monthly Boost only available for 1 month or longer subscriptions.", included: true },
        { title: "2 Free Super Likes per week", included: true },
        { title: "3 Free First Impressions per week", description: "Stand out with a message before matching.", included: false },
      ],
    },
    {
      category: "Premium Discovery",
      features: [
        { title: "Unlimited Passport™ Mode", description: "Match and chat with people anywhere in the world.", included: true },
        { title: "Top Picks", description: "Browse through a daily curated selection of profiles.", included: true },
      ],
    },
    {
      category: "Take Control",
      features: [
        { title: "Control Your Profile", description: "Only show what you want them to know.", included: true },
        { title: "Control Who Sees You", description: "Manage who you're seen by.", included: true },
        { title: "Control Who You See", description: "Choose the type of people you want to connect with.", included: true },
        { title: "Hide Ads", included: true },
      ],
    },
  ],
  platinum: [
    {
      category: "Upgrade Your Likes",
      features: [
        { title: "Unlimited Likes", included: true },
        { title: "See Who Likes You", included: true },
        { title: "Priority Likes", description: "Your Likes will be seen sooner with Priority Likes.", included: true },
      ],
    },
    {
      category: "Enhance Your Experience",
      features: [
        { title: "Unlimited Rewinds", included: true },
        { title: "1 Free Boost per month", description: "Free monthly Boost only available for 1 month or longer subscriptions.", included: true },
        { title: "3 Free Super Likes per week", included: true },
        { title: "3 Free First Impressions per week", description: "Stand out with a message before matching.", included: true },
      ],
    },
    {
      category: "Premium Discovery",
      features: [
        { title: "Unlimited Passport™ Mode", description: "Match and chat with people anywhere in the world.", included: true },
        { title: "Top Picks", description: "Browse through a daily curated selection of profiles.", included: true },
      ],
    },
    {
      category: "Take Control",
      features: [
        { title: "Control Your Profile", description: "Only show what you want them to know.", included: true },
        { title: "Control Who Sees You", description: "Manage who you're seen by.", included: true },
        { title: "Control Who You See", description: "Choose the type of people you want to connect with.", included: true },
        { title: "Hide Ads", included: true },
      ],
    },
  ],
};

const tierConfig: Record<SubscriptionTier, { 
  gradient: string;
  bgColor: string;
  buttonGradient: string;
  startingPrice: number;
}> = {
  plus: {
    gradient: "from-pink-400 to-rose-500",
    bgColor: "bg-gradient-to-br from-pink-100 to-rose-100",
    buttonGradient: "from-pink-500 to-rose-500",
    startingPrice: 9.99,
  },
  gold: {
    gradient: "from-yellow-400 to-amber-500",
    bgColor: "bg-gradient-to-br from-yellow-100 to-amber-100",
    buttonGradient: "from-yellow-400 to-amber-500",
    startingPrice: 14.99,
  },
  platinum: {
    gradient: "from-slate-500 to-slate-700",
    bgColor: "bg-gradient-to-br from-slate-100 to-slate-200",
    buttonGradient: "from-slate-600 to-slate-800",
    startingPrice: 19.99,
  },
};

export default function MySubscription() {
  const navigate = useNavigate();
  const [activeTier, setActiveTier] = useState<SubscriptionTier>("plus");

  const config = tierConfig[activeTier];
  const sections = tierSections[activeTier];
  const tiers: SubscriptionTier[] = ["plus", "gold", "platinum"];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="p-2">
          <X className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">My Subscription</h1>
        <div className="w-10" />
      </div>

      {/* Tier carousel */}
      <div className="px-4 py-6">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
          {tiers.map((tier) => (
            <button
              key={tier}
              onClick={() => setActiveTier(tier)}
              className={`flex-shrink-0 w-64 h-32 rounded-2xl border-2 transition-all snap-center ${
                activeTier === tier
                  ? tier === "plus"
                    ? "border-rose-500"
                    : tier === "gold"
                    ? "border-amber-500"
                    : "border-slate-600"
                  : "border-border"
              } ${tierConfig[tier].bgColor}`}
            >
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-2">
                  <Flame className={`w-6 h-6 ${
                    tier === "plus" ? "text-rose-500 fill-rose-500" :
                    tier === "gold" ? "text-amber-500 fill-amber-500" :
                    "text-slate-600 fill-slate-600"
                  }`} />
                  <span className={`font-bold text-xl ${
                    tier === "plus" ? "text-rose-600" :
                    tier === "gold" ? "text-amber-600" :
                    "text-slate-700"
                  }`}>
                    CubaDate {tier === "plus" ? "+" : tier.toUpperCase()}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Dots indicator */}
        <div className="flex justify-center gap-1.5 py-3">
          {tiers.map((tier) => (
            <div
              key={tier}
              className={`w-2 h-2 rounded-full transition-colors ${
                activeTier === tier ? "bg-foreground" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Feature sections */}
      <div className="flex-1 px-4 pb-32 overflow-y-auto">
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-6">
            <div className="flex justify-center mb-3">
              <span className="px-3 py-1 bg-muted rounded-full text-xs font-semibold text-muted-foreground">
                {section.category}
              </span>
            </div>

            <div className="border border-border rounded-2xl p-4 space-y-4">
              {section.features.map((feature, featureIdx) => (
                <div key={featureIdx} className="flex items-start gap-3">
                  {feature.included ? (
                    <Check className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-semibold ${feature.included ? "text-foreground" : "text-muted-foreground"}`}>
                      {feature.title}
                    </p>
                    {feature.description && (
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <button
          onClick={() => navigate("/premium")}
          className={`w-full py-4 rounded-full font-bold text-lg text-white transition-opacity hover:opacity-90 bg-gradient-to-r ${config.buttonGradient}`}
        >
          STARTING AT ${config.startingPrice.toFixed(2)}
        </button>
      </div>
    </div>
  );
}
